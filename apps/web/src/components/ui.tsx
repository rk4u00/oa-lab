'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Loader2, XCircle } from 'lucide-react';
import { api, type Health } from '@/lib/api';

export function Logo({ href = '/', light = true }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-2 text-[15px] font-bold tracking-tight ${light ? 'text-white' : 'text-fg'}`}>
      <LogoMark className="h-7 w-7" />
      <span>OA&nbsp;Lab</span>
    </Link>
  );
}

/** OA Lab mark: a lab flask holding a code bracket. Same artwork as app/icon.svg (favicon). */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#1E9D50" />
      <path d="M25 12h14M27.5 12v13.5L15.8 46.2A5 5 0 0 0 20.2 53.5h23.6a5 5 0 0 0 4.4-7.3L36.5 25.5V12" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M27 36.5l-4.5 4.5 4.5 4.5M37 36.5l4.5 4.5-4.5 4.5M33.5 34.5l-3 13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dark navy top navigation bar used across the app. */
export function TopNav({ children, href = '/' }: { children?: React.ReactNode; href?: string }) {
  return (
    <header className="topnav sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-5">
        <Logo href={href} />
        {children}
      </div>
    </header>
  );
}

const NAV = [
  { href: '/', label: 'Practice' },
  { href: '/assessments', label: 'Assessments' },
  { href: '/submissions', label: 'Submissions' },
  { href: '/progress', label: 'Progress' },
];

/** Main navigation shared by the Practice, Assessments, Submissions and Progress pages. */
export function MainNav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto text-sm font-medium text-white/70">
      {NAV.map((n) => {
        const active = n.href === path;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded px-2.5 py-1.5 hover:bg-white/10 hover:text-white sm:px-3 ${active ? 'bg-white/10 text-white' : ''}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function DifficultyText({ level }: { level: string }) {
  return <span className={`text-xs font-semibold capitalize diff-${level}`}>{level}</span>;
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
  const pill = 'hidden shrink-0 items-center gap-1.5 rounded-full sm:inline-flex border border-white/15 px-2.5 py-0.5 text-[11px] font-medium';
  if (err) return <span className={`${pill} text-red-300`}>● API offline</span>;
  if (!h) return <span className={`${pill} text-white/60`}><Spinner className="h-3 w-3" /> connecting</span>;
  if (h.driver === 'local') return <span className={`${pill} text-amber-300`} title="Code runs on the host without isolation">● Local driver (unsafe)</span>;
  return h.docker ? (
    <span className={`${pill} text-emerald-300`}>● Sandbox ready</span>
  ) : (
    <span className={`${pill} text-red-300`} title="Start Docker Desktop">● Docker unavailable</span>
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-nav/50 p-4">
      <div className="w-full max-w-md rounded-md bg-panel shadow-2xl">
        <h3 className="border-b border-line px-5 py-3.5 text-base font-bold">{title}</h3>
        <div className="px-5 py-4 text-sm leading-relaxed text-muted">{body}</div>
        <div className="flex justify-end gap-2 border-t border-line bg-raised px-5 py-3">
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
