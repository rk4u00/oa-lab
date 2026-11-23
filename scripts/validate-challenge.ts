/** Validate every oa-challenge.json / assessment.json under content/ and imports/. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { AssessmentDefinition, ChallengeManifest } from '@oa-lab/shared';

const ROOT = path.resolve(__dirname, '..');

async function* walk(dir: string): AsyncGenerator<string> {
  for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (['node_modules', '.git', 'starter', 'target'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name === 'oa-challenge.json' || e.name === 'assessment.json') yield p;
  }
}

async function main() {
  let bad = 0;
  for (const root of ['content', 'imports']) {
    for await (const f of walk(path.join(ROOT, root))) {
      const json = JSON.parse(await fs.readFile(f, 'utf8'));
      const r = (f.endsWith('assessment.json') ? AssessmentDefinition : ChallengeManifest).safeParse(json);
      if (!r.success) {
        bad++;
        console.error(`✗ ${path.relative(ROOT, f)}\n${JSON.stringify(r.error.flatten().fieldErrors, null, 2)}`);
        continue;
      }
      if ('starterDir' in r.data) {
        const starter = path.resolve(path.dirname(f), r.data.starterDir);
        if (!(await fs.stat(starter).catch(() => null))) {
          bad++;
          console.error(`✗ ${path.relative(ROOT, f)}: starter not found (${starter})`);
          continue;
        }
      }
      console.log(`✓ ${path.relative(ROOT, f)}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
void main();
