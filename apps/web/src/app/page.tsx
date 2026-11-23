'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, Download, ExternalLink, History, Search, Timer } from 'lucide-react';
import { api, frameworkLabel, type AssessmentSummary, type ChallengeSummary, type ImportResult, type SessionListItem } from '@/lib/api';
import { DifficultyText, ErrorBox, HealthBadge, ScorePill, Spinner, StatusBadge, TopNav } from '@/components/ui';

const FRAMEWORK_ORDER = ['Django', 'Express', 'Node.js', 'Spring Boot', 'React'];

export default function Dashboard() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [history, setHistory] = useState<SessionListItem[]>([]);
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
    } catch (e) {
      setError(e);
      setAssessments([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async (assessmentId: string) => {
    setStarting(assessmentId);
    try {
      const s = await api.createSession(assessmentId);
      router.push(`/assessment/${s.id}`);
    } catch (e) {
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
  const inProgress = history.find((h) => h.status === 'IN_PROGRESS' || h.status === 'READY');

  const [stackFilter, setStackFilter] = useState<Set<string>>(new Set());
  const [diffFilter, setDiffFilter] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const stacks = grouped.map(([fw, list]) => [fw, list.length] as const);
  const filtered = challenges
    .filter((c) => !stackFilter.size || stackFilter.has(frameworkLabel(c.runtime)))
    .filter((c) => !diffFilter.size || diffFilter.has(c.difficulty))
    .filter((c) => !query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => idx(frameworkLabel(a.runtime)) - idx(frameworkLabel(b.runtime)) || a.title.localeCompare(b.title));
  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    fn(n);
  };
  const completed = history.filter((h) => h.status === 'SUBMITTED' || h.status === 'EXPIRED');

  return (
    <div className="min-h-screen">
      <TopNav>
        <nav className="hidden items-center gap-1 text-sm font-medium text-white/70 md:flex">
          <a href="#assessments" className="rounded px-3 py-1.5 hover:bg-white/10 hover:text-white">Assessments</a>
          <a href="#practice" className="rounded px-3 py-1.5 hover:bg-white/10 hover:text-white">Practice</a>
          <a href="#history" className="rounded px-3 py-1.5 hover:bg-white/10 hover:text-white">Submissions</a>
          <a href="#import" className="rounded px-3 py-1.5 hover:bg-white/10 hover:text-white">Import</a>
        </nav>
        <div className="flex-1" />
        <HealthBadge />
      </TopNav>

      {/* Page header */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Prepare for repository-debugging assessments</h1>
            <p className="mt-2 max-w-2xl text-muted">
              Timed tasks on real codebases. Read the question, run the failing tests, fix the bugs and submit. Everything runs locally in an isolated sandbox.
            </p>
            <div className="mt-5 flex flex-wrap gap-8">
              <Stat value={challenges.length} label="Challenges" />
              <Stat value={full.length} label="Assessments" />
              <Stat value={stacks.length} label="Tech stacks" />
              <Stat value={completed.length} label="Completed" />
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
        <section id="assessments" className="scroll-mt-20">
          <SectionHeader title="Assessments" hint="Full timed tests — one section per repository." />
          {assessments === null ? (
            <Spinner />
          ) : full.length === 0 ? (
            <p className="text-sm text-muted">No assessments found.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {full.map((a) => (
                <div key={a.id} className="card flex flex-col overflow-hidden">
                  <div className="border-b border-line p-5">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="capitalize">{a.company}</span>
                      <span>·</span>
                      <span>{a.sections.length} questions</span>
                      <span>·</span>
                      <span>{a.totalMinutes} min</span>
                    </div>
                    <h3 className="mt-2 text-[15px] font-bold leading-snug">{a.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{a.description}</p>
                  </div>
                  <ul className="max-h-56 flex-1 divide-y divide-line overflow-auto">
                    {a.sections.map((sec, i) => {
                      const c = challengeById.get(sec.challenges[0]);
                      return (
                        <li key={sec.id} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                          <span className="w-4 text-right font-mono text-xs text-muted">{i + 1}</span>
                          <span className="flex-1 truncate">{sec.title}</span>
                          {c && <StackTag label={frameworkLabel(c.runtime)} />}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between border-t border-line bg-raised px-5 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-muted"><Timer className="h-3.5 w-3.5" /> Timed per section</span>
                    <button className="btn btn-primary btn-sm h-8 px-4" disabled={!!starting} onClick={() => start(a.id)}>
                      {starting === a.id ? <Spinner className="h-3.5 w-3.5" /> : null} Start test
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Practice */}
        <section id="practice" className="scroll-mt-20">
          <SectionHeader title="Practice challenges" hint="Solve any single repository with its own timer." />
          <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
            <aside className="space-y-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" />
                <input className="input pl-8" placeholder="Search challenges" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <FilterGroup title="Tech stack">
                {stacks.map(([fw, n]) => (
                  <Check key={fw} label={fw} count={n} checked={stackFilter.has(fw)} onChange={() => toggle(stackFilter, fw, setStackFilter)} />
                ))}
              </FilterGroup>
              <FilterGroup title="Difficulty">
                {['easy', 'medium', 'hard'].map((d) => (
                  <Check key={d} label={d[0].toUpperCase() + d.slice(1)} count={challenges.filter((c) => c.difficulty === d).length} checked={diffFilter.has(d)} onChange={() => toggle(diffFilter, d, setDiffFilter)} />
                ))}
              </FilterGroup>
            </aside>
            <div className="space-y-3">
              {assessments !== null && filtered.length === 0 && <p className="card p-6 text-sm text-muted">No challenges match these filters.</p>}
              {filtered.map((c) => (
                <div key={c.id} className="card flex flex-col gap-3 p-5 transition hover:shadow-md sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[15px] font-bold">{c.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <DifficultyText level={c.difficulty} />
                      <span>{frameworkLabel(c.runtime)}</span>
                      <span>{c.durationMinutes} min</span>
                      <span>Max score 100</span>
                      {c.provenance?.url && (
                        <a href={c.provenance.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg" title={c.provenance.license ?? 'Source'}>
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-1 text-[13px] text-fg/70">{c.description}</p>
                  </div>
                  <button className="btn btn-outline shrink-0" disabled={!!starting} onClick={() => start(`practice-${c.id}`)}>
                    {starting === `practice-${c.id}` ? <Spinner className="h-3.5 w-3.5" /> : null} Solve Challenge
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* History */}
        <section id="history" className="scroll-mt-20">
          <SectionHeader title="Submissions" hint="Previous attempts and results." icon={<History className="h-4 w-4" />} />
          {history.length === 0 ? (
            <p className="card p-6 text-sm text-muted">No attempts yet — start a challenge above.</p>
          ) : (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-[1fr_120px_80px] gap-3 border-b border-line bg-raised px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid-cols-[1fr_120px_80px_170px]">
                <span>Assessment</span>
                <span>Status</span>
                <span className="text-right">Score</span>
                <span className="hidden text-right sm:block">Started</span>
              </div>
              <div className="divide-y divide-line">
                {history.map((h) => {
                  const done = h.status === 'SUBMITTED' || h.status === 'EXPIRED';
                  return (
                    <Link
                      key={h.id}
                      href={done ? `/results/${h.id}` : `/assessment/${h.id}`}
                      className="grid grid-cols-[1fr_120px_80px] items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-raised sm:grid-cols-[1fr_120px_80px_170px]"
                    >
                      <span className="truncate font-medium">{h.title}</span>
                      <span><StatusBadge status={h.status} /></span>
                      <span className="text-right"><ScorePill score={h.score} /></span>
                      <span className="hidden text-right text-xs text-muted sm:block">{new Date(h.createdAt).toLocaleString()}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <ImportPanel onImported={load} />

        <footer className="border-t border-line pt-6 text-xs text-muted">
          OA Lab is an independent practice tool. It is not affiliated with Amazon, HackerRank or any other company, and does not reproduce proprietary assessment content.
        </footer>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
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

function SectionHeader({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="flex items-center gap-2 text-lg font-bold">{icon}{title}</h2>
      {hint && <p className="hidden text-xs text-muted sm:block">{hint}</p>}
    </div>
  );
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [source, setSource] = useState('');
  const [company, setCompany] = useState('amazon');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.importRepo(source.trim(), company.trim() || undefined);
      setResult(r);
      onImported();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="import" className="scroll-mt-20">
      <SectionHeader title="Import repository" hint="Django, Spring Boot (Maven) and Node.js projects are detected automatically." icon={<Download className="h-4 w-4" />} />
      <form onSubmit={submit} className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <input className="input font-mono" placeholder="https://github.com/owner/repo  or  /path/to/local/repo" value={source} onChange={(e) => setSource(e.target.value)} />
          <input className="input" placeholder="company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button className="btn btn-primary justify-center" disabled={busy || !source.trim()}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} Import
          </button>
        </div>
        <p className="text-xs text-muted">
          Imported code goes to the local <code className="font-mono">imports/</code> folder. Nothing from it is executed until a session starts — and then only inside the sandbox.
        </p>
        <ErrorBox error={error} />
        {result && (
          <div className="rounded border border-ok/40 bg-ok/5 p-3 text-sm">
            <p className="text-ok">Detected {result.challenges.length} challenge(s) — assessment <span className="font-mono">{result.assessmentId}</span> registered.</p>
            <ul className="mt-2 space-y-0.5 font-mono text-xs text-muted">
              {result.challenges.map((c) => (
                <li key={c.id}>
                  <span className="inline-block w-16 text-fg">{c.kind}</span> {c.path}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </section>
  );
}
