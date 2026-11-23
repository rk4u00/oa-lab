import type { FileNode, TestCaseResult } from '@oa-lab/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, `Cannot reach the OA Lab API at ${API_URL}. Is \`pnpm dev\` running?`);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message;
    throw new ApiError(res.status, typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : JSON.stringify(msg ?? data ?? res.statusText));
  }
  return data as T;
}

export type Origin = 'builtin' | 'imported' | 'practice';
export type SectionStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'SKIPPED';
export type WorkspaceStatus = 'PREPARING' | 'READY' | 'RUNNING' | 'STOPPED' | 'FAILED';

export interface Health { ok: boolean; driver: 'docker' | 'local'; docker: boolean | null }

export interface Runtime { language: string; framework?: string; version?: string; image: string }

export interface AssessmentSummary {
  id: string;
  company: string;
  title: string;
  subtitle?: string;
  description: string;
  aiAssistance: 'allowed' | 'coach-only' | 'disabled';
  disclaimer?: string;
  origin: Origin;
  totalMinutes: number;
  sections: { id: string; kind: 'debugging'; title: string; durationMinutes: number; challenges: string[] }[];
}

export interface ChallengeSummary {
  id: string;
  title: string;
  company: string;
  difficulty: 'easy' | 'medium' | 'hard';
  durationMinutes: number;
  description: string;
  runtime: Runtime;
  features: { terminal: boolean; editor: boolean; aiCoach: boolean; gitDiff: boolean };
  origin: 'builtin' | 'imported';
  provenance: { source?: string; url?: string; license?: string; author?: string };
}

export interface SessionChallenge { id: string; title: string; workspaceId: string | null; workspaceStatus: WorkspaceStatus | null; score: number | null }
export interface SessionSection {
  id: string;
  kind: string;
  title: string;
  durationMinutes?: number;
  status: SectionStatus;
  startedAt: string | null;
  deadline: string | null;
  submittedAt: string | null;
  score: number | null;
  challenges: SessionChallenge[];
}
export interface Session {
  id: string;
  status: 'CREATED' | 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'ABANDONED';
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  serverTime: string;
  assessment: { id: string; title: string; subtitle?: string; aiAssistance: string; disclaimer?: string };
  sections: SessionSection[];
}
export interface SessionListItem { id: string; assessmentId: string; title: string; status: Session['status']; createdAt: string; submittedAt: string | null; score: number | null }

export interface WorkspaceDetails {
  id: string;
  status: WorkspaceStatus;
  error: string | null;
  prepareLog?: string;
  challengeId: string;
  sessionId: string;
  section: { id: string; status: SectionStatus; deadline: string | null };
  driver: 'docker' | 'local';
  manifest: { title: string; runtime: Runtime; features: ChallengeSummary['features']; readOnly: string[]; testCommand: string; supportsTarget: boolean };
}

export interface FileContent { path: string; binary: boolean; content: string; readOnly: boolean }
export interface TestRun {
  id?: string;
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  timedOut: boolean;
  exitCode?: number | null;
  tests: TestCaseResult[];
  output: string;
  createdAt?: string;
  target?: string | null;
}
export interface DiffFile { path: string; status: 'modified' | 'added' | 'deleted'; patch: string }
export interface Diff { files: DiffFile[]; patch: string }

export interface ImportResult { repoDir: string; assessmentId: string; challenges: { id: string; title: string; kind: string; path: string }[] }

export interface Results {
  session: Session;
  submissions: {
    sectionId: string;
    challengeId: string;
    score: number;
    diff: string;
    timeSpentMs: number | null;
    testRun: { passed: number; failed: number; total: number; tests: TestCaseResult[]; output: string } | null;
  }[];
  testRunsByWorkspace: Record<string, number>;
  events: { type: string; at: string; payload: unknown }[];
}

const enc = encodeURIComponent;

