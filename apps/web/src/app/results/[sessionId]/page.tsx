'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, FlaskConical, ListChecks } from 'lucide-react';
import { api, formatDuration, type Results } from '@/lib/api';
import { DiffView, splitPatch } from '@/components/DiffView';
import { TestList, TestSummaryBar } from '@/components/TestResultsView';
import { ErrorBox, Logo, ScorePill, Spinner, StatusBadge } from '@/components/ui';

export default function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.results(sessionId).then(setData, setError);
  }, [sessionId]);

  if (!data) {
    return <div className="grid min-h-screen place-items-center">{error ? <ErrorBox error={error} /> : <Spinner className="h-6 w-6" />}</div>;
  }

  const { session, submissions, events, testRunsByWorkspace } = data;
  const totalTime = submissions.reduce((n, s) => n + (s.timeSpentMs ?? 0), 0);
  const runs = Object.values(testRunsByWorkspace).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen">
      <header className="topnav">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <Link href="/" className="btn-nav"><ArrowLeft className="h-3.5 w-3.5" /> Dashboard</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Assessment report</p>
            <h1 className="mt-1 text-2xl font-semibold">{session.assessment.title}</h1>
            <p className="text-sm text-muted">{session.submittedAt ? `Submitted ${new Date(session.submittedAt).toLocaleString()}` : 'Not yet submitted'}</p>
          </div>
          <StatusBadge status={session.status} />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Overall score" value={<span className="text-3xl"><ScorePill score={session.score} /></span>} />
          <Stat label="Sections" value={`${session.sections.filter((s) => s.status === 'SUBMITTED' || s.status === 'EXPIRED').length} / ${session.sections.length}`} icon={<ListChecks className="h-4 w-4" />} />
          <Stat label="Time spent" value={formatDuration(totalTime)} icon={<Clock className="h-4 w-4" />} />
          <Stat label="Test runs" value={String(runs)} icon={<FlaskConical className="h-4 w-4" />} />
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Sections</h2>
          {session.sections.map((sec) => (
            <div key={sec.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <p className="flex-1 font-medium">{sec.title}</p>
                <StatusBadge status={sec.status} />
                <ScorePill score={sec.score} />
              </div>
              {sec.challenges.map((c) => {
                const sub = submissions.find((s) => s.sectionId === sec.id && s.challengeId === c.id);
                return (
                  <div key={c.id} className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex-1 text-muted">{c.title}</span>
                      {sub?.timeSpentMs != null && <span className="font-mono text-xs text-muted">{formatDuration(sub.timeSpentMs)}</span>}
                      {c.workspaceId && <span className="font-mono text-xs text-muted">{testRunsByWorkspace[c.workspaceId] ?? 0} runs</span>}
                    </div>
                    {!sub ? (
                      <p className="text-sm text-muted">{sec.status === 'SKIPPED' ? 'Skipped.' : 'Not submitted.'}</p>
                    ) : sub.testRun ? (
                      <>
                        <TestSummaryBar passed={sub.testRun.passed} failed={sub.testRun.failed} total={sub.testRun.total} />
                        <div className="rounded-md border border-line"><TestList tests={sub.testRun.tests} /></div>
                        <details className="rounded-md border border-line">
                          <summary className="cursor-pointer px-3 py-2 text-sm">Submitted changes ({splitPatch(sub.diff).length} files)</summary>
                          <DiffView files={splitPatch(sub.diff)} empty="No changes were made." />
                        </details>
                      </>
                    ) : (
                      <p className="text-sm text-bad">Final test run could not be executed.</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Timeline</h2>
          <ol className="relative space-y-3 border-l border-line pl-5">
            {events.map((e, i) => (
              <li key={i} className="text-sm">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-line bg-raised" />
                <span className="font-mono text-xs text-muted">{new Date(e.at).toLocaleTimeString()}</span>{' '}
                <span>{e.type}</span>
                {e.payload != null && <span className="ml-2 font-mono text-xs text-muted">{JSON.stringify(e.payload)}</span>}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="label flex items-center gap-1.5">{icon}{label}</p>
      <div className="mt-2 font-mono text-xl">{value}</div>
    </div>
  );
}
