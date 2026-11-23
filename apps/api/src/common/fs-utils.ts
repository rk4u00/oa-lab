import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

export const IGNORED_DIRS = new Set(['node_modules', '.git', '__pycache__', '.pytest_cache', '.oa', '.venv', 'target', 'dist', '.next', 'build', 'cmake-build-debug', 'cmake-build-release']);

/** Resolve `rel` inside `root`, rejecting traversal and symlink escapes. */
export async function safeResolve(root: string, rel: string): Promise<string> {
  if (typeof rel !== 'string' || rel.includes('\0')) throw new BadRequestException('Invalid path');
  const abs = path.resolve(root, rel.replace(/^\/+/, ''));
  const rootReal = await fs.realpath(root);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new ForbiddenException('Path escapes workspace');
  // Check the deepest existing ancestor's real path.
  let probe = abs;
  while (true) {
    try {
      const real = await fs.realpath(probe);
      if (real !== rootReal && !real.startsWith(rootReal + path.sep)) throw new ForbiddenException('Path escapes workspace');
      break;
    } catch (e: any) {
      if (e instanceof ForbiddenException) throw e;
      const parent = path.dirname(probe);
      if (parent === probe) break;
      probe = parent;
    }
  }
  return abs;
}

export async function copyDir(src: string, dest: string, filter?: (rel: string) => boolean) {
  await fs.cp(src, dest, {
    recursive: true,
    verbatimSymlinks: true,
    filter: filter ? (s) => filter(path.relative(src, s)) : undefined,
  });
}

/** Make a tree writable by the sandbox user (uid 1000) on Linux hosts. */
export async function makeWorldWritable(dir: string) {
  const walk = async (p: string) => {
    const st = await fs.lstat(p);
    if (st.isSymbolicLink()) return;
    await fs.chmod(p, st.isDirectory() ? 0o777 : (st.mode & 0o111 ? 0o777 : 0o666));
    if (st.isDirectory()) for (const e of await fs.readdir(p)) await walk(path.join(p, e));
  };
  await walk(dir);
}

export async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
