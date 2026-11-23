/**
 * Repository importer: clones (or copies) a practice repository into `imports/`, detects every
 * runnable project inside it (Django, Spring Boot/Maven, Node.js), and writes an
 * `oa-challenge.json` manifest per project plus an `assessment.json` grouping them.
 *
 * Imported code stays in the git-ignored `imports/` directory: third-party repositories are
 * never redistributed by OA Lab. Nothing from the imported repository is executed here —
 * dependency setup and tests run later inside the sandbox.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AssessmentDefinition, ChallengeManifest } from '@oa-lab/shared';

const run = promisify(execFile);
const SKIP = new Set(['node_modules', '.git', '__pycache__', 'target', 'venv', '.venv', 'dist', 'build', '.oa-lab', '.idea', '.vscode']);

export interface ImportOptions {
  source: string; // git URL or local directory
  importsDir: string;
  company?: string;
  name?: string;
}

export interface DetectedProject {
  rel: string;
  kind: 'django' | 'maven' | 'node';
}

const slug = (s: string, max = 60) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max);
const exists = (p: string) => fs.access(p).then(() => true, () => false);

export function repoSlugFromSource(source: string) {
  const m = source.match(/github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/);
  if (m) return slug(`${m[1]}-${m[2]}`);
  return slug(path.basename(path.resolve(source)));
}

export function normalizeGitUrl(source: string) {
  const m = source.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/#?].*)?$/);
  return m ? `https://github.com/${m[1]}/${m[2]}.git` : source;
}

export async function detectProjects(root: string): Promise<DetectedProject[]> {
  const found: DetectedProject[] = [];
  const walk = async (dir: string, depth: number) => {
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const rel = path.relative(root, dir) || '.';
    if (names.includes('manage.py')) return void found.push({ rel, kind: 'django' });
    if (names.includes('pom.xml')) return void found.push({ rel, kind: 'maven' });
    if (names.includes('package.json')) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return void found.push({ rel, kind: 'node' });
      } catch {
        /* ignore malformed package.json */
      }
    }
    if (depth >= 4) return;
    for (const n of names) {
      if (SKIP.has(n) || n.startsWith('.')) continue;
      const p = path.join(dir, n);
      if ((await fs.lstat(p)).isDirectory()) await walk(p, depth + 1);
    }
  };
  await walk(root, 0);
  return found;
}

async function djangoSettingsModule(dir: string) {
  const src = await fs.readFile(path.join(dir, 'manage.py'), 'utf8').catch(() => '');
  return src.match(/DJANGO_SETTINGS_MODULE['"]\s*,\s*['"]([\w.]+)['"]/)?.[1];
}

async function readme(dir: string, stopAt: string): Promise<string | undefined> {
  let d = dir;
  while (true) {
    for (const n of ['README.md', 'readme.md', 'README.MD', 'STUDENT_GUIDE.md']) if (await exists(path.join(d, n))) return path.join(d, n);
    if (d === stopAt || d === path.dirname(d)) return undefined;
    d = path.dirname(d);
  }
}

async function findUp(dir: string, stopAt: string, names: string[]) {
  let d = dir;
  while (true) {
    for (const n of names) if (await exists(path.join(d, n))) return path.join(d, n);
    if (d === stopAt || d === path.dirname(d)) return undefined;
    d = path.dirname(d);
  }
}

