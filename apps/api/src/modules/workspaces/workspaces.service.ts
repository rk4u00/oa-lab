import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { OnApplicationBootstrap, BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createTwoFilesPatch } from 'diff';
import { ensureImage, parseJestJson, parseJUnit } from '@oa-lab/execution-engine';
import type { FileNode, TestCaseResult, TestRunResult } from '@oa-lab/shared';
import { EXECUTION_DRIVER, ExecutionDriver } from '../../common/driver.provider';
import { env, REPO_ROOT } from '../../common/env';
import { copyDir, exists, IGNORED_DIRS, makeWorldWritable, safeResolve } from '../../common/fs-utils';
import { PrismaService } from '../../common/prisma.service';
import { ContentService, RegisteredChallenge } from '../content/content.service';

const MAX_FILE_BYTES = 1_000_000;
const DEFAULT_COACH_PROMPT = `You are an assessment debugging coach.

Help the user understand the failing behavior.
Trace the execution path.
Identify likely causes.
Suggest incremental hints.

Do not edit files or modify tests.
Do not reveal hidden test cases or reference solutions.
Ask the user to run focused tests after each fix.`;

const isIgnored = (rel: string) => rel.split(/[\\/]/).some((seg) => IGNORED_DIRS.has(seg));

@Injectable()
export class WorkspacesService implements OnApplicationBootstrap {
  private readonly log = new Logger(WorkspacesService.name);
  private preparing = new Map<string, Promise<string>>();
  private running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly content: ContentService,
    @Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver,
  ) {}

  private images = new Map<string, Promise<void>>();

  /** Build any missing runtime images in the background on startup (first run only). */
  onApplicationBootstrap() {
    if (this.driver.name !== 'docker' || !env.autoBuildRuntimes) return;
    const images = [...new Set(this.content.listChallenges().map((c) => c.manifest.runtime.image))];
    void (async () => {
      for (const image of ['oa-lab-python:latest', 'oa-lab-node:latest', 'oa-lab-java:latest', ...images]) await this.ensureRuntime(image).catch((e) => this.log.error(e.message));
    })();
  }

  /** oa-lab-<name>:tag is built from infrastructure/docker/Dockerfile.<name>; other images are pulled by Docker as needed. */
  ensureRuntime(image: string): Promise<void> {
    if (this.driver.name !== 'docker') return Promise.resolve();
    const m = image.match(/^oa-lab-([a-z0-9]+)(?::[\w.-]+)?$/);
    if (!m) return Promise.resolve();
    if (!this.images.has(image)) {
      const p = ensureImage(image, path.join(REPO_ROOT, 'infrastructure/docker', `Dockerfile.${m[1]}`), REPO_ROOT, (l) => this.log.log(l));
      p.catch(() => this.images.delete(image));
      this.images.set(image, p);
    }
    return this.images.get(image)!;
  }

  private dirs(id: string) {
    const base = path.join(env.dataDir, 'workspaces', id);
    return { base, repo: path.join(base, 'repo'), pristine: path.join(base, 'pristine'), log: path.join(base, 'prepare.log') };
  }

  // ---------- preparation (dependency install, once per challenge, cached) ----------

  private async starterFingerprint(c: RegisteredChallenge) {
    const h = crypto.createHash('sha1').update(JSON.stringify(c.manifest.execution.setup ?? '')).update(c.manifest.runtime.image);
    const walk = async (dir: string) => {
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        if (IGNORED_DIRS.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else if (/^(package(-lock)?\.json|requirements.*\.txt|pom\.xml|build\.gradle.*|Pipfile.*|pyproject\.toml|yarn\.lock|pnpm-lock\.yaml)$/.test(e.name))
          h.update(e.name).update(await fs.readFile(p));
      }
    };
    await walk(c.starterPath);
    return h.digest('hex').slice(0, 12);
  }

  /** Returns a directory containing the starter repo with dependencies installed. */
  async prepareChallenge(c: RegisteredChallenge, logFile?: string): Promise<string> {
    const setup = c.manifest.execution.setup;
    if (!setup) return c.starterPath;
    const key = `${c.manifest.id}-${await this.starterFingerprint(c)}`;
    const target = path.join(env.dataDir, 'prepared', key);
    if (await exists(path.join(target, '.oa', 'prepared.ok'))) return target;
    if (!this.preparing.has(key)) {
      const p = (async () => {
        const tmp = `${target}.tmp-${Date.now()}`;
        await copyDir(c.starterPath, tmp, (rel) => !isIgnored(rel) || rel.startsWith('.oa'));
        await fs.mkdir(path.join(tmp, '.oa'), { recursive: true });
        await makeWorldWritable(tmp);
        this.log.log(`Preparing ${c.manifest.id}: ${setup}`);
        const r = await this.driver.run({
          image: c.manifest.runtime.image,
          hostDir: tmp,
          command: setup,
          timeoutMs: 15 * 60_000,
          // Preparation is the ONLY step that gets network access.
          limits: { ...c.manifest.resources, network: true },
          env: c.manifest.execution.env,
        });
        const log = `$ ${setup}\n${r.stdout}\n${r.stderr}\nexit=${r.exitCode}${r.timedOut ? ' (timed out)' : ''}\n`;
        if (logFile) await fs.writeFile(logFile, log).catch(() => undefined);
        if (r.exitCode !== 0) {
          await fs.rm(tmp, { recursive: true, force: true });
          throw new Error(`Dependency setup failed (exit ${r.exitCode}).\n${(r.stderr || r.stdout).slice(-4000)}`);
        }
        await fs.writeFile(path.join(tmp, '.oa', 'prepared.ok'), new Date().toISOString());
        await fs.rm(target, { recursive: true, force: true });
        await fs.rename(tmp, target);
        return target;
      })().finally(() => this.preparing.delete(key));
      this.preparing.set(key, p);
    }
    return this.preparing.get(key)!;
  }

  // ---------- lifecycle ----------

  async create(sectionAttemptId: string, challengeId: string) {
    const c = this.content.challenge(challengeId);
    const ws = await this.prisma.workspace.create({ data: { sectionAttemptId, challengeId, hostPath: '' } });
    const d = this.dirs(ws.id);
    await this.prisma.workspace.update({ where: { id: ws.id }, data: { hostPath: d.repo } });
    void this.provision(ws.id, c).catch(() => undefined);
    return ws;
  }

  private async provision(id: string, c: RegisteredChallenge) {
    const d = this.dirs(id);
    try {
      await fs.mkdir(d.base, { recursive: true });
      await this.ensureRuntime(c.manifest.runtime.image);
      const prepared = await this.prepareChallenge(c, d.log);
      await copyDir(prepared, d.repo);
      await fs.rm(path.join(d.repo, '.oa', 'prepared.ok'), { force: true });
      await copyDir(c.starterPath, d.pristine, (rel) => !isIgnored(rel));
      await fs.mkdir(path.join(d.repo, '.oa'), { recursive: true });
      await makeWorldWritable(d.repo);
      await this.prisma.workspace.update({ where: { id }, data: { status: 'READY' } });
      await this.start(id);
    } catch (e) {
      this.log.error(`Workspace ${id} failed: ${(e as Error).message}`);
      await this.prisma.workspace.update({ where: { id }, data: { status: 'FAILED', error: (e as Error).message.slice(0, 8000) } });
      throw e;
    }
  }

  async start(id: string) {
    const ws = await this.get(id);
    if (ws.status === 'PREPARING' || ws.status === 'FAILED') throw new ConflictException(`Workspace is ${ws.status}`);
    const c = this.content.challenge(ws.challengeId);
    if (ws.containerHandle && (await this.driver.isWorkspaceRunning(ws.containerHandle))) return ws;
    const handle = await this.driver.startWorkspace(ws.id, {
      image: c.manifest.runtime.image,
      hostDir: ws.hostPath,
      mountPoint: c.manifest.workspace.root,
      limits: c.manifest.resources,
      env: c.manifest.execution.env,
    });
    return this.prisma.workspace.update({ where: { id }, data: { containerHandle: handle, status: 'RUNNING' } });
  }

  async stop(id: string) {
    const ws = await this.get(id);
    if (ws.containerHandle) await this.driver.stopWorkspace(ws.containerHandle).catch(() => undefined);
    if (ws.status === 'RUNNING') await this.prisma.workspace.update({ where: { id }, data: { status: 'STOPPED' } });
  }

  async get(id: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id } });
    if (!ws) throw new NotFoundException('Workspace not found');
    return ws;
  }

  async details(id: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id }, include: { sectionAttempt: true } });
    if (!ws) throw new NotFoundException('Workspace not found');
    const c = this.content.challenge(ws.challengeId);
    const log = await fs.readFile(this.dirs(id).log, 'utf8').catch(() => undefined);
    return {
      id: ws.id,
      status: ws.status,
      error: ws.error,
      prepareLog: ws.status === 'FAILED' ? log : undefined,
      challengeId: ws.challengeId,
      sessionId: ws.sectionAttempt.sessionId,
      section: { id: ws.sectionAttempt.sectionId, status: ws.sectionAttempt.status, deadline: ws.sectionAttempt.deadline },
      driver: this.driver.name,
      manifest: {
        title: c.manifest.title,
        runtime: c.manifest.runtime,
        features: c.manifest.features,
        readOnly: c.manifest.readOnly,
        testCommand: c.manifest.execution.test,
        supportsTarget: !!c.manifest.execution.targetTemplate,
      },
    };
  }

  /** Rejects writes after the section ended. */
  private async assertWritable(id: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id }, include: { sectionAttempt: true } });
    if (!ws) throw new NotFoundException('Workspace not found');
    const sa = ws.sectionAttempt;
    if (sa.status !== 'IN_PROGRESS' || (sa.deadline && sa.deadline.getTime() < Date.now())) throw new ForbiddenException('This section is no longer in progress');
    if (ws.status !== 'RUNNING' && ws.status !== 'READY') throw new ConflictException(`Workspace is ${ws.status}`);
    return ws;
  }

  private isReadOnly(challengeId: string, rel: string) {
    const ro = this.content.challenge(challengeId).manifest.readOnly;
    const norm = rel.replace(/\\/g, '/').replace(/^\/+/, '');
    return ro.some((p) => (p.endsWith('/') ? norm.startsWith(p) : norm === p));
  }

  // ---------- files ----------

  async tree(id: string): Promise<FileNode[]> {
    const ws = await this.get(id);
    const walk = async (dir: string, rel: string): Promise<FileNode[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      const nodes: FileNode[] = [];
      for (const e of entries) {
        if (IGNORED_DIRS.has(e.name) || e.name === '.DS_Store') continue;
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) nodes.push({ name: e.name, path: r, type: 'dir', children: await walk(path.join(dir, e.name), r) });
        else if (e.isFile()) nodes.push({ name: e.name, path: r, type: 'file' });
      }
      return nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
    };
    return walk(ws.hostPath, '');
  }

  async readFile(id: string, rel: string) {
    const ws = await this.get(id);
    const abs = await safeResolve(ws.hostPath, rel);
    const st = await fs.stat(abs).catch(() => null);
    if (!st?.isFile()) throw new NotFoundException('File not found');
    if (st.size > MAX_FILE_BYTES) throw new BadRequestException('File too large to open in the editor');
    const buf = await fs.readFile(abs);
    if (buf.includes(0)) return { path: rel, binary: true, content: '', readOnly: true };
    return { path: rel, binary: false, content: buf.toString('utf8'), readOnly: this.isReadOnly(ws.challengeId, rel) };
  }

  async writeFile(id: string, rel: string, content: string) {
    const ws = await this.assertWritable(id);
    if (this.isReadOnly(ws.challengeId, rel)) throw new ForbiddenException('This file is read-only for the assessment');
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new BadRequestException('File too large');
    const abs = await safeResolve(ws.hostPath, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
    await fs.chmod(abs, 0o666).catch(() => undefined);
    return { ok: true, savedAt: new Date().toISOString() };
  }

  // ---------- tests ----------

  async runTests(id: string, target?: string, opts: { final?: boolean } = {}) {
    const ws = opts.final ? await this.get(id) : await this.assertWritable(id);
    if (this.running.has(id)) throw new ConflictException('Tests are already running');
    if (target && !/^[\w./:\-\[\]# *,]+$/.test(target)) throw new BadRequestException('Invalid test target');
    const c = this.content.challenge(ws.challengeId);
    const ex = c.manifest.execution;
    this.running.add(id);
    try {
      if (!ws.containerHandle || !(await this.driver.isWorkspaceRunning(ws.containerHandle))) await this.start(id);
      const fresh = await this.get(id);
      let command = ex.test;
      if (target && ex.targetTemplate) command = ex.targetTemplate.replace('{test}', ex.test).replace('{target}', target);
      const resultAbs = await safeResolve(ws.hostPath, ex.resultPath);
      await fs.rm(resultAbs, { recursive: true, force: true });
      const r = await this.driver.execInWorkspace(fresh.containerHandle!, ws.hostPath, command, ex.timeoutSeconds * 1000, ex.env);
      const tests = await this.collectResults(resultAbs, ex.resultFormat).catch((e) => {
        this.log.warn(`Could not parse results: ${(e as Error).message}`);
        return [] as TestCaseResult[];
      });
      if (tests.length === 0) {
        tests.push({
          name: 'test suite',
          status: r.exitCode === 0 && !r.timedOut ? 'passed' : 'error',
          message: r.timedOut ? `Timed out after ${ex.timeoutSeconds}s` : r.exitCode === 0 ? undefined : 'Suite failed before reporting individual tests — see output.',
        });
      }
      const result: TestRunResult = {
        passed: tests.filter((t) => t.status === 'passed').length,
        failed: tests.filter((t) => t.status === 'failed' || t.status === 'error').length,
        total: tests.filter((t) => t.status !== 'skipped').length,
        durationMs: r.durationMs,
        exitCode: r.exitCode,
        timedOut: r.timedOut,
        tests,
        output: `$ ${command}\n${r.stdout}${r.stderr ? `\n${r.stderr}` : ''}`.slice(-200_000),
      };
      const run = await this.prisma.testRun.create({
        data: {
          workspaceId: id,
          passed: result.passed,
          failed: result.failed,
          total: result.total,
          durationMs: result.durationMs,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          resultsJson: JSON.stringify(result.tests),
          output: result.output,
        },
      });
      return { id: run.id, createdAt: run.createdAt, target: target ?? null, ...result };
    } finally {
      this.running.delete(id);
    }
  }

  private async collectResults(abs: string, format: string): Promise<TestCaseResult[]> {
    if (format === 'exit-code') return [];
    const st = await fs.stat(abs).catch(() => null);
    if (!st) return [];
    if (format === 'jest-json') return parseJestJson(await fs.readFile(abs, 'utf8'));
    if (st.isDirectory()) {
      const files = (await fs.readdir(abs)).filter((f) => f.endsWith('.xml')).sort();
      return (await Promise.all(files.map(async (f) => parseJUnit(await fs.readFile(path.join(abs, f), 'utf8'))))).flat();
    }
    return parseJUnit(await fs.readFile(abs, 'utf8'));
  }

  async testRuns(id: string) {
    const runs = await this.prisma.testRun.findMany({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' }, take: 20 });
    return runs.map(({ resultsJson, output, ...r }) => r);
  }

  async latestRun(id: string) {
    const r = await this.prisma.testRun.findFirst({ where: { workspaceId: id }, orderBy: { createdAt: 'desc' } });
    return r && { ...r, tests: JSON.parse(r.resultsJson) as TestCaseResult[] };
  }

  // ---------- diff / reset / integrity ----------

  private async listFiles(root: string): Promise<Set<string>> {
    const out = new Set<string>();
    const walk = async (dir: string, rel: string) => {
      for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (IGNORED_DIRS.has(e.name)) continue;
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(path.join(dir, e.name), r);
        else if (e.isFile()) out.add(r);
      }
    };
    await walk(root, '');
    return out;
  }

  async diff(id: string) {
    const ws = await this.get(id);
    const d = this.dirs(id);
    const [before, after] = await Promise.all([this.listFiles(d.pristine), this.listFiles(ws.hostPath)]);
    const files: { path: string; status: 'modified' | 'added' | 'deleted'; patch: string }[] = [];
    const read = (p: string) => fs.readFile(p, 'utf8').catch(() => '');
    for (const f of [...new Set([...before, ...after])].sort()) {
      const a = before.has(f) ? await read(path.join(d.pristine, f)) : '';
      const b = after.has(f) ? await read(path.join(ws.hostPath, f)) : '';
      if (a === b) continue;
      files.push({
        path: f,
        status: !before.has(f) ? 'added' : !after.has(f) ? 'deleted' : 'modified',
        patch: createTwoFilesPatch(`a/${f}`, `b/${f}`, a, b, undefined, undefined, { context: 3 }),
      });
    }
    return { files, patch: files.map((f) => f.patch).join('\n') };
  }

  /** Restore protected (read-only) paths from the pristine copy — run before final grading. */
  async restoreProtected(id: string) {
    const ws = await this.get(id);
    const d = this.dirs(id);
    for (const p of this.content.challenge(ws.challengeId).manifest.readOnly) {
      if (p.startsWith('node_modules')) continue;
      const src = path.join(d.pristine, p);
      const dest = await safeResolve(ws.hostPath, p);
      await fs.rm(dest, { recursive: true, force: true });
      if (await exists(src)) await copyDir(src, dest);
    }
    await makeWorldWritable(ws.hostPath).catch(() => undefined);
  }

  /** Reset the repository to its original state (keeps installed dependencies). */
  async reset(id: string) {
    const ws = await this.assertWritable(id);
    const d = this.dirs(id);
    const keep = new Set([...IGNORED_DIRS]);
    for (const e of await fs.readdir(ws.hostPath)) if (!keep.has(e)) await fs.rm(path.join(ws.hostPath, e), { recursive: true, force: true });
    await copyDir(d.pristine, ws.hostPath);
    await makeWorldWritable(ws.hostPath);
    return { ok: true };
  }

  async coachPrompt(id: string) {
    const ws = await this.get(id);
    const c = this.content.challenge(ws.challengeId);
    const base = c.coachPromptPath ? await fs.readFile(c.coachPromptPath, 'utf8').catch(() => DEFAULT_COACH_PROMPT) : DEFAULT_COACH_PROMPT;
    const task = await this.content.taskMarkdown(ws.challengeId);
    const last = await this.latestRun(id);
    const failures = last?.tests.filter((t) => t.status === 'failed' || t.status === 'error').slice(0, 10) ?? [];
    const failText = failures.length
      ? failures.map((t) => `- ${t.name}\n${(t.message ?? '').split('\n').slice(0, 12).map((l) => `    ${l}`).join('\n')}`).join('\n')
      : '(no failing tests recorded yet — run the tests first)';
    return {
      prompt: `${base.trim()}\n\n---\n## Task\n${task.trim()}\n\n## Latest test run\n${last ? `${last.passed}/${last.total} passing` : 'not run yet'}\n\n## Failing tests\n${failText}\n`,
    };
  }
}
