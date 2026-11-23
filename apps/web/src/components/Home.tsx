'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, ExternalLink, Search, Timer } from 'lucide-react';
import { api, frameworkLabel, type AssessmentSummary, type ChallengeProgress, type ChallengeSummary, type SessionListItem } from '@/lib/api';
import { progress as navProgress } from '@/lib/progress';
import { DifficultyText, ErrorBox, ScorePill, SiteHeader, Skeleton, Spinner } from '@/components/ui';

interface Question { key: string; title: string; variants: ChallengeSummary[] }

const FRAMEWORK_ORDER = ['Django', 'Express', 'Node.js', 'Spring Boot', 'C++', 'React'];

/** Practice (`/`) and Assessments (`/assessments`): same header and data, one list each. */
export function Home({ view }: { view: 'practice' | 'assessments' }) {
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [history, setHistory] = useState<SessionListItem[]>([]);
  const [progress, setProgress] = useState<Map<string, ChallengeProgress>>(new Map());
  const [error, setError] = useState<unknown>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, c, h] = await Promise.all([api.assessments(), api.challenges(), api.sessions()]);
      setAssessments(a);
      setChallenges(c.challenges);
      setProblems(c.problems);
      setHistory(h);
      setError(null);
      api.analytics().then((a) => setProgress(new Map(a.challenges.map((c) => [c.id, c]))), () => undefined);
    } catch (e) {
      setError(e);
      setAssessments([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (assessmentId: string, framework?: string) => {
    setStarting(assessmentId);
    navProgress.begin(true);
    try {
      const s = await api.createSession(assessmentId, framework);
      router.push(`/assessment/${s.id}`);
    } catch (e) {
      navProgress.done();
      setError(e);
      setStarting(null);
    }
  };

  const full = (assessments ?? []).filter((a) => a.origin !== 'practice');
  const challengeById = useMemo(() => new Map(challenges.map((c) => [c.id, c])), [challenges]);
  const grouped = useMemo(() => {
    const g = new Map<string, ChallengeSummary[]>();
    for (const c of challenges) {
      const k = frameworkLabel(c.runtime);
      g.set(k, [...(g.get(k) ?? []), c]);
    }
    return [...g.entries()].sort((a, b) => idx(a[0]) - idx(b[0]));
  }, [challenges]);
  const [assessmentFw, setAssessmentFw] = useState<Record<string, string>>({});
  const fwOf = (c: ChallengeSummary) => c.runtime.framework ?? c.runtime.language;
  const fwChoices = (a: AssessmentSummary) => [...a.frameworks].sort((x, y) => idx(frameworkLabel({ language: x, framework: x, image: '' })) - idx(frameworkLabel({ language: y, framework: y, image: '' })));
  /** Same rule as the API's sectionsFor: one section per problem family, in the chosen framework when it has one. */
  const sectionsIn = (a: AssessmentSummary, fw: string | undefined) => {
    const groups = new Map<string, AssessmentSummary['sections']>();
    for (const s of a.sections) {
      const fam = s.challenges.length === 1 ? challengeById.get(s.challenges[0])?.family?.id : undefined;
      if (fam) groups.set(fam, [...(groups.get(fam) ?? []), s]);
    }
    const drop = new Set<string>();
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const chosen = list.find((s) => fwOf(challengeById.get(s.challenges[0])!) === fw) ?? list[0];
      for (const s of list) if (s !== chosen) drop.add(s.id);
    }
    return a.sections.filter((s) => !drop.has(s.id));
  };
  const inProgress = history.find((h) => h.status === 'IN_PROGRESS' || h.status === 'READY');

  const [stackFilter, setStackFilter] = useState<Set<string>>(new Set());
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  // One entry per problem: framework variants of the same task (manifest `family`) are listed once.
  const questions = useMemo(() => {
    const g = new Map<string, Question>();
    for (const c of challenges) {
      const key = c.family?.id ?? c.id;
      const q = g.get(key) ?? { key, title: c.family?.title ?? c.title, variants: [] };
      q.variants.push(c);
      g.set(key, q);
    }
    for (const q of g.values()) q.variants.sort((a, b) => idx(frameworkLabel(a.runtime)) - idx(frameworkLabel(b.runtime)));
    return [...g.values()];
  }, [challenges]);
  const stacks = grouped.map(([fw]) => [fw, questions.filter((q) => q.variants.some((v) => frameworkLabel(v.runtime) === fw)).length] as const);
  const [picked, setPicked] = useState<Record<string, string>>({});
  /** The variant a card starts: the one picked on the card, else the first matching the stack filter. */
  const variantOf = (q: Question) =>
    q.variants.find((v) => v.id === picked[q.key]) ?? q.variants.find((v) => stackFilter.has(frameworkLabel(v.runtime))) ?? q.variants[0];
  const filtered = questions
    .filter((q) => !stackFilter.size || q.variants.some((v) => stackFilter.has(frameworkLabel(v.runtime))))
    .filter((q) => !diffFilter.size || q.variants.some((v) => diffFilter.has(v.difficulty)))
    .filter((q) => !query.trim() || q.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => idx(frameworkLabel(a.variants[0].runtime)) - idx(frameworkLabel(b.variants[0].runtime)) || a.title.localeCompare(b.title));
  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    fn(n);
  };
  const completed = history.filter((h) => h.status === 'SUBMITTED' || h.status === 'EXPIRED');

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteHeader />

      {/* Page header */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prepare for repository-debugging assessments</h1>
            <p className="mt-2 max-w-2xl text-muted">
              Timed tasks on real codebases. Read the question, run the failing tests, fix the bugs and submit. Everything runs locally in an isolated sandbox.
            </p>
            <div className="mt-5 flex flex-wrap gap-8">
              <Stat value={questions.length} label="Questions" loading={assessments === null} />
              <Stat value={full.length} label="Assessments" loading={assessments === null} />
              <Stat value={stacks.length} label="Tech stacks" loading={assessments === null} />
              <Stat value={completed.length} label="Completed" loading={assessments === null} />
            </div>
          </div>
          {inProgress ? (
            <div className="rounded-md border border-accent/30 bg-accent/5 p-5">
              <p className="label text-accent">In progress</p>
              <p className="mt-1.5 font-semibold">{inProgress.title}</p>
              <p className="mt-0.5 text-xs text-muted">Started {new Date(inProgress.createdAt).toLocaleString()}</p>
              <Link href={`/assessment/${inProgress.id}`} className="btn btn-primary mt-4">
                Resume <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="rounded-md border border-line bg-raised p-5 text-sm">
              <p className="label">How it works</p>
              <ol className="mt-2 space-y-1.5 text-fg/80">
                {['Choose an assessment or a single challenge', 'Each section runs on its own server-side timer', 'Edit, run tests and use the terminal', 'Submit: tests re-run on the original test files'].map((t, i) => (
                  <li key={t} className="flex gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-bold text-accent">{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-10 px-5 py-8">
        <ErrorBox error={error} />
        {problems.length > 0 && (
          <details className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm text-warn">
            <summary className="cursor-pointer">{problems.length} content file(s) failed to load</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </details>
        )}

        {/* Assessments */}
        {view === 'assessments' && (
          <section id="assessments" className="scroll-mt-20">
            <SectionHeader title="Assessments" hint="Full timed tests — one section per repository." />
            {assessments === null ? (
              <div className="grid gap-4 lg:grid-cols-3" role="status" aria-label="Loading assessments">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card overflow-hidden">
                    <div className="space-y-3 border-b border-line p-5">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <div className="space-y-3 p-5">
                      {[0, 1, 2, 3].map((j) => <Skeleton key={j} className="h-3 w-full" />)}
                    </div>
                    <div className="flex justify-end border-t border-line bg-raised px-5 py-3"><Skeleton className="h-8 w-24" /></div>
                  </div>
                ))}
              </div>
            ) : full.length === 0 ? (
              <p className="text-sm text-muted">No assessments found.</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {full.map((a) => {
                  const choices = fwChoices(a);
                  const fw = assessmentFw[a.id] ?? choices[0];
                  const sections = sectionsIn(a, fw);
                  return (
                    <div key={a.id} className="card flex flex-col overflow-hidden">
                      <div className="border-b border-line p-5">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <Building2 className="h-3.5 w-3.5" />
                          <span className="capitalize">{a.company}</span>
                          <span>·</span>
                          <span>{sections.length} questions</span>
                          <span>·</span>
                          <span>{sections.reduce((n, s) => n + s.durationMinutes, 0)} min</span>
                        </div>
                        <h3 className="mt-2 text-[15px] font-bold leading-snug">{a.title}</h3>
                        <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{a.description}</p>
                      </div>
                      <ul className="max-h-56 flex-1 divide-y divide-line overflow-auto">
                        {sections.map((sec, i) => {
                          const c = challengeById.get(sec.challenges[0]);
                          return (
                            <li key={sec.id} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                              <span className="w-4 text-right font-mono text-xs text-muted">{i + 1}</span>
                              <span className="flex-1 truncate">{c?.family?.title ?? sec.title}</span>
                              {c && <StackTag label={frameworkLabel(c.runtime)} />}
                            </li>
                          );
                        })}
                      </ul>
                      {choices.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-2.5">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Framework</span>
                          <div className="inline-flex rounded-md border border-line bg-raised p-0.5" role="radiogroup" aria-label={`Framework for ${a.title}`}>
                            {choices.map((f) => (
                              <button
                                key={f}
                                role="radio"
                                aria-checked={f === fw}
                                onClick={() => setAssessmentFw((p) => ({ ...p, [a.id]: f }))}
                                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${f === fw ? 'bg-panel text-accent shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg'}`}
                              >
                                {frameworkLabel({ language: f, framework: f, image: '' })}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between border-t border-line bg-raised px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted"><Timer className="h-3.5 w-3.5" /> Timed per section</span>
                        <button className="btn btn-primary btn-sm h-8 px-4" disabled={!!starting} onClick={() => start(a.id, choices.length > 1 ? fw : undefined)}>
                          {starting === a.id ? <Spinner className="h-3.5 w-3.5" /> : null} Start test
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Practice */}
        {view === 'practice' && (
          <section id="practice" className="scroll-mt-20">
            <SectionHeader title="Practice challenges" hint="Solve any single repository with its own timer." />
            <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
              <aside className="space-y-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
                  <input className="input pl-8" placeholder="Search challenges" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <FilterGroup title="Tech stack">
                  {assessments === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
                  {stacks.map(([fw, n]) => (
                    <Check key={fw} label={fw} count={n} checked={stackFilter.has(fw)} onChange={() => toggle(stackFilter, fw, setStackFilter)} />
                  ))}
                </FilterGroup>
                <FilterGroup title="Difficulty">
                  {['easy', 'medium', 'hard'].map((d) => (
                    <Check key={d} label={d[0].toUpperCase() + d.slice(1)} count={questions.filter((q) => q.variants.some((v) => v.difficulty === d)).length} checked={diffFilter.has(d)} onChange={() => toggle(diffFilter, d, setDiffFilter)} />
                  ))}
                </FilterGroup>
              </aside>
              <div className="space-y-3">
                {assessments === null &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="card flex items-center gap-4 p-5" role="status" aria-label="Loading challenges">
                      <div className="flex-1 space-y-2.5">
                        <Skeleton className="h-4 w-2/5" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-3 w-3/4" />
                      </div>
                      <Skeleton className="h-9 w-32" />
                    </div>
                  ))}
                {assessments !== null && filtered.length === 0 && <p className="card p-6 text-sm text-muted">No challenges match these filters.</p>}
                {filtered.map((q) => {
                  const c = variantOf(q);
                  const best = progress.get(c.id);
                  return (
                    <div key={q.key} className="card flex flex-col gap-3 p-5 transition hover:shadow-md sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-[15px] font-bold">{q.title}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <DifficultyText level={c.difficulty} />
                          {q.variants.length === 1 && <span>{frameworkLabel(c.runtime)}</span>}
                          <span>{c.durationMinutes} min</span>
                          {best ? (
                            <Link href="/progress" className="hover:text-fg">
                              Best <ScorePill score={best.best} /> · {best.count} {best.count === 1 ? 'try' : 'tries'}
                            </Link>
                          ) : (
                            <span>Max score 100</span>
                          )}
                          {c.provenance?.url && (
                            <a href={c.provenance.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg" title={c.provenance.license ?? 'Source'}>
                              Source <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-1 text-[13px] text-fg/70">{c.description}</p>
                        {q.variants.length > 1 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Framework</span>
                            <div className="inline-flex rounded-md border border-line bg-raised p-0.5" role="radiogroup" aria-label={`Framework for ${q.title}`}>
                              {q.variants.map((v) => {
                                const on = v.id === c.id;
                                return (
                                  <button
                                    key={v.id}
                                    role="radio"
                                    aria-checked={on}
                                    onClick={() => setPicked((p) => ({ ...p, [q.key]: v.id }))}
                                    className={`rounded px-2.5 py-1 text-xs font-semibold transition ${on ? 'bg-panel text-accent shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg'}`}
                                  >
                                    {frameworkLabel(v.runtime)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                      <button className="btn btn-outline shrink-0" disabled={!!starting} onClick={() => start(`practice-${c.id}`)}>
                        {starting === `practice-${c.id}` ? <Spinner className="h-3.5 w-3.5" /> : null}
                        {q.variants.length > 1 ? `Solve in ${frameworkLabel(c.runtime)}` : 'Solve Challenge'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <footer className="border-t border-line pt-6 text-xs text-muted">
          OA Lab is an independent practice tool. It is not affiliated with Amazon, HackerRank or any other company, and does not reproduce proprietary assessment content.
        </footer>
      </main>
    </div>
  );
}

function Stat({ value, label, loading }: { value: number; label: string; loading?: boolean }) {
  return (
    <div>
      {loading ? <Skeleton className="mb-1 mt-1 h-6 w-10" /> : <p className="text-2xl font-bold">{value}</p>}
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function StackTag({ label }: { label: string }) {
  return <span className="shrink-0 rounded-sm bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted">{label}</span>;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Check({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" className="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]" checked={checked} onChange={onChange} />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted">{count}</span>
    </label>
  );
}

function idx(fw: string) {
  const i = FRAMEWORK_ORDER.indexOf(fw);
  return i < 0 ? 99 : i;
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="hidden text-xs text-muted sm:block">{hint}</p>}
    </div>
  );
}
