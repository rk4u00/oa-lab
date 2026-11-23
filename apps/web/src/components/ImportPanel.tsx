'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { api, type ImportResult } from '@/lib/api';
import { ErrorBox, Spinner } from '@/components/ui';

/** Repository importer. Removed from the dashboard; kept for the upcoming admin panel. */
export function ImportPanel({ onImported }: { onImported: () => void }) {
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
    <section id="import" className="scroll-mt-20">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Download className="h-4 w-4" />Import repository</h2>
        <p className="hidden text-xs text-muted sm:block">Django, Spring Boot (Maven) and Node.js projects are detected automatically.</p>
      </div>
      <form onSubmit={submit} className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <input className="input font-mono" placeholder="https://github.com/owner/repo  or  /path/to/local/repo" value={source} onChange={(e) => setSource(e.target.value)} />
          <input className="input" placeholder="company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button className="btn btn-primary justify-center" disabled={busy || !source.trim()}>
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} Import
          </button>
        </div>
        <p className="text-xs text-muted">
          Imported code goes to the local <code className="font-mono">imports/</code> folder. Nothing from it is executed until a session starts — and then only inside the sandbox.
        </p>
        <ErrorBox error={error} />
        {result && (
          <div className="rounded border border-ok/40 bg-ok/5 p-3 text-sm">
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
