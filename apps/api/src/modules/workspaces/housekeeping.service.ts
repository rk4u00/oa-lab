import fs from 'node:fs/promises';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { exec } from '@oa-lab/execution-engine';
import { EXECUTION_DRIVER, ExecutionDriver } from '../../common/driver.provider';
import { env } from '../../common/env';
import { PrismaService } from '../../common/prisma.service';
import { WorkspacesService } from './workspaces.service';

const IDLE_CHECK_MS = 60_000;
const CLEANUP_CHECK_MS = 60 * 60_000;

/**
 * Keeps a long-running OA Lab cheap:
 *  - idle sandboxes are stopped (they are recreated on the next request, files are kept on disk);
 *  - finished attempts' files are deleted after the retention period (scores/diffs stay in the DB);
 *  - containers left over from a crash or restart are removed at startup.
 */
@Injectable()
export class HousekeepingService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(HousekeepingService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaces: WorkspacesService,
    @Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver,
  ) {}

  onApplicationBootstrap() {
    void this.removeOrphanContainers().catch((e) => this.log.warn(`Orphan cleanup failed: ${(e as Error).message}`));
    void this.cleanupOldAttempts().catch((e) => this.log.warn(`Cleanup failed: ${(e as Error).message}`));
    if (env.idleStopMinutes > 0) this.timers.push(setInterval(() => void this.stopIdle().catch(() => undefined), IDLE_CHECK_MS));
    if (env.retentionDays > 0) this.timers.push(setInterval(() => void this.cleanupOldAttempts().catch(() => undefined), CLEANUP_CHECK_MS));
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  /** Stop sandboxes nobody has touched for `idleStopMinutes`. */
  async stopIdle() {
    const cutoff = Date.now() - env.idleStopMinutes * 60_000;
    const running = await this.prisma.workspace.findMany({ where: { status: 'RUNNING' } });
    for (const ws of running) {
      if (this.workspaces.lastActivity(ws.id) > cutoff) continue;
      this.log.log(`Stopping idle sandbox for workspace ${ws.id} (no activity for ${env.idleStopMinutes} min)`);
      await this.workspaces.stop(ws.id).catch(() => undefined);
    }
  }

  /** Delete files of attempts that ended more than `retentionDays` ago. */
  async cleanupOldAttempts() {
    if (env.retentionDays <= 0) return;
    const cutoff = new Date(Date.now() - env.retentionDays * 24 * 3600_000);
    const old = await this.prisma.workspace.findMany({
      where: {
        status: { not: 'ARCHIVED' },
        createdAt: { lt: cutoff },
        sectionAttempt: { status: { not: 'IN_PROGRESS' } },
      },
    });
    for (const ws of old) {
      await this.workspaces.stop(ws.id).catch(() => undefined);
      await this.workspaces.deleteFiles(ws.id).catch(() => undefined);
    }
    // Directories with no database row at all (e.g. the DB was reset).
    const known = new Set((await this.prisma.workspace.findMany({ select: { id: true } })).map((w) => w.id));
    const dirs = await fs.readdir(this.workspaces.workspacesRoot()).catch(() => [] as string[]);
    const orphans = dirs.filter((d) => !known.has(d));
    for (const d of orphans) await fs.rm(`${this.workspaces.workspacesRoot()}/${d}`, { recursive: true, force: true });
    if (old.length || orphans.length) this.log.log(`Cleaned up ${old.length} old attempt(s) and ${orphans.length} orphaned folder(s)`);
  }

  /** Remove sandbox containers whose workspace is no longer active. */
  async removeOrphanContainers() {
    if (this.driver.name !== 'docker') return;
    const r = await exec('docker', ['ps', '-a', '--filter', 'label=oa-lab=workspace', '--format', '{{.Names}}'], { timeoutMs: 15_000 });
    if (r.exitCode !== 0) return;
    const names = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    const active = await this.prisma.workspace.findMany({
      where: { status: 'RUNNING', sectionAttempt: { status: 'IN_PROGRESS' } },
      select: { containerHandle: true },
    });
    const keep = new Set(active.map((w) => w.containerHandle));
    const stale = names.filter((n) => !keep.has(n));
    for (const n of stale) await this.driver.stopWorkspace(n).catch(() => undefined);
    if (stale.length) this.log.log(`Removed ${stale.length} leftover sandbox container(s)`);
  }
}
