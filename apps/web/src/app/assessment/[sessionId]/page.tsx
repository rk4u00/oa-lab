'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Info, Play, RotateCcw, Send, Timer } from 'lucide-react';
import { api, formatDuration, type Session, type SessionSection } from '@/lib/api';
import { ConfirmDialog, ErrorBox, HealthBadge, Logo, ScorePill, Spinner, StatusBadge, useCountdown } from '@/components/ui';

const AI_POLICY: Record<string, string> = {
  allowed: 'AI assistants are allowed in this assessment. Use them like you would on the job — but understand every change.',
  'coach-only': 'AI may be used for hints only (coach mode). Do not let it edit files.',
  disabled: 'AI assistance is not permitted in this assessment.',
};

export default function SessionOverview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    null | { kind: 'section'; section: SessionSection } | { kind: 'retry'; section: SessionSection } | { kind: 'all' } | { kind: 'abandon' }
  >(null);

  const load = useCallback(async () => {
    try {
      setSession(await api.session(sessionId));
    } catch (e) {
      setError(e);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (key: string, fn: () => Promise<Session>, after?: (s: Session) => void) => {
    setBusy(key);
    setError(null);
    try {
      const s = await fn();
      setSession(s);
      after?.(s);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const openSection = (s: SessionSection) => {
    const ws = s.challenges[0]?.workspaceId;
    if (ws) router.push(`/assessment/${sessionId}/workspace/${ws}`);
  };

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center">
        {error ? <div className="max-w-md"><ErrorBox error={error} /></div> : <Spinner className="h-6 w-6" />}
      </div>
    );
  }

  const finished = ['SUBMITTED', 'EXPIRED', 'ABANDONED'].includes(session.status);
  const active = session.sections.find((s) => s.status === 'IN_PROGRESS');

  return (
    <div className="min-h-screen">
      <header className="topnav">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Logo />
          <HealthBadge />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label">Assessment</p>
            <h1 className="mt-1 text-2xl font-semibold">{session.assessment.title}</h1>
            {session.assessment.subtitle && <p className="text-sm text-muted">{session.assessment.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={session.status} />
            {finished && (
              <Link className="btn btn-primary" href={`/results/${session.id}`}>
                View results <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <ErrorBox error={error} />

        <div className="card flex gap-3 p-4 text-sm">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <p className="font-medium">AI assistance: {session.assessment.aiAssistance}</p>
            <p className="text-muted">{AI_POLICY[session.assessment.aiAssistance] ?? ''}</p>
          </div>
        </div>

        <div className="space-y-3">
          {session.sections.map((s, i) => (
            <SectionRow
              key={s.id}
              index={i}
              section={s}
              serverTime={session.serverTime}
              busy={busy}
              blocked={!!active && active.id !== s.id}
              finished={finished}
              onStart={() => act(`start-${s.id}`, () => api.startSection(sessionId, s.id), (ns) => {
                const sec = ns.sections.find((x) => x.id === s.id);
                if (sec) openSection(sec);
              })}
              onOpen={() => openSection(s)}
              onSubmit={() => setConfirm({ kind: 'section', section: s })}
              onRetry={() => setConfirm({ kind: 'retry', section: s })}
              canRetry={session.status !== 'ABANDONED'}
            />
          ))}
        </div>

        {!finished && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <button className="btn btn-ghost text-muted" onClick={() => setConfirm({ kind: 'abandon' })}>Abandon attempt</button>
            <button className="btn btn-primary" onClick={() => setConfirm({ kind: 'all' })}>
              <Send className="h-3.5 w-3.5" /> Submit assessment
            </button>
          </div>
        )}

        {session.assessment.disclaimer && (
          <p className="flex gap-2 text-xs text-muted"><Info className="h-3.5 w-3.5 shrink-0" />{session.assessment.disclaimer}</p>
        )}
      </main>

      <ConfirmDialog
        open={confirm?.kind === 'retry'}
        title="Re-attempt this section?"
        body={
          confirm?.kind === 'retry' ? (
            <>
              You get a fresh copy of <strong className="text-fg">{confirm.section.challenges.map((c) => c.title).join(', ')}</strong> and a new{' '}
              {confirm.section.durationMinutes}-minute timer, starting now.
              <br />
              <br />
              Your previous result{confirm.section.score !== null ? ` (${Math.round((confirm.section.score ?? 0) * 10) / 10}%)` : ''} and its changes are replaced. It stays
              listed in this attempt&apos;s timeline.
            </>
          ) : null
        }
        confirmLabel="Start re-attempt"
        busy={confirm?.kind === 'retry' && busy === `retry-${confirm.section.id}`}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.kind === 'retry' &&
          act(`retry-${confirm.section.id}`, () => api.retrySection(sessionId, confirm.section.id), (ns) => {
            const sec = ns.sections.find((x) => x.id === confirm.section.id);
            if (sec) openSection(sec);
          })
        }
      />
      <ConfirmDialog
        open={confirm?.kind === 'section'}
        title="Submit this section?"
        body="Protected test files are restored, the full test suite is run and your score is recorded. You can't edit this section afterwards."
        confirmLabel="Submit section"
        busy={!!busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'section' && act(`submit-${confirm.section.id}`, () => api.submitSection(sessionId, confirm.section.id))}
      />
      <ConfirmDialog
        open={confirm?.kind === 'all'}
        title="Submit the whole assessment?"
        body="The active section is graded and any sections you haven't started are skipped with a score of 0."
        confirmLabel="Submit assessment"
        busy={!!busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => act('submit-all', () => api.submitSession(sessionId), () => router.push(`/results/${sessionId}`))}
      />
      <ConfirmDialog
        open={confirm?.kind === 'abandon'}
        title="Abandon this attempt?"
        body="Workspaces are stopped and the attempt is marked abandoned. It won't be scored."
        confirmLabel="Abandon"
        danger
        busy={!!busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => act('abandon', () => api.abandonSession(sessionId), () => router.push('/'))}
      />
    </div>
  );
}

function SectionRow({
  index,
  section: s,
  serverTime,
  busy,
  blocked,
  finished,
  onStart,
  onOpen,
  onSubmit,
  onRetry,
  canRetry,
}: {
  index: number;
  section: SessionSection;
  serverTime: string;
  busy: string | null;
  blocked: boolean;
  finished: boolean;
  onStart: () => void;
  onOpen: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const remaining = useCountdown(s.status === 'IN_PROGRESS' ? s.deadline : null, serverTime);
  const done = s.status === 'SUBMITTED' || s.status === 'EXPIRED' || s.status === 'SKIPPED';
  return (
    <div className={`card p-4 ${s.status === 'IN_PROGRESS' ? 'border-accent/50' : ''}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-raised font-mono text-xs">
          {done ? <CheckCircle2 className="h-4 w-4 text-ok" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{s.title}</p>
          <p className="text-xs text-muted">
            {s.challenges.map((c) => c.title).join(' · ')} · <Timer className="inline h-3 w-3" /> {s.durationMinutes} min
          </p>
        </div>
        {remaining !== null && (
          <span className={`font-mono text-sm ${remaining < 5 * 60_000 ? 'text-bad' : 'text-accent'}`}>{formatDuration(remaining)}</span>
        )}
        <StatusBadge status={s.status} />
        {done && <ScorePill score={s.score} />}
        {done && canRetry && (
          <button className="btn btn-outline" disabled={!!busy || blocked} onClick={onRetry} title={blocked ? 'Finish the active section first' : 'Start this section again with a fresh repository and timer'}>
            {busy === `retry-${s.id}` ? <Spinner className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />} Retry
          </button>
        )}
        {!finished && s.status === 'PENDING' && (
          <button className="btn btn-primary" disabled={!!busy || blocked} onClick={onStart} title={blocked ? 'Finish the active section first' : undefined}>
            {busy === `start-${s.id}` ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Start
          </button>
        )}
        {s.status === 'IN_PROGRESS' && (
          <>
            <button className="btn btn-primary" onClick={onOpen} disabled={!s.challenges[0]?.workspaceId}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button className="btn" disabled={!!busy} onClick={onSubmit}>
              {busy === `submit-${s.id}` ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} Submit
            </button>
          </>
        )}
      </div>
    </div>
  );
}
