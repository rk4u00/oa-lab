'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { History, TrendingUp } from 'lucide-react';
import { api, type SessionListItem } from '@/lib/api';
import { ErrorBox, HealthBadge, MainNav, ScorePill, Spinner, StatusBadge, TopNav } from '@/components/ui';

const FILTERS: Record<string, { label: string; match: (s: SessionListItem) => boolean }> = {
  all: { label: 'All', match: () => true },
  done: { label: 'Completed', match: (s) => s.status === 'SUBMITTED' || s.status === 'EXPIRED' },
  open: { label: 'In progress', match: (s) => s.status === 'IN_PROGRESS' || s.status === 'READY' || s.status === 'CREATED' },
  abandoned: { label: 'Abandoned', match: (s) => s.status === 'ABANDONED' },
};

export default function SubmissionsPage() {
  const [history, setHistory] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.sessions().then(setHistory, (e) => {
      setError(e);
      setHistory([]);
    });
  }, []);

  const rows = (history ?? []).filter(FILTERS[filter].match);

  return (
    <div className="min-h-screen">
      <TopNav>
        <MainNav />
        <div className="flex-1" />
        <HealthBadge />
      </TopNav>

      <section className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-5 py-8">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><History className="h-6 w-6 text-accent" /> Submissions</h1>
            <p className="mt-2 text-muted">Your assessment and practice attempts. Open one to see its results or carry on where you left off.</p>
          </div>
          <Link href="/progress" className="btn btn-outline">
            <TrendingUp className="h-4 w-4" /> Progress and score history
          </Link>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-4 px-5 py-8">
        <ErrorBox error={error} />
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FILTERS).map(([k, f]) => (
            <button key={k} className={`btn btn-sm ${filter === k ? 'border-accent text-accent' : ''}`} onClick={() => setFilter(k)}>
              {f.label}
              {history && <span className="text-muted">{history.filter(f.match).length}</span>}
            </button>
          ))}
        </div>

        {history === null ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="card p-6 text-sm text-muted">
            {history.length === 0 ? (
              <>No attempts yet. Start one from the <Link href="/" className="text-accent underline">dashboard</Link>.</>
            ) : (
              'Nothing matches this filter.'
            )}
          </p>
        ) : (
          <div className="card overflow-hidden">
            <div className="grid grid-cols-[1fr_110px_64px] gap-3 border-b border-line bg-raised px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid-cols-[1fr_90px_120px_80px_170px]">
              <span>Assessment</span>
              <span className="hidden sm:block">Type</span>
              <span>Status</span>
              <span className="text-right">Score</span>
              <span className="hidden text-right sm:block">Started</span>
            </div>
            <div className="divide-y divide-line">
              {rows.map((h) => {
                const done = h.status === 'SUBMITTED' || h.status === 'EXPIRED';
                return (
                  <Link
                    key={h.id}
                    href={done ? `/results/${h.id}` : `/assessment/${h.id}`}
                    className="grid grid-cols-[1fr_110px_64px] items-center gap-3 px-5 py-2.5 text-[13px] hover:bg-raised sm:grid-cols-[1fr_90px_120px_80px_170px]"
                  >
                    <span className="truncate font-medium">{h.title}</span>
                    <span className="hidden text-xs text-muted sm:block">{h.assessmentId.startsWith('practice-') ? 'Practice' : 'Assessment'}</span>
                    <span><StatusBadge status={h.status} /></span>
                    <span className="text-right"><ScorePill score={h.score} /></span>
                    <span className="hidden text-right text-xs text-muted sm:block">{new Date(h.createdAt).toLocaleString()}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
