/**
 * OA Lab CLI.
 *   pnpm oa import <github-url | local-path> [--company amazon]
 *   pnpm oa list
 */
import path from 'node:path';
import { importRepository } from '../apps/api/src/modules/content/importer';

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'import' && args[0]) {
    const ci = args.indexOf('--company');
    const company = ci >= 0 ? args[ci + 1] : undefined;
    const r = await importRepository({ source: args[0], importsDir: path.join(ROOT, 'imports'), company });
    console.log(`Imported into ${path.relative(ROOT, r.repoDir)} — assessment "${r.assessmentId}"`);
    for (const c of r.challenges) console.log(`  • ${c.id.padEnd(48)} ${c.kind.padEnd(7)} ${c.path}`);
    console.log('\nRestart the API (or POST /content/reload) to see them in the dashboard.');
    return;
  }
  console.log('Usage:\n  pnpm oa import <github-url|path> [--company amazon]');
  process.exit(cmd ? 1 : 0);
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
