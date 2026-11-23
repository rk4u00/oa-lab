'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight, Minus, TrendingUp } from 'lucide-react';
import { api, formatDuration, frameworkLabel, type Analytics, type ChallengeProgress } from '@/lib/api';
import { DifficultyText, ErrorBox, ScorePill, SiteHeader, Skeleton, SkeletonRows } from '@/components/ui';

type SortKey = 'recent' | 'improved' | 'weakest' | 'attempts';
const SORTS: Record<SortKey, { label: string; fn: (a: ChallengeProgress, b: ChallengeProgress) => number }> = {
  recent: { label: 'Most recent', fn: (a, b) => +new Date(b.lastAt) - +new Date(a.lastAt) },
  improved: { label: 'Most improved', fn: (a, b) => b.bestImprovement - a.bestImprovement || b.count - a.count },
  weakest: { label: 'Needs work', fn: (a, b) => a.best - b.best || a.latest - b.latest },
  attempts: { label: 'Most attempts', fn: (a, b) => b.count - a.count },
};

export default function ProgressPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.analytics().then(setData, setError);
  }, []);

  const rows = useMemo(() => [...(data?.challenges ?? [])].sort(SORTS[sort].fn), [data, sort]);
  const o = data?.overview;

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <SiteHeader />

      <section className="border-b border-line bg-panel">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><TrendingUp className="h-6 w-6 text-accent" /> Progress</h1>
          <p className="mt-2 max-w-2xl text-muted">Every graded attempt, including the ones you retried, with how your scores changed from the first try to now.</p>
          {!data && !error && (
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6" role="status" aria-label="Loading">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-7 w-16" /></div>
              ))}
            </div>
          )}
          {o && o.attempts > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              <Tile label="Questions attempted" value={o.questions} />
              <Tile label="Graded attempts" value={o.attempts} />
              <Tile label="Solved fully" value={`${o.mastered} / ${o.questions}`} />
              <Tile label="Avg first score" value={pct(o.avgFirst)} />
              <Tile label="Avg best score" value={pct(o.avgBest)} delta={o.avgFirst !== null && o.avgBest !== null ? o.avgBest - o.avgFirst : null} />
              <Tile label="Time practised" value={formatHours(o.totalTimeMs)} />
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-10 px-5 py-8">
        <ErrorBox error={error} />
        {!data && !error && (
          <>
            <div className="card space-y-4 p-5">
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-52 w-full" />
            </div>
            <SkeletonRows rows={4} />
          </>
        )}
        {data && data.overview.attempts === 0 && (
          <div className="card p-6 text-sm text-muted">
            No graded attempts yet. Submit a challenge from the <Link href="/" className="text-accent underline">dashboard</Link> and your progress shows up here.
          </div>
        )}

        {data && data.overview.attempts > 0 && (
          <>
            <section>
              <Header title="Score over time" hint={`${data.overview.improved} of ${data.overview.repeated} retried questions improved`} />
              <div className="card min-w-0 p-5">
                <TrendChart points={data.timeline} />
              </div>
            </section>

            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-lg font-bold">By question</h2>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Sort
                  <select className="input h-8 w-auto py-0 text-[13px]" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[760px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-raised text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                      <th className="px-5 py-2">Question</th>
                      <th className="px-3 py-2 text-right">Tries</th>
                      <th className="px-3 py-2 text-right">First</th>
                      <th className="px-3 py-2 text-right">Best</th>
                      <th className="px-3 py-2 text-right">Latest</th>
                      <th className="px-3 py-2 text-right">Change</th>
                      <th className="px-3 py-2">Trend</th>
                      <th className="px-3 py-2 text-right">Time</th>
                      <th className="px-5 py-2 text-right">Last tried</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((c) => (
                      <Fragment key={c.id}>
                        <tr className="cursor-pointer hover:bg-raised" onClick={() => setOpen(open === c.id ? null : c.id)}>
                          <td className="px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              {open === c.id ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />}
                              <div className="min-w-0">
                                <p className="truncate font-medium">{c.title}</p>
                                <p className="mt-0.5 flex gap-2 text-xs text-muted">
                                  {c.runtime && <span>{frameworkLabel(c.runtime)}</span>}
                                  {c.difficulty && <DifficultyText level={c.difficulty} />}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{c.count}</td>
                          <td className="px-3 py-2.5 text-right"><ScorePill score={c.first} /></td>
                          <td className="px-3 py-2.5 text-right"><ScorePill score={c.best} /></td>
                          <td className="px-3 py-2.5 text-right"><ScorePill score={c.latest} /></td>
                          <td className="px-3 py-2.5 text-right">{c.count > 1 ? <Delta value={c.improvement} /> : <span className="text-xs text-muted">1 try</span>}</td>
                          <td className="px-3 py-2.5"><Sparkline values={c.attempts.map((a) => a.score)} /></td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted">{c.totalTimeMs ? formatDuration(c.totalTimeMs) : '—'}</td>
                          <td className="px-5 py-2.5 text-right text-xs text-muted">{new Date(c.lastAt).toLocaleDateString()}</td>
                        </tr>
                        {open === c.id && (
                          <tr className="bg-raised/60">
                            <td colSpan={9} className="px-5 py-3">
                              <AttemptList c={c} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {data.assessments.length > 0 && (
              <section>
                <Header title="Full assessments" hint="Overall score of each completed run" />
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.assessments.map((a) => (
                    <div key={a.id} className="card p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold leading-snug">{a.title}</h3>
                        {a.runs.length > 1 && <Delta value={a.improvement} />}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
                        <span>Runs <b className="ml-1 font-mono text-fg">{a.runs.length}</b></span>
                        <span>First <span className="ml-1"><ScorePill score={a.first} /></span></span>
                        <span>Best <span className="ml-1"><ScorePill score={a.best} /></span></span>
                        <span>Latest <span className="ml-1"><ScorePill score={a.latest} /></span></span>
                        <span className="flex-1" />
                        <Sparkline values={a.runs.map((r) => r.score)} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {a.runs.map((r, i) => (
                          <Link key={r.sessionId} href={`/results/${r.sessionId}`} className="badge hover:border-fg/30 hover:text-fg" title={new Date(r.at).toLocaleString()}>
                            #{i + 1} · {Math.round(r.score)}%
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function AttemptList({ c }: { c: ChallengeProgress }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="py-1 pr-3">#</th>
          <th className="py-1 pr-3">When</th>
          <th className="py-1 pr-3">Mode</th>
          <th className="py-1 pr-3 text-right">Score</th>
          <th className="py-1 pr-3 text-right">Tests passed</th>
          <th className="py-1 pr-3 text-right">vs previous</th>
          <th className="py-1 pr-3 text-right">Time</th>
          <th className="py-1 pr-3 text-right">Test runs</th>
          <th className="py-1" />
        </tr>
      </thead>
      <tbody>
        {c.attempts.map((a, i) => (
          <tr key={a.id} className="border-t border-line/70">
            <td className="py-1.5 pr-3 font-mono text-muted">{i + 1}</td>
            <td className="py-1.5 pr-3">{new Date(a.at).toLocaleString()}</td>
            <td className="py-1.5 pr-3 capitalize text-muted">{a.mode}</td>
            <td className="py-1.5 pr-3 text-right"><ScorePill score={a.score} /></td>
            <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{a.total !== null ? `${a.passed}/${a.total}` : '—'}</td>
            <td className="py-1.5 pr-3 text-right">{i > 0 ? <Delta value={a.score - c.attempts[i - 1].score} /> : <span className="text-muted">—</span>}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{a.timeSpentMs !== null ? formatDuration(a.timeSpentMs) : '—'}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums text-muted">{a.testRuns ?? '—'}</td>
            <td className="py-1.5 text-right">
              {a.current ? (
                <Link href={`/results/${a.sessionId}`} className="text-accent hover:underline">View result</Link>
              ) : (
                <span className="text-muted" title={a.recovered ? 'Recorded before retries kept full details: score only' : 'This section was retried afterwards'}>
                  {a.recovered ? 'retried · score only' : 'retried'}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Each attempt's score (dots) and the average of your best score per question so far (line). */
function TrendChart({ points }: { points: Analytics['timeline'] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 240;
  const pad = { l: 40, r: 48, t: 12, b: 26 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = points.length;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / 100) * ih;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.avgBest).toFixed(1)}`).join(' ');
  const last = points[n - 1];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = n === 1 ? 0 : Math.round(((px - pad.l) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const h = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-5 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-series-2" /> Attempt score</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-series-1" /> Average best score per question so far</span>
      </div>
      <div ref={ref} className="relative w-full min-w-0 overflow-hidden">
        <svg width={width} height={H} className="block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Score over time">
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">{t}%</text>
            </g>
          ))}
          <text x={pad.l} y={H - 6} className="fill-muted text-[11px]">{new Date(points[0].at).toLocaleDateString()}</text>
          {n > 1 && <text x={pad.l + iw} y={H - 6} textAnchor="end" className="fill-muted text-[11px]">{new Date(last.at).toLocaleDateString()}</text>}
          {h && <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={pad.t + ih} stroke="rgb(var(--muted) / 0.5)" strokeWidth={1} />}
          <path d={line} fill="none" stroke="rgb(var(--series-1))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.score)} r={hover === i ? 5.5 : 4} fill="rgb(var(--series-2))" stroke="rgb(var(--panel))" strokeWidth={2} />
          ))}
          <circle cx={x(n - 1)} cy={y(last.avgBest)} r={4} fill="rgb(var(--series-1))" stroke="rgb(var(--panel))" strokeWidth={2} />
          <text x={x(n - 1) + 10} y={y(last.avgBest)} dy="0.32em" className="fill-fg text-[12px] font-semibold">{Math.round(last.avgBest)}%</text>
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-md border border-line bg-panel px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(0, x(hover!) - 112), width - 224), top: 0 }}
          >
            <p className="truncate font-semibold">{h.title}</p>
            <p className="text-muted">{new Date(h.at).toLocaleString()}</p>
            <p className="mt-1.5 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-series-2" /> Score <b className="ml-auto font-mono">{Math.round(h.score * 10) / 10}%</b></p>
            <p className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-series-1" /> Avg best <b className="ml-auto font-mono">{h.avgBest}%</b></p>
          </div>
        )}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-fg">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full">
            <thead><tr className="text-left text-muted"><th className="py-1">#</th><th>When</th><th>Question</th><th className="text-right">Score</th><th className="text-right">Avg best</th></tr></thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="py-1 font-mono text-muted">{i + 1}</td>
                  <td>{new Date(p.at).toLocaleString()}</td>
                  <td className="max-w-xs truncate">{p.title}</td>
                  <td className="text-right font-mono">{Math.round(p.score * 10) / 10}%</td>
                  <td className="text-right font-mono">{p.avgBest}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 88;
  const H = 24;
  if (values.length < 2) return <span className="text-xs text-muted">—</span>;
  const x = (i: number) => 3 + (i / (values.length - 1)) * (W - 6);
  const y = (v: number) => 3 + (1 - v / 100) * (H - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} aria-label={`Scores: ${values.map((v) => Math.round(v)).join(', ')}`}>
      <title>{values.map((v) => `${Math.round(v)}%`).join(' → ')}</title>
      <path d={d} fill="none" stroke="rgb(var(--series-1))" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="rgb(var(--series-1))" />
    </svg>
  );
}

function Delta({ value }: { value: number }) {
  const v = Math.round(value * 10) / 10;
  if (Math.abs(v) < 0.05) return <span className="inline-flex items-center gap-0.5 text-xs text-muted"><Minus className="h-3 w-3" /> 0</span>;
  const up = v > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold ${up ? 'text-ok' : 'text-bad'}`}>
      <Icon className="h-3.5 w-3.5" />{up ? '+' : ''}{v} pts
    </span>
  );
}

function Tile({ label, value, delta }: { label: string; value: React.ReactNode; delta?: number | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2 text-2xl font-semibold">
        {value}
        {delta != null && Math.abs(delta) >= 0.05 && <Delta value={delta} />}
      </p>
    </div>
  );
}

function Header({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="hidden text-xs text-muted sm:block">{hint}</p>}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`);
function formatHours(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
