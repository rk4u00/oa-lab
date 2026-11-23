'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDashed, ClipboardList, Clock, Code2, History, Loader2, TrendingUp, XCircle } from 'lucide-react';
import { api, type Health, type SessionListItem } from '@/lib/api';

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

const NAV = [
  { href: '/', label: 'Practice', icon: Code2 },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList },
  { href: '/submissions', label: 'Submissions', icon: History },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
];

/**
 * Header for the Practice, Assessments, Submissions and Progress pages: logo, menu, a Resume button while an
 * attempt is open, and sandbox status. On phones the menu becomes a bottom tab bar (pages add `pb-16 md:pb-0`).
 */
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState<SessionListItem | null>(null);
  useEffect(() => {
    api.sessions().then((list) => setOpen(list.find((s) => s.status === 'IN_PROGRESS' || s.status === 'READY') ?? null), () => undefined);
  }, []);

  return (
    <>
      <header className="topnav sticky top-0 z-30 border-b border-navline shadow-[0_1px_0_rgba(0,0,0,0.25)]">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center gap-4 px-4 sm:px-5">
          <Logo />
          <span className="hidden h-6 w-px bg-white/15 md:block" />
          <nav className="hidden h-full items-stretch gap-1 md:flex" aria-label="Main">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === path;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-2 px-3 text-[13.5px] font-semibold transition-colors ${active ? 'text-white' : 'text-white/60 hover:text-white'}`}
                >
                  <span className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${active ? '' : 'group-hover:bg-white/[0.07]'}`}>
                    <Icon className={`h-4 w-4 ${active ? 'text-accent' : 'text-white/45 group-hover:text-white/80'}`} />
                    {label}
                  </span>
                  <span className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-accent transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          {open && (
            <Link
              href={`/assessment/${open.id}`}
              title={open.title}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-accent/50 bg-accent/15 pl-2.5 pr-3 text-xs font-semibold text-white transition hover:bg-accent/25"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Resume<span className="hidden max-w-[180px] truncate font-normal text-white/70 lg:inline">· {open.title}</span>
              <ChevronRight className="-mr-1 h-3.5 w-3.5 text-white/60" />
            </Link>
          )}
          <HealthBadge />
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-navline bg-nav pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === path;
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-white' : 'text-white/55'}`}>
              <span className={`absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-accent ${active ? '' : 'hidden'}`} />
              <Icon className={`h-5 w-5 ${active ? 'text-accent' : ''}`} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

/** Shimmering placeholder block; size it with width/height classes. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** Placeholder rows for a list or table while it loads. */
export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`card divide-y divide-line ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
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
  const pill = 'hidden h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[11px] font-medium ring-1 ring-inset ring-white/10 md:inline-flex';
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
