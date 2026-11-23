import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ContentService } from '../content/content.service';

export interface Attempt {
  id: string;
  challengeId: string;
  at: Date;
  score: number;
  passed: number | null;
  total: number | null;
  timeSpentMs: number | null;
  testRuns: number | null;
  sessionId: string;
  assessmentId: string;
  mode: 'practice' | 'assessment';
  /** The section's current result (not replaced by a retry). */
  current: boolean;
  /** Rebuilt from a retry event logged before retries kept their submissions: score only. */
  recovered: boolean;
}

const MASTERED = 99.9;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Progress across every graded attempt: per question, per assessment and over time. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
  ) {}

  private async attempts(): Promise<Attempt[]> {
    const subs = await this.prisma.submission.findMany({ include: { sectionAttempt: { include: { session: true } } } });
    const out: Attempt[] = subs.map((s) => {
      const sa = s.sectionAttempt;
      const live = !s.supersededAt && sa.startedAt && sa.submittedAt ? sa.submittedAt.getTime() - sa.startedAt.getTime() : null;
      return {
        id: s.id,
        challengeId: s.challengeId,
        at: s.createdAt,
        score: s.score,
        passed: s.passed,
        total: s.total,
        timeSpentMs: s.timeSpentMs ?? live,
        testRuns: s.testRuns,
        sessionId: sa.sessionId,
        assessmentId: sa.session.assessmentId,
        mode: sa.session.assessmentId.startsWith('practice-') ? 'practice' : 'assessment',
        current: !s.supersededAt,
        recovered: false,
      };
    });

    // Retries used to delete the previous submission; their event kept the section score. For one-question
    // sections (every practice run and most assessment sections) that is the question's score.
    const retries = await this.prisma.sessionEvent.findMany({ where: { type: 'section.retried' }, include: { session: true } });
    for (const e of retries) {
      const p = e.payload ? (JSON.parse(e.payload) as { sectionId?: string; previousStatus?: string; previousScore?: number | null; kept?: boolean }) : {};
      if (p.kept || p.previousScore == null || p.previousStatus === 'SKIPPED' || !p.sectionId) continue;
      let challenges: string[] = [];
      try {
        challenges = this.content.assessment(e.session.assessmentId).definition.sections.find((x) => x.id === p.sectionId)?.challenges ?? [];
      } catch {
        /* assessment removed */
      }
      if (challenges.length !== 1) continue;
      out.push({
        id: e.id,
        challengeId: challenges[0],
        at: e.createdAt,
        score: p.previousScore,
        passed: null,
        total: null,
        timeSpentMs: null,
        testRuns: null,
        sessionId: e.sessionId,
        assessmentId: e.session.assessmentId,
        mode: e.session.assessmentId.startsWith('practice-') ? 'practice' : 'assessment',
        current: false,
        recovered: true,
      });
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  private challengeInfo(id: string) {
    try {
      const m = this.content.challenge(id).manifest;
      return { title: m.title, difficulty: m.difficulty, runtime: m.runtime };
    } catch {
      return { title: id, difficulty: null, runtime: null };
    }
  }

  async summary() {
    const attempts = await this.attempts();

    const byChallenge = new Map<string, Attempt[]>();
    for (const a of attempts) byChallenge.set(a.challengeId, [...(byChallenge.get(a.challengeId) ?? []), a]);
    const challenges = [...byChallenge.entries()].map(([id, list]) => {
      const scores = list.map((a) => a.score);
      const first = scores[0];
      const latest = scores[scores.length - 1];
      const best = Math.max(...scores);
      const times = list.map((a) => a.timeSpentMs).filter((t): t is number => t !== null);
      return {
        id,
        ...this.challengeInfo(id),
        attempts: list,
        count: list.length,
        first,
        latest,
        best,
        improvement: round(latest - first),
        bestImprovement: round(best - first),
        mastered: best >= MASTERED,
        totalTimeMs: times.reduce((a, b) => a + b, 0),
        avgTimeMs: mean(times),
        lastAt: list[list.length - 1].at,
      };
    });
    challenges.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());

    // After each attempt: the average best score over every question attempted so far.
    const bestSoFar = new Map<string, number>();
    const timeline = attempts.map((a) => {
      bestSoFar.set(a.challengeId, Math.max(bestSoFar.get(a.challengeId) ?? 0, a.score));
      return { at: a.at, challengeId: a.challengeId, title: this.challengeInfo(a.challengeId).title, score: a.score, avgBest: round(mean([...bestSoFar.values()]))! };
    });

    const sessions = await this.prisma.session.findMany({
      where: { status: { in: ['SUBMITTED', 'EXPIRED'] }, NOT: { assessmentId: { startsWith: 'practice-' } } },
      orderBy: { submittedAt: 'asc' },
    });
    const byAssessment = new Map<string, typeof sessions>();
    for (const s of sessions) byAssessment.set(s.assessmentId, [...(byAssessment.get(s.assessmentId) ?? []), s]);
    const assessments = [...byAssessment.entries()].map(([id, list]) => {
      let title = id;
      try {
        title = this.content.assessment(id).definition.title;
      } catch {
        /* assessment removed */
      }
      const scores = list.map((s) => s.score ?? 0);
      return {
        id,
        title,
        runs: list.map((s) => ({ sessionId: s.id, at: s.submittedAt ?? s.createdAt, score: s.score ?? 0, status: s.status })),
        first: scores[0],
        latest: scores[scores.length - 1],
        best: Math.max(...scores),
        improvement: round(scores[scores.length - 1] - scores[0]),
      };
    });

    const repeated = challenges.filter((c) => c.count > 1);
    return {
      overview: {
        attempts: attempts.length,
        questions: challenges.length,
        mastered: challenges.filter((c) => c.mastered).length,
        repeated: repeated.length,
        improved: repeated.filter((c) => c.best > c.first).length,
        avgFirst: round(mean(challenges.map((c) => c.first))),
        avgBest: round(mean(challenges.map((c) => c.best))),
        avgLatest: round(mean(challenges.map((c) => c.latest))),
        totalTimeMs: challenges.reduce((a, c) => a + c.totalTimeMs, 0),
        firstAt: attempts[0]?.at ?? null,
        lastAt: attempts[attempts.length - 1]?.at ?? null,
      },
      timeline,
      challenges,
      assessments,
    };
  }
}