async function titleFrom(readmePath: string | undefined, fallback: string) {
  if (readmePath) {
    const h = (await fs.readFile(readmePath, 'utf8')).match(/^#\s+(.+)$/m)?.[1];
    if (h) return h.replace(/[*_`]/g, '').trim();
  }
  return fallback.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function durationFrom(readmePath: string | undefined) {
  if (!readmePath) return 60;
  const m = (await fs.readFile(readmePath, 'utf8')).match(/(\d{2,3})\s*(?:-|\s)?min(?:ute)?s?\b/i);
  const n = m ? Number(m[1]) : 60;
  return n >= 15 && n <= 180 ? n : 60;
}

async function testDirs(dir: string, kind: DetectedProject['kind']) {
  const ro: string[] = [];
  const candidates = kind === 'maven' ? ['src/test/'] : ['tests/', 'test/', '__tests__/'];
  for (const c of candidates) if (await exists(path.join(dir, c))) ro.push(c);
  if (kind === 'django') {
    for (const n of await fs.readdir(dir)) {
      if (await exists(path.join(dir, n, 'tests.py'))) ro.push(`${n}/tests.py`);
      if (await exists(path.join(dir, n, 'tests'))) ro.push(`${n}/tests/`);
    }
    if (await exists(path.join(dir, 'conftest.py'))) ro.push('conftest.py');
    if (await exists(path.join(dir, 'pytest.ini'))) ro.push('pytest.ini');
  }
  return ro;
}

async function manifestFor(repoRoot: string, project: DetectedProject, repoSlug: string, company: string, sourceUrl: string): Promise<{ manifest: ChallengeManifest; challengeDir: string }> {
  const dir = path.join(repoRoot, project.rel);
  // Full project path keeps ids unique (e.g. t1/django vs t1/springboot).
  const id = slug(`${repoSlug.split('-').slice(-3).join('-')}-${project.rel === '.' ? 'root' : project.rel}`, 120);
  const challengeDir = path.join(repoRoot, '.oa-lab', id);
  const rd = await readme(dir, repoRoot);
  const coach = await findUp(dir, repoRoot, ['AI_COACH_PROMPT.md']);
  const relFromChallenge = (p: string) => path.relative(challengeDir, p);
  const parentName = project.rel === '.' ? repoSlug : project.rel.split(path.sep).slice(-2).join(' ');
  const baseTitle = await titleFrom(rd, parentName);
  const label = { django: 'Django', maven: 'Spring Boot', node: 'Node.js' }[project.kind];
  const title = baseTitle.toLowerCase().includes(label.toLowerCase()) ? baseTitle : `${baseTitle} (${label})`;

  let runtime: ChallengeManifest['runtime'];
  let execution: ChallengeManifest['execution'];
  if (project.kind === 'django') {
    const ds = await djangoSettingsModule(dir);
    const hasReq = await exists(path.join(dir, 'requirements.txt'));
    runtime = { language: 'python', framework: 'django', image: 'oa-lab-python:latest' };
    execution = {
      setup: hasReq ? 'pip install -q --disable-pip-version-check --target .oa/pydeps -r requirements.txt' : undefined,
      test:
        'mkdir -p .oa && python -m pytest -q -p no:cacheprovider' +
        (ds ? ` --ds=${ds}` : '') +
        ` -o "python_files=tests.py test_*.py *_tests.py" --junitxml=.oa/results.xml`,
      targetTemplate: '{test} {target}',
      resultFormat: 'junit',
      resultPath: '.oa/results.xml',
      timeoutSeconds: 180,
      env: { PYTHONPATH: '/workspace/.oa/pydeps', PYTHONDONTWRITEBYTECODE: '1' },
    };
  } else if (project.kind === 'maven') {
    runtime = { language: 'java', framework: 'spring-boot', image: 'oa-lab-java:latest' };
    const mvn = 'mvn -B -q -Dmaven.repo.local=/workspace/.oa/m2 -Dstyle.color=never';
    execution = {
      // Run the build once with network so every plugin/dependency (incl. surefire providers) is cached.
      setup: `oa-maven-settings > /tmp/oa-settings.xml && ${mvn} -s /tmp/oa-settings.xml -Dmaven.test.failure.ignore=true test`,
      test: `rm -rf target/surefire-reports && ${mvn} -o -Dmaven.test.failure.ignore=true test`,
      targetTemplate: '{test} -Dtest={target} -Dsurefire.failIfNoSpecifiedTests=false',
      resultFormat: 'junit',
      resultPath: 'target/surefire-reports',
      timeoutSeconds: 300,
      env: {},
    };
  } else {
    const pkg = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
    const usesJest = /\bjest\b/.test(pkg.scripts.test) || !!(pkg.devDependencies?.jest || pkg.dependencies?.jest);
    const lock = await exists(path.join(dir, 'package-lock.json'));
    runtime = { language: 'javascript', framework: pkg.dependencies?.express ? 'express' : 'node', image: 'oa-lab-node:latest' };
    execution = {
      setup: `${lock ? 'npm ci' : 'npm install'} --no-audit --no-fund --loglevel=error`,
      test: usesJest
        ? 'mkdir -p .oa && npx --no-install jest --runInBand --ci --json --outputFile=.oa/results.json'
        : 'mkdir -p .oa && npm test',
      targetTemplate: usesJest ? '{test} {target}' : undefined,
      resultFormat: usesJest ? 'jest-json' : 'exit-code',
      resultPath: '.oa/results.json',
      timeoutSeconds: 180,
      env: { CI: 'true' },
    };
  }

  const manifest: ChallengeManifest = {
    id,
    title,
    company,
    category: 'repository-debugging',
    difficulty: 'medium',
    durationMinutes: await durationFrom(rd),
    description: `Imported ${label} practice repository (${project.rel === '.' ? repoSlug : project.rel}). Read the task, make the failing tests pass without editing them.`,
    taskFile: rd ? relFromChallenge(rd) : 'TASK.md',
    coachPromptFile: coach ? relFromChallenge(coach) : undefined,
    starterDir: relFromChallenge(dir),
    runtime,
    workspace: { root: '/workspace' },
    execution,
    resources: { memoryMb: project.kind === 'maven' ? 2048 : 1024, cpus: project.kind === 'maven' ? 2 : 1, pids: 512, network: false },
    scoring: { type: 'test-pass-rate', maxScore: 100 },
    features: { terminal: true, editor: true, aiCoach: true, gitDiff: true },
    readOnly: await testDirs(dir, project.kind),
    provenance: { source: 'imported', url: sourceUrl, license: 'No license file found — kept local, not redistributed' },
  };
  return { manifest, challengeDir };
}

export interface ImportResult {
  repoDir: string;
  assessmentId: string;
  challenges: { id: string; title: string; kind: string; path: string }[];
}

export async function importRepository(opts: ImportOptions): Promise<ImportResult> {
  const repoSlug = opts.name ? slug(opts.name) : repoSlugFromSource(opts.source);
  const repoDir = path.join(opts.importsDir, repoSlug);
  await fs.mkdir(opts.importsDir, { recursive: true });
  const isLocal = await exists(opts.source);
  if (await exists(repoDir)) {
    if (!isLocal && (await exists(path.join(repoDir, '.git')))) await run('git', ['-C', repoDir, 'pull', '--ff-only', '-q']).catch(() => undefined);
  } else if (isLocal) {
    await fs.cp(path.resolve(opts.source), repoDir, { recursive: true, filter: (s) => !s.includes(`${path.sep}node_modules`) });
  } else {
    await run('git', ['clone', '--depth', '1', '-q', normalizeGitUrl(opts.source), repoDir], { timeout: 180_000 });
  }

  const projects = await detectProjects(repoDir);
  if (projects.length === 0) throw new Error('No Django, Spring Boot (Maven) or Node.js project with tests was found in this repository.');
  await fs.rm(path.join(repoDir, '.oa-lab'), { recursive: true, force: true });
  const company = opts.company ?? 'amazon';
  const sourceUrl = isLocal ? path.resolve(opts.source) : normalizeGitUrl(opts.source).replace(/\.git$/, '');
  const challenges: ImportResult['challenges'] = [];
  for (const p of projects) {
    const { manifest, challengeDir } = await manifestFor(repoDir, p, repoSlug, company, sourceUrl);
    await fs.mkdir(challengeDir, { recursive: true });
    await fs.writeFile(path.join(challengeDir, 'oa-challenge.json'), JSON.stringify(manifest, null, 2));
    challenges.push({ id: manifest.id, title: manifest.title, kind: p.kind, path: p.rel });
  }

  const assessment: AssessmentDefinition = {
    id: `${repoSlug}-set`,
    company,
    title: await titleFrom(await readme(repoDir, repoDir), repoSlug),
    subtitle: `Imported from ${sourceUrl}`,
    description: `All ${challenges.length} debugging projects detected in this repository, one timed section each.`,
    aiAssistance: 'allowed',
    disclaimer: 'Third-party practice material imported for local use. Not affiliated with any company.',
    sections: challenges.map((c, i) => ({ id: `s${i + 1}-${c.id}`.slice(0, 80), kind: 'debugging' as const, title: c.title, durationMinutes: 60, challenges: [c.id] })),
  };
  await fs.writeFile(path.join(repoDir, '.oa-lab', 'assessment.json'), JSON.stringify(assessment, null, 2));
  return { repoDir, assessmentId: assessment.id, challenges };
}
