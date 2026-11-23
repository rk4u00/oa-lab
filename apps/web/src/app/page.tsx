'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Download, ExternalLink, FolderGit2, History, Layers, Play, Timer } from 'lucide-react';
import { api, frameworkLabel, type AssessmentSummary, type ChallengeSummary, type ImportResult, type SessionListItem } from '@/lib/api';
import { ErrorBox, HealthBadge, Logo, ScorePill, Spinner, StatusBadge } from '@/components/ui';

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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:inline">Local instance</span>
            <HealthBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="label mb-3 text-accent">Online Assessment Lab</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your assessment workspace.</h1>
            <p className="mt-3 max-w-xl text-muted">
              Open an unfamiliar repository, read the brief, run the failing tests and fix the bugs — in a timed, sandboxed IDE with a terminal and an AI coach at your side.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted">
              <span className="badge"><FolderGit2 className="h-3 w-3" /> Real repositories</span>
              <span className="badge"><Timer className="h-3 w-3" /> Server-timed sessions</span>
              <span className="badge"><Layers className="h-3 w-3" /> Docker-isolated runtimes</span>
              <span className="badge"><Bot className="h-3 w-3" /> AI coach prompt</span>
            </div>
          </div>
          {inProgress ? (
            <div className="card p-5">
              <p className="label">Continue where you left off</p>
              <p className="mt-2 font-medium">{inProgress.title}</p>
              <p className="mt-1 text-xs text-muted">Started {new Date(inProgress.createdAt).toLocaleString()}</p>
              <Link href={`/assessment/${inProgress.id}`} className="btn btn-primary mt-4">
                <Play className="h-3.5 w-3.5" /> Resume assessment
              </Link>
            </div>
          ) : (
            <div className="card p-5 text-sm text-muted">
              <p className="label mb-2">How it works</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Pick an assessment or a single challenge.</li>
                <li>Each section starts its own countdown on the server.</li>
                <li>Edit, run tests and use the terminal inside the sandbox.</li>
                <li>Submit — tests are re-run on pristine test files and scored.</li>
              </ol>
            </div>
          )}
        </section>

        <ErrorBox error={error} />
        {problems.length > 0 && (
          <details className="rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm text-warn">
            <summary className="cursor-pointer">{problems.length} content file(s) failed to load</summary>
            <ul className="mt-2 space-y-1 font-mono text-xs">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </details>
        )}

        <section>
          <SectionHeader title="Assessments" hint="Full timed assessments, one section per repository." />
          {assessments === null ? (
            <Spinner />
          ) : full.length === 0 ? (
            <p className="text-sm text-muted">No assessments found.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {full.map((a) => (
                <div key={a.id} className="card flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="badge capitalize">{a.company}</span>
                        <span className="badge">{a.origin}</span>
                      </div>
                      <h3 className="font-semibold">{a.title}</h3>
                      {a.subtitle && <p className="truncate text-xs text-muted">{a.subtitle}</p>}
                    </div>
                    <span className="badge shrink-0"><Timer className="h-3 w-3" /> {a.totalMinutes} min</span>
                  </div>
                  <p className="mt-3 text-sm text-muted">{a.description}</p>
                  <ul className="mt-4 space-y-1.5">
                    {a.sections.map((s, i) => {
                      const c = challengeById.get(s.challenges[0]);
                      return (
                        <li key={s.id} className="flex items-center gap-2 text-sm">
                          <span className="grid h-5 w-5 place-items-center rounded bg-raised font-mono text-[10px] text-muted">{i + 1}</span>
                          <span className="flex-1 truncate">{s.title}</span>
                          {c && <span className="badge">{frameworkLabel(c.runtime)}</span>}
                          <span className="font-mono text-xs text-muted">{s.durationMinutes}m</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-5 flex-1" />
                  <button className="btn btn-primary self-start" disabled={!!starting} onClick={() => start(a.id)}>
                    {starting === a.id ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Start assessment
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="Challenge library" hint="Practise any single repository with its own timer." />
          {grouped.length === 0 && assessments !== null && <p className="text-sm text-muted">No challenges yet — import a repository below.</p>}
          <div className="space-y-6">
            {grouped.map(([fw, list]) => (
              <div key={fw}>
                <p className="label mb-2">{fw} · {list.length}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <div key={c.id} className="card flex flex-col p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="badge">{frameworkLabel(c.runtime)}</span>
                        <span className="badge capitalize">{c.difficulty}</span>
                        <span className={`badge ${c.origin === 'imported' ? 'text-sky-400' : ''}`}>{c.origin}</span>
                      </div>
                      <h4 className="mt-2 line-clamp-2 text-sm font-medium">{c.title}</h4>
                      <p className="mt-1 line-clamp-3 text-xs text-muted">{c.description}</p>
                      <div className="mt-3 flex-1" />
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted">{c.durationMinutes} min</span>
                        <div className="flex items-center gap-1">
                          {c.provenance?.url && (
                            <a href={c.provenance.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title={c.provenance.license ?? 'Source'}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          <button className="btn btn-sm" disabled={!!starting} onClick={() => start(`practice-${c.id}`)}>
                            {starting === `practice-${c.id}` ? <Spinner className="h-3 w-3" /> : <Play className="h-3 w-3" />} Practice
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <ImportPanel onImported={load} />

        <section>
          <SectionHeader title="History" hint="Previous attempts and results." icon={<History className="h-4 w-4" />} />
          {history.length === 0 ? (
            <p className="text-sm text-muted">No attempts yet.</p>
          ) : (
            <div className="card divide-y divide-line">
              {history.map((h) => {
                const done = h.status === 'SUBMITTED' || h.status === 'EXPIRED';
                return (
                  <Link key={h.id} href={done ? `/results/${h.id}` : `/assessment/${h.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-raised/50">
                    <span className="flex-1 truncate">{h.title}</span>
                    <StatusBadge status={h.status} />
                    <span className="w-16 text-right"><ScorePill score={h.score} /></span>
                    <span className="hidden w-40 text-right text-xs text-muted sm:inline">{new Date(h.createdAt).toLocaleString()}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <footer className="border-t border-line pt-6 text-xs text-muted">
          OA Lab is an independent practice tool. It is not affiliated with Amazon or any other company, and does not reproduce proprietary assessment content.
        </footer>
      </main>
    </div>
  );
}

function idx(fw: string) {
  const i = FRAMEWORK_ORDER.indexOf(fw);
  return i < 0 ? 99 : i;
}

function SectionHeader({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold">{icon}{title}</h2>
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
    <section>
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
          Imported code stays in the local, git-ignored <code className="font-mono">imports/</code> folder. Nothing from it is executed until a session starts — and then only inside the sandbox.
        </p>
        <ErrorBox error={error} />
        {result && (
          <div className="rounded-md border border-ok/40 bg-ok/5 p-3 text-sm">
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
