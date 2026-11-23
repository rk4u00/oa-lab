'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, FileDiff } from 'lucide-react';
import type { DiffFile } from '@/lib/api';

function lineClass(l: string) {
  if (l.startsWith('+++') || l.startsWith('---')) return 'text-muted';
  if (l.startsWith('@@')) return 'text-sky-700 bg-sky-50';
  if (l.startsWith('+')) return 'text-ok bg-ok/10';
  if (l.startsWith('-')) return 'text-bad bg-bad/10';
  if (l.startsWith('=====') || l.startsWith('Index:')) return 'hidden';
  return 'text-fg/70';
}

export function PatchBlock({ patch }: { patch: string }) {
  return (
    <pre className="overflow-x-auto bg-panel font-mono text-[12px] leading-[1.55]">
      {patch.split('\n').map((l, i) => (
        <div key={i} className={`whitespace-pre px-3 ${lineClass(l)}`}>{l || ' '}</div>
      ))}
    </pre>
  );
}

export function DiffView({ files, empty = 'No changes yet.' }: { files: DiffFile[]; empty?: string }) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  if (!files.length) return <div className="p-4 text-sm text-muted">{empty}</div>;
  return (
    <div className="space-y-2 p-2">
      {files.map((f) => (
        <div key={f.path} className="overflow-hidden rounded-md border border-line">
          <button
            className="flex w-full items-center gap-2 bg-raised px-3 py-1.5 text-left font-mono text-xs"
            onClick={() => setClosed((c) => ({ ...c, [f.path]: !c[f.path] }))}
          >
            {closed[f.path] ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <FileDiff className="h-3.5 w-3.5 text-muted" />
            <span className="flex-1 truncate">{f.path}</span>
            <span className={`badge ${f.status === 'added' ? 'text-ok' : f.status === 'deleted' ? 'text-bad' : 'text-accent'}`}>{f.status}</span>
          </button>
          {!closed[f.path] && <PatchBlock patch={f.patch} />}
        </div>
      ))}
    </div>
  );
}

/** Split a combined unified patch (as stored on submissions) into per-file chunks. */
export function splitPatch(patch: string): DiffFile[] {
  if (!patch.trim()) return [];
  const chunks = patch.split(/\n(?====================================================================\n)|(?=^Index: )/m).filter((c) => c.trim());
  return chunks.map((c) => {
    const m = c.match(/^\+\+\+ b\/(.+?)(\t|$)/m) ?? c.match(/^--- a\/(.+?)(\t|$)/m) ?? c.match(/^Index: (.+)$/m);
    const p = m?.[1] ?? 'file';
    const added = /^--- a\/.*\n\+\+\+/m.test(c) && !/^-[^-]/m.test(c);
    const deleted = !/^\+[^+]/m.test(c) && /^-[^-]/m.test(c);
    return { path: p, status: added ? 'added' : deleted ? 'deleted' : 'modified', patch: c } as DiffFile;
  });
}
