import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ContentService } from '../content/content.service';
import { WorkspacesService } from '../workspaces/workspaces.service';

const SWEEP_MS = 5_000;

/**
 * Session lifecycle: CREATED → IN_PROGRESS → SUBMITTED | EXPIRED | ABANDONED.
 * Each section has its own server-side deadline; the browser clock is never trusted.
 */
@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SessionsService.name);
  private timer?: NodeJS.Timeout;
  private submitting = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    private readonly workspaces: WorkspacesService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweepExpired().catch((e) => this.log.error(e)), SWEEP_MS);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async event(sessionId: string, type: string, payload?: unknown) {
    await this.prisma.sessionEvent.create({ data: { sessionId, type, payload: payload === undefined ? null : JSON.stringify(payload) } });
  }

  async create(assessmentId: string) {
    const { definition } = this.content.assessment(assessmentId);
    const session = await this.prisma.session.create({
      data: {
        assessmentId,
        status: 'READY',
        sections: { create: definition.sections.map((s, i) => ({ sectionId: s.id, kind: s.kind, order: i })) },
      },
    });
    await this.event(session.id, 'created');
    return this.get(session.id);
  }

  async list() {
    const sessions = await this.prisma.session.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { sections: true } });
    return sessions.map((s) => {
      let title = s.assessmentId;
      try {
        title = this.content.assessment(s.assessmentId).definition.title;
      } catch {
        /* assessment removed */
      }
      return { id: s.id, assessmentId: s.assessmentId, title, status: s.status, createdAt: s.createdAt, submittedAt: s.submittedAt, score: s.score };
    });
  }

  async get(id: string) {
    const s = await this.prisma.session.findUnique({
      where: { id },
      include: { sections: { orderBy: { order: 'asc' }, include: { workspaces: true, submissions: true } } },
    });
    if (!s) throw new NotFoundException('Session not found');
    const { definition } = this.content.assessment(s.assessmentId);
    return {
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
      score: s.score,
      serverTime: new Date().toISOString(),
      assessment: { id: definition.id, title: definition.title, subtitle: definition.subtitle, aiAssistance: definition.aiAssistance, disclaimer: definition.disclaimer },
      sections: s.sections.map((sa) => {
        const def = definition.sections.find((d) => d.id === sa.sectionId)!;
        return {
          id: sa.sectionId,
          kind: sa.kind,
          title: def?.title ?? sa.sectionId,
          durationMinutes: def?.durationMinutes,
          status: sa.status,
          startedAt: sa.startedAt,
          deadline: sa.deadline,
          submittedAt: sa.submittedAt,
          score: sa.score,
          challenges: (def?.challenges ?? []).map((cid) => {
            const ws = sa.workspaces.find((w) => w.challengeId === cid);
            const sub = sa.submissions.find((x) => x.challengeId === cid);
            return { id: cid, title: this.content.challenge(cid).manifest.title, workspaceId: ws?.id ?? null, workspaceStatus: ws?.status ?? null, score: sub?.score ?? null };
          }),
        };
      }),
    };
  }

  async startSection(sessionId: string, sectionId: string) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { sections: true } });
    if (!s) throw new NotFoundException('Session not found');
    if (['SUBMITTED', 'EXPIRED', 'ABANDONED'].includes(s.status)) throw new ConflictException(`Session is ${s.status}`);
    const sa = s.sections.find((x) => x.sectionId === sectionId);
    if (!sa) throw new NotFoundException('Section not found');
    if (sa.status === 'IN_PROGRESS') return this.get(sessionId);
    if (sa.status !== 'PENDING') throw new ConflictException(`Section is ${sa.status}`);
    const other = s.sections.find((x) => x.status === 'IN_PROGRESS');
    if (other) throw new ConflictException(`Finish section "${other.sectionId}" before starting another`);

    const def = this.content.assessment(s.assessmentId).definition.sections.find((d) => d.id === sectionId)!;
    const now = new Date();
    await this.prisma.sectionAttempt.update({
      where: { id: sa.id },
      data: { status: 'IN_PROGRESS', startedAt: now, deadline: new Date(now.getTime() + def.durationMinutes * 60_000) },
    });
    if (s.status !== 'IN_PROGRESS') await this.prisma.session.update({ where: { id: sessionId }, data: { status: 'IN_PROGRESS', startedAt: s.startedAt ?? now } });
    for (const cid of def.challenges) await this.workspaces.create(sa.id, cid);
    await this.event(sessionId, 'section.started', { sectionId });
    return this.get(sessionId);
  }

  /** Final grading: restore protected files, run the full suite, store diff + score. */
  async submitSection(sessionId: string, sectionId: string, reason: 'submitted' | 'expired' = 'submitted') {
    const sa = await this.prisma.sectionAttempt.findUnique({ where: { sessionId_sectionId: { sessionId, sectionId } }, include: { workspaces: true } });
    if (!sa) throw new NotFoundException('Section not found');
    if (sa.status !== 'IN_PROGRESS') return this.get(sessionId);
    if (this.submitting.has(sa.id)) throw new ConflictException('Submission already in progress');
    this.submitting.add(sa.id);
    try {
      // Freeze edits immediately.
      await this.prisma.sectionAttempt.update({ where: { id: sa.id }, data: { status: reason === 'expired' ? 'EXPIRED' : 'SUBMITTED', submittedAt: new Date() } });
      const scores: number[] = [];
      for (const ws of sa.workspaces) {
        let score = 0;
        let testRunId: string | undefined;
        let diff = '';
        if (ws.status === 'RUNNING' || ws.status === 'READY') {
          try {
            const run = await this.workspaces.finalGrade(ws.id);
            testRunId = run.id;
            score = run.total ? Math.round((run.passed / run.total) * 1000) / 10 : 0;
            diff = (await this.workspaces.diff(ws.id)).patch;
          } catch (e) {
            this.log.error(`Final grading failed for ${ws.id}: ${(e as Error).message}`);
          }
        }
        await this.prisma.submission.create({ data: { sectionAttemptId: sa.id, challengeId: ws.challengeId, testRunId, diff, score } });
        await this.workspaces.stop(ws.id).catch(() => undefined);
        scores.push(score);
      }
      const sectionScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      await this.prisma.sectionAttempt.update({ where: { id: sa.id }, data: { score: sectionScore } });
      await this.event(sessionId, `section.${reason}`, { sectionId, score: sectionScore });
      await this.maybeFinish(sessionId);
    } finally {
      this.submitting.delete(sa.id);
    }
    return this.get(sessionId);
  }

  private async maybeFinish(sessionId: string, force = false) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { sections: true } });
    if (!s) return;
    const done = s.sections.every((x) => x.status === 'SUBMITTED' || x.status === 'EXPIRED' || x.status === 'SKIPPED');
    if (!done && !force) return;
    const graded = s.sections.filter((x) => x.score !== null);
    const score = graded.length ? graded.reduce((a, x) => a + (x.score ?? 0), 0) / s.sections.length : 0;
    const expired = s.sections.some((x) => x.status === 'EXPIRED');
    await this.prisma.session.update({ where: { id: sessionId }, data: { status: expired && !force ? 'EXPIRED' : 'SUBMITTED', submittedAt: new Date(), score } });
    await this.event(sessionId, 'session.finished', { score });
  }

  /** Submit the whole assessment: grades the active section, skips untouched ones. */
  async submit(sessionId: string) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { sections: true } });
    if (!s) throw new NotFoundException('Session not found');
    for (const sa of s.sections) {
      if (sa.status === 'IN_PROGRESS') await this.submitSection(sessionId, sa.sectionId);
      else if (sa.status === 'PENDING') await this.prisma.sectionAttempt.update({ where: { id: sa.id }, data: { status: 'SKIPPED', score: 0 } });
    }
    await this.maybeFinish(sessionId, true);
    return this.get(sessionId);
  }

  async abandon(sessionId: string) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { sections: { include: { workspaces: true } } } });
    if (!s) throw new NotFoundException('Session not found');
    for (const ws of s.sections.flatMap((x) => x.workspaces)) await this.workspaces.stop(ws.id).catch(() => undefined);
    await this.prisma.session.update({ where: { id: sessionId }, data: { status: 'ABANDONED' } });
    return this.get(sessionId);
  }

  async results(sessionId: string) {
    const session = await this.get(sessionId);
    const subs = await this.prisma.submission.findMany({
      where: { sectionAttempt: { sessionId } },
      include: { testRun: true, sectionAttempt: true },
    });
    const events = await this.prisma.sessionEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    const runCounts = await this.prisma.testRun.groupBy({
      by: ['workspaceId'],
      where: { workspace: { sectionAttempt: { sessionId } } },
      _count: true,
    });
    return {
      session,
      submissions: subs.map((s) => ({
        sectionId: s.sectionAttempt.sectionId,
        challengeId: s.challengeId,
        score: s.score,
        diff: s.diff,
        timeSpentMs: s.sectionAttempt.startedAt && s.sectionAttempt.submittedAt ? s.sectionAttempt.submittedAt.getTime() - s.sectionAttempt.startedAt.getTime() : null,
        testRun: s.testRun && { passed: s.testRun.passed, failed: s.testRun.failed, total: s.testRun.total, tests: JSON.parse(s.testRun.resultsJson), output: s.testRun.output.slice(-20_000) },
      })),
      testRunsByWorkspace: Object.fromEntries(runCounts.map((r) => [r.workspaceId, r._count])),
      events: events.map((e) => ({ type: e.type, at: e.createdAt, payload: e.payload ? JSON.parse(e.payload) : null })),
    };
  }

  private async sweepExpired() {
    const expired = await this.prisma.sectionAttempt.findMany({ where: { status: 'IN_PROGRESS', deadline: { lt: new Date() } } });
    for (const sa of expired) {
      this.log.log(`Section ${sa.sectionId} of session ${sa.sessionId} expired — auto-submitting`);
      await this.submitSection(sa.sessionId, sa.sectionId, 'expired').catch((e) => this.log.error(e));
    }
  }
}
