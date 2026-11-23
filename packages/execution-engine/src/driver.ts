import { exec, ExecResult } from './process';

export interface SandboxLimits {
  memoryMb: number;
  cpus: number;
  pids: number;
  network: boolean;
}

export const DEFAULT_LIMITS: SandboxLimits = { memoryMb: 1024, cpus: 1, pids: 256, network: false };

export interface RunInSandboxOptions {
  image: string;
  /** Absolute host path mounted at `mountPoint`. */
  hostDir: string;
  mountPoint?: string;
  command: string;
  stdin?: string;
  timeoutMs: number;
  limits?: Partial<SandboxLimits>;
  env?: Record<string, string>;
}

/**
 * Execution driver. `docker` is the sandboxed default; `local` runs commands directly on the
 * host and exists ONLY for developing OA Lab itself on machines without Docker.
 */
export interface ExecutionDriver {
  readonly name: 'docker' | 'local';
  /** One-shot command in a fresh, throw-away sandbox. */
  run(opts: RunInSandboxOptions): Promise<ExecResult>;
  /** Start a long-lived workspace container. Returns a container handle (or host path for local). */
  startWorkspace(id: string, opts: Omit<RunInSandboxOptions, 'command' | 'timeoutMs' | 'stdin'>): Promise<string>;
  execInWorkspace(handle: string, hostDir: string, command: string, timeoutMs: number, env?: Record<string, string>): Promise<ExecResult>;
  stopWorkspace(handle: string): Promise<void>;
  isWorkspaceRunning(handle: string): Promise<boolean>;
}

const SANDBOX_USER = '1000:1000';

function limitArgs(l: SandboxLimits): string[] {
  return [
    '--memory', `${l.memoryMb}m`,
    '--memory-swap', `${l.memoryMb}m`,
    '--cpus', String(l.cpus),
    '--pids-limit', String(l.pids),
    '--network', l.network ? (process.env.OA_DOCKER_PREPARE_NETWORK || 'bridge') : 'none',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--read-only',
    '--tmpfs', '/tmp:rw,exec,nosuid,size=256m',
    '--tmpfs', '/home/runner:rw,nosuid,size=512m,uid=1000,gid=1000,mode=0755',
    '--user', SANDBOX_USER,
    '-e', 'HOME=/home/runner',
  ];
}

function envArgs(env?: Record<string, string>): string[] {
  return Object.entries(env ?? {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
}

/** Forward host proxy settings to networked (preparation) containers only. */
function proxyArgs(l: SandboxLimits): string[] {
  if (!l.network) return [];
  return ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy']
    .filter((k) => process.env[k])
    .flatMap((k) => ['-e', `${k}=${process.env[k]}`]);
}

export interface PathMap {
  from: string;
  to: string;
}

export class DockerDriver implements ExecutionDriver {
  readonly name = 'docker' as const;

  /** pathMap translates paths when the orchestrator itself runs in a container (sibling containers need host paths). */
  constructor(private readonly pathMap?: PathMap) {}

  private hostPath(p: string) {
    const m = this.pathMap;
    return m && (p === m.from || p.startsWith(m.from + '/')) ? m.to + p.slice(m.from.length) : p;
  }

  run(o: RunInSandboxOptions) {
    const limits = { ...DEFAULT_LIMITS, ...o.limits };
    const mount = o.mountPoint ?? '/workspace';
    return exec(
      'docker',
      ['run', '--rm', '-i', ...limitArgs(limits), ...proxyArgs(limits), ...envArgs(o.env), '-v', `${this.hostPath(o.hostDir)}:${mount}`, '-w', mount, o.image, 'sh', '-c', o.command],
      { stdin: o.stdin, timeoutMs: o.timeoutMs + 5000 },
    ).then((r) => ({ ...r, timedOut: r.timedOut || r.exitCode === 124 }));
  }

  async startWorkspace(id: string, o: Omit<RunInSandboxOptions, 'command' | 'timeoutMs' | 'stdin'>) {
    const limits = { ...DEFAULT_LIMITS, ...o.limits };
    const mount = o.mountPoint ?? '/workspace';
    const name = `oa-ws-${id}`;
    await exec('docker', ['rm', '-f', name]);
    const r = await exec('docker', [
      'run', '-d', '--name', name, '--label', 'oa-lab=workspace', '--init',
      ...limitArgs(limits), ...envArgs(o.env), '-v', `${this.hostPath(o.hostDir)}:${mount}`, '-w', mount, o.image, 'sleep', 'infinity',
    ], { timeoutMs: 60_000 });
    if (r.exitCode !== 0) throw new Error(`Failed to start workspace container: ${r.stderr || r.stdout}`);
    return name;
  }

  execInWorkspace(handle: string, _hostDir: string, command: string, timeoutMs: number, env?: Record<string, string>) {
    const secs = Math.ceil(timeoutMs / 1000);
    return exec('docker', ['exec', ...envArgs(env), handle, 'timeout', '-s', 'KILL', String(secs), 'sh', '-c', command], {
      timeoutMs: timeoutMs + 5000,
    }).then((r) => ({ ...r, timedOut: r.timedOut || r.exitCode === 137 }));
  }

  async stopWorkspace(handle: string) {
    await exec('docker', ['rm', '-f', handle]);
  }

  async isWorkspaceRunning(handle: string) {
    const r = await exec('docker', ['inspect', '-f', '{{.State.Running}}', handle]);
    return r.stdout.trim() === 'true';
  }
}

/** UNSAFE: runs code on the host. Development fallback only. */
export class LocalDriver implements ExecutionDriver {
  readonly name = 'local' as const;

  run(o: RunInSandboxOptions) {
    return exec('sh', ['-c', o.command], { cwd: o.hostDir, stdin: o.stdin, timeoutMs: o.timeoutMs, env: o.env });
  }
  async startWorkspace(_id: string, o: Omit<RunInSandboxOptions, 'command' | 'timeoutMs' | 'stdin'>) {
    return `local:${o.hostDir}`;
  }
  execInWorkspace(_handle: string, hostDir: string, command: string, timeoutMs: number, env?: Record<string, string>) {
    return exec('sh', ['-c', command], { cwd: hostDir, timeoutMs, env });
  }
  async stopWorkspace() {}
  async isWorkspaceRunning() {
    return true;
  }
}

export function createDriver(name = process.env.OA_EXECUTION_DRIVER ?? 'docker', pathMap?: PathMap): ExecutionDriver {
  if (name === 'local') return new LocalDriver();
  return new DockerDriver(pathMap);
}

/** Make sure a runtime image exists, building it from a Dockerfile when missing. */
export async function ensureImage(image: string, dockerfile: string, context: string, onLog?: (line: string) => void): Promise<void> {
  const has = await exec('docker', ['image', 'inspect', image], { timeoutMs: 10_000 });
  if (has.exitCode === 0) return;
  onLog?.(`Building runtime image ${image} (first start only, may take a few minutes)…`);
  const r = await exec('docker', ['build', '-t', image, '-f', dockerfile, context], { timeoutMs: 30 * 60_000, env: { DOCKER_BUILDKIT: '1' } });
  if (r.exitCode !== 0) throw new Error(`Building ${image} failed:\n${(r.stderr || r.stdout).slice(-3000)}`);
  onLog?.(`Built ${image}`);
}

export async function dockerAvailable(): Promise<boolean> {
  const r = await exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeoutMs: 5000 });
  return r.exitCode === 0;
}
