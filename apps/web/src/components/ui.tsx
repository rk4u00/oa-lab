'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Loader2, XCircle } from 'lucide-react';
import { api, type Health } from '@/lib/api';

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-mono text-sm font-bold tracking-[0.2em] text-fg">
      <span className="grid h-6 w-6 place-items-center rounded bg-accent text-[11px] tracking-normal text-black">OA</span>
      OA LAB
    </Link>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin text-muted`} />;
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="whitespace-pre-wrap break-words">{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}

export function HealthBadge() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.health().then(setH, () => setErr(true));
  }, []);
  if (err) return <span className="badge border-bad/40 text-bad">API offline</span>;
  if (!h) return <span className="badge"><Spinner className="h-3 w-3" /> connecting</span>;
  if (h.driver === 'local') return <span className="badge border-warn/40 text-warn" title="Code runs on the host without isolation">local driver · unsafe</span>;
  return h.docker ? (
    <span className="badge border-ok/40 text-ok">● Docker sandbox</span>
  ) : (
    <span className="badge border-bad/40 text-bad" title="Start Docker Desktop">Docker unavailable</span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'text-muted',
  READY: 'text-muted',
  CREATED: 'text-muted',
  IN_PROGRESS: 'text-accent border-accent/40',
  SUBMITTED: 'text-ok border-ok/40',
  EXPIRED: 'text-warn border-warn/40',
  SKIPPED: 'text-muted',
  ABANDONED: 'text-muted',
};

export function StatusBadge({ status }: { status: string }) {
  const Icon = status === 'SUBMITTED' ? CheckCircle2 : status === 'EXPIRED' ? Clock : status === 'IN_PROGRESS' ? CircleDashed : status === 'ABANDONED' ? XCircle : null;
  return (
    <span className={`badge ${STATUS_STYLE[status] ?? ''}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {status.replace('_', ' ').toLowerCase()}
    </span>
  );
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-muted">—</span>;
  const color = score >= 99.9 ? 'text-ok' : score >= 50 ? 'text-warn' : 'text-bad';
  return <span className={`font-mono font-semibold ${color}`}>{Math.round(score * 10) / 10}%</span>;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-5 shadow-2xl">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-muted">{body}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner className="h-3.5 w-3.5" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Server-synchronised countdown. `serverTime` is used to correct for client clock skew. */
export function useCountdown(deadline: string | null | undefined, serverTime?: string) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (serverTime) setOffset(new Date(serverTime).getTime() - Date.now());
  }, [serverTime]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  return Math.max(0, new Date(deadline).getTime() - (now + offset));
}
