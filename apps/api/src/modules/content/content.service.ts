import fs from 'node:fs/promises';
import path from 'node:path';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AssessmentDefinition, ChallengeManifest } from '@oa-lab/shared';
import { env, REPO_ROOT } from '../../common/env';
import { importRepository, repoSlugFromSource } from './importer';

export interface RegisteredChallenge {
  manifest: ChallengeManifest;
  dir: string;
  starterPath: string;
  taskPath: string;
  coachPromptPath?: string;
  origin: 'builtin' | 'imported';
}

export interface RegisteredAssessment {
  definition: AssessmentDefinition;
  origin: 'builtin' | 'imported' | 'practice';
}

export const IMPORTS_DIR = env.importsDir;

const frameworkOf = (m: ChallengeManifest) => m.runtime.framework ?? m.runtime.language;

async function findFiles(root: string, name: string, depth = 7): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, d: number) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isFile() && e.name === name) out.push(path.join(dir, e.name));
      else if (e.isDirectory() && d < depth && !['node_modules', '.git', 'starter', 'target', '__pycache__'].includes(e.name)) await walk(path.join(dir, e.name), d + 1);
    }
  };
  await walk(root, 0);
  return out;
}

/** Universal challenge registry: everything is discovered from manifests on disk. */
@Injectable()
export class ContentService implements OnModuleInit {
  private readonly log = new Logger(ContentService.name);
  private challenges = new Map<string, RegisteredChallenge>();
  private assessments = new Map<string, RegisteredAssessment>();
  readonly problems: string[] = [];

  async onModuleInit() {
    await this.reload();
    if (env.autoImport) void this.autoImport();
  }

  /** Import every repository listed in content/sources.json that is not imported yet. */
  async autoImport() {
    const file = path.join(env.contentDir, 'sources.json');
    let sources: { url: string; company?: string }[] = [];
    try {
      sources = JSON.parse(await fs.readFile(file, 'utf8')).sources ?? [];
    } catch {
      return;
    }
    for (const s of sources) {
      const dir = path.join(IMPORTS_DIR, repoSlugFromSource(s.url));
      if (await fs.access(path.join(dir, '.oa-lab', 'assessment.json')).then(() => true, () => false)) continue;
      try {
        this.log.log(`Auto-importing ${s.url} …`);
        const r = await importRepository({ source: s.url, importsDir: IMPORTS_DIR, company: s.company });
        this.log.log(`Imported ${r.challenges.length} challenges from ${s.url}`);
      } catch (e) {
        this.log.error(`Auto-import of ${s.url} failed: ${(e as Error).message}`);
      }
    }
    await this.reload();
  }

  async reload() {
    const challenges = new Map<string, RegisteredChallenge>();
    const assessments = new Map<string, RegisteredAssessment>();
    const problems: string[] = [];
    for (const [root, origin] of [[env.contentDir, 'builtin'], [IMPORTS_DIR, 'imported']] as const) {
      for (const file of await findFiles(root, 'oa-challenge.json')) {
        try {
          const manifest = ChallengeManifest.parse(JSON.parse(await fs.readFile(file, 'utf8')));
          const dir = path.dirname(file);
          if (challenges.has(manifest.id)) throw new Error(`duplicate challenge id ${manifest.id}`);
          challenges.set(manifest.id, {
            manifest,
            dir,
            starterPath: path.resolve(dir, manifest.starterDir),
            taskPath: path.resolve(dir, manifest.taskFile),
            coachPromptPath: manifest.coachPromptFile ? path.resolve(dir, manifest.coachPromptFile) : undefined,
            origin,
          });
        } catch (e) {
          problems.push(`${path.relative(REPO_ROOT, file)}: ${(e as Error).message}`);
        }
      }
      for (const file of await findFiles(root, 'assessment.json')) {
        try {
          const definition = AssessmentDefinition.parse(JSON.parse(await fs.readFile(file, 'utf8')));
          const missing = definition.sections.flatMap((s) => s.challenges).filter((c) => !challenges.has(c));
          if (missing.length) throw new Error(`unknown challenges: ${missing.join(', ')}`);
          assessments.set(definition.id, { definition, origin });
        } catch (e) {
          problems.push(`${path.relative(REPO_ROOT, file)}: ${(e as Error).message}`);
        }
      }
    }
    // Every challenge is also available as a single-section practice assessment.
    for (const c of challenges.values()) {
      const m = c.manifest;
      assessments.set(`practice-${m.id}`, {
        origin: 'practice',
        definition: {
          id: `practice-${m.id}`,
          company: m.company,
          title: m.title,
          subtitle: 'Practice · single challenge',
          description: m.description,
          aiAssistance: 'allowed',
          sections: [{ id: 'debugging', kind: 'debugging', title: m.title, durationMinutes: m.durationMinutes, challenges: [m.id] }],
        },
      });
    }
    this.challenges = challenges;
    this.assessments = assessments;
    this.problems.splice(0, this.problems.length, ...problems);
    problems.forEach((p) => this.log.warn(p));
    this.log.log(`Loaded ${challenges.size} challenges, ${assessments.size} assessments`);
  }

  listChallenges() {
    return [...this.challenges.values()];
  }
  listAssessments() {
    return [...this.assessments.values()];
  }
  challenge(id: string) {
    const c = this.challenges.get(id);
    if (!c) throw new NotFoundException(`Challenge ${id} not found`);
    return c;
  }
  assessment(id: string) {
    const a = this.assessments.get(id);
    if (!a) throw new NotFoundException(`Assessment ${id} not found`);
    return a;
  }

  /** Frameworks (`runtime.framework`) a candidate can choose between, from sections that are variants of one problem. */
  frameworkChoices(id: string) {
    const out = new Set<string>();
    for (const list of this.variantGroups(id)) for (const s of list) out.add(frameworkOf(this.sectionManifest(s)!));
    return [...out];
  }

  /**
   * The sections a session gets: framework variants of the same problem (manifest `family`) are reduced to one,
   * the variant in `framework` when the problem has one, otherwise the first listed.
   */
  sectionsFor(id: string, framework?: string) {
    const { definition } = this.assessment(id);
    const drop = new Set<string>();
    for (const list of this.variantGroups(id)) {
      const chosen = list.find((s) => frameworkOf(this.sectionManifest(s)!) === framework) ?? list[0];
      for (const s of list) if (s !== chosen) drop.add(s.id);
    }
    return definition.sections.filter((s) => !drop.has(s.id));
  }

  private sectionManifest(s: AssessmentDefinition['sections'][number]) {
    return s.challenges.length === 1 ? this.challenges.get(s.challenges[0])?.manifest : undefined;
  }

  /** Groups of two or more single-challenge sections whose challenges share a `family`. */
  private variantGroups(id: string) {
    const groups = new Map<string, AssessmentDefinition['sections']>();
    for (const s of this.assessment(id).definition.sections) {
      const fam = this.sectionManifest(s)?.family?.id;
      if (fam) groups.set(fam, [...(groups.get(fam) ?? []), s]);
    }
    return [...groups.values()].filter((l) => l.length > 1);
  }

  async taskMarkdown(id: string) {
    const c = this.challenge(id);
    return fs.readFile(c.taskPath, 'utf8').catch(() => `# ${c.manifest.title}\n\n${c.manifest.description}`);
  }

  async import(source: string, company?: string) {
    const result = await importRepository({ source, importsDir: IMPORTS_DIR, company });
    await this.reload();
    return result;
  }
}
