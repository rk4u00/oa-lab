import { spawn } from 'node:child_process';

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface ExecOptions {
  cwd?: string;
  stdin?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  maxOutputBytes?: number;
}

/** Spawn a process with a hard timeout and bounded output capture. */
export function exec(cmd: string, args: string[], opts: ExecOptions = {}): Promise<ExecResult> {
  const max = opts.maxOutputBytes ?? 1_000_000;
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const cap = (buf: string, chunk: Buffer) => (buf.length < max ? buf + chunk.toString('utf8').slice(0, max - buf.length) : buf);
    child.stdout.on('data', (c: Buffer) => (stdout = cap(stdout, c)));
    child.stderr.on('data', (c: Buffer) => (stderr = cap(stderr, c)));
    const timer = opts.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          try {
            if (child.pid) process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }, opts.timeoutMs)
      : undefined;
    child.on('error', (err) => {
      stderr += String(err);
    });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut, durationMs: Date.now() - start });
    });
    child.stdin.on('error', () => undefined);
    if (opts.stdin !== undefined) child.stdin.write(opts.stdin);
    child.stdin.end();
  });
}
