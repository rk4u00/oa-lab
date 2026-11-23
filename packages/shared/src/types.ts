export type SessionStatus = 'CREATED' | 'READY' | 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED' | 'ABANDONED';

export interface TestCaseResult {
  name: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  durationMs?: number;
  message?: string;
}

export interface TestRunResult {
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  tests: TestCaseResult[];
  output: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileNode[];
}
