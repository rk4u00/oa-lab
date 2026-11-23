'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, CircleSlash, XCircle } from 'lucide-react';
import type { TestCaseResult } from '@oa-lab/shared';

export function TestSummaryBar({ passed, total, failed }: { passed: number; total: number; failed: number }) {
  const pct = total ? (passed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-44 overflow-hidden rounded-full bg-bad/20">
        <div className="h-full bg-ok transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs">
        <span className="text-ok">{passed} passed</span>
        {failed > 0 && <span className="text-bad"> · {failed} failed</span>}
        <span className="text-muted"> · {total} total</span>
      </span>
    </div>
  );
}

export function TestList({ tests }: { tests: TestCaseResult[] }) {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const sorted = tests.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t.status) - rank(b.t.status));
  return (
    <ul className="divide-y divide-line/60">
      {sorted.map(({ t, i }) => {
        const failed = t.status === 'failed' || t.status === 'error';
        const Icon = t.status === 'passed' ? CheckCircle2 : t.status === 'skipped' ? CircleSlash : XCircle;
        return (
          <li key={i}>
            <button
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] hover:bg-raised/60"
              onClick={() => t.message && setOpen((o) => ({ ...o, [i]: !o[i] }))}
            >
              {t.message ? (open[i] ? <ChevronDown className="h-3 w-3 text-muted" /> : <ChevronRight className="h-3 w-3 text-muted" />) : <span className="w-3" />}
              <Icon className={`h-3.5 w-3.5 shrink-0 ${failed ? 'text-bad' : t.status === 'passed' ? 'text-ok' : 'text-muted'}`} />
              <span className="flex-1 truncate font-mono">{t.name}</span>
              {t.durationMs !== undefined && <span className="font-mono text-muted">{t.durationMs}ms</span>}
            </button>
            {open[i] && t.message && (
              <pre className="mx-3 mb-2 max-h-72 overflow-auto rounded border border-bad/20 bg-bad/5 p-2 font-mono text-[11px] leading-relaxed text-bad/90">{t.message}</pre>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function rank(s: string) {
  return s === 'failed' || s === 'error' ? 0 : s === 'passed' ? 1 : 2;
}
