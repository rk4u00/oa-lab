import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/** Locate the monorepo root (directory containing pnpm-workspace.yaml). */
function findRepoRoot(start: string): string {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export const REPO_ROOT = findRepoRoot(__dirname);
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const resolve = (p: string) => (path.isAbsolute(p) ? p : path.join(REPO_ROOT, p));

export const env = {
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? '127.0.0.1',
  /** When the API itself runs in Docker: the host path that `dataDir` is bind-mounted from (for sibling sandbox containers). */
  hostDataDir: process.env.OA_HOST_DATA_DIR || undefined,
  importsDir: resolve(process.env.OA_IMPORTS_DIR ?? 'imports'),
  /** Off by default: practice repos ship pre-imported under content/imported. Set true to import content/sources.json at boot. */
  autoImport: process.env.OA_AUTO_IMPORT === 'true',
  autoBuildRuntimes: (process.env.OA_AUTO_BUILD_RUNTIMES ?? 'true') !== 'false',
  contentDir: resolve(process.env.OA_CONTENT_DIR ?? 'content'),
  dataDir: resolve(process.env.OA_DATA_DIR ?? 'data'),
  driver: (process.env.OA_EXECUTION_DRIVER ?? 'docker') as 'docker' | 'local',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
};