export const api = {
  health: () => req<Health>('/health'),
  assessments: () => req<AssessmentSummary[]>('/assessments'),
  challenges: () => req<{ challenges: ChallengeSummary[]; problems: string[] }>('/challenges'),
  challenge: (id: string) => req<ChallengeSummary & { task: string }>(`/challenges/${enc(id)}`),
  importRepo: (source: string, company?: string) => req<ImportResult>('/repositories/import', { method: 'POST', json: { source, company } }),
  createSession: (assessmentId: string) => req<Session>('/sessions', { method: 'POST', json: { assessmentId } }),
  sessions: () => req<SessionListItem[]>('/sessions'),
  session: (id: string) => req<Session>(`/sessions/${enc(id)}`),
  startSection: (id: string, sectionId: string) => req<Session>(`/sessions/${enc(id)}/sections/${enc(sectionId)}/start`, { method: 'POST' }),
  submitSection: (id: string, sectionId: string) => req<Session>(`/sessions/${enc(id)}/sections/${enc(sectionId)}/submit`, { method: 'POST' }),
  retrySection: (id: string, sectionId: string) => req<Session>(`/sessions/${enc(id)}/sections/${enc(sectionId)}/retry`, { method: 'POST' }),
  submitSession: (id: string) => req<Session>(`/sessions/${enc(id)}/submit`, { method: 'POST' }),
  abandonSession: (id: string) => req<Session>(`/sessions/${enc(id)}/abandon`, { method: 'POST' }),
  results: (id: string) => req<Results>(`/sessions/${enc(id)}/results`),
  workspace: (id: string) => req<WorkspaceDetails>(`/workspaces/${enc(id)}`),
  startWorkspace: (id: string) => req<WorkspaceDetails>(`/workspaces/${enc(id)}/start`, { method: 'POST' }),
  files: (id: string) => req<FileNode[]>(`/workspaces/${enc(id)}/files`),
  file: (id: string, path: string) => req<FileContent>(`/workspaces/${enc(id)}/file?path=${enc(path)}`),
  saveFile: (id: string, path: string, content: string) => req<{ ok: boolean; savedAt: string }>(`/workspaces/${enc(id)}/file`, { method: 'PUT', json: { path, content } }),
  runTests: (id: string, target?: string) => req<TestRun>(`/workspaces/${enc(id)}/run-tests`, { method: 'POST', json: target ? { target } : {} }),
  latestRun: (id: string) => req<(Omit<TestRun, 'tests'> & { tests: TestCaseResult[] }) | null>(`/workspaces/${enc(id)}/test-runs/latest`),
  diff: (id: string) => req<Diff>(`/workspaces/${enc(id)}/diff`),
  reset: (id: string) => req<{ ok: boolean }>(`/workspaces/${enc(id)}/reset`, { method: 'POST' }),
  coach: (id: string) => req<{ prompt: string }>(`/workspaces/${enc(id)}/coach`),
  definition: (id: string, symbol: string, path: string, line?: number) =>
    req<NavLocation[]>(`/workspaces/${enc(id)}/definition?symbol=${enc(symbol)}&path=${enc(path)}${line ? `&line=${line}` : ''}`),
  references: (id: string, symbol: string, path: string) => req<NavLocation[]>(`/workspaces/${enc(id)}/references?symbol=${enc(symbol)}&path=${enc(path)}`),
};

export interface NavLocation { path: string; line: number; column: number; endColumn: number; preview: string; kind: string }

export function frameworkLabel(rt?: Runtime) {
  const f = (rt?.framework ?? rt?.language ?? '').toLowerCase();
  if (f.includes('django')) return 'Django';
  if (f.includes('spring')) return 'Spring Boot';
  if (f.includes('express')) return 'Express';
  if (f.includes('react')) return 'React';
  if (f === 'node' || f.includes('javascript')) return 'Node.js';
  if (f.includes('python')) return 'Python';
  if (f.includes('java')) return 'Java';
  if (f.includes('cmake') || f === 'cpp' || f === 'c++' || rt?.language === 'cpp') return 'C++';
  return rt?.framework ?? rt?.language ?? 'Other';
}

export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
