'use client';

import { useState } from 'react';
import { Bot, Check, ClipboardCopy, FileText, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Markdown } from '@/components/Markdown';
import { ErrorBox, Spinner } from '@/components/ui';

export function TaskPanel({ workspaceId, task, aiCoach, aiPolicy }: { workspaceId: string; task: string; aiCoach: boolean; aiPolicy?: string }) {
  const [tab, setTab] = useState<'task' | 'coach'>('task');
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);

  const loadCoach = async () => {
    setLoading(true);
    setError(null);
    try {
      setPrompt((await api.coach(workspaceId)).prompt);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!prompt) return;
    await navigator.clipboard.writeText(prompt).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showCoach = aiCoach && aiPolicy !== 'disabled';

  return (
    <div className="flex h-full flex-col bg-panel">
      <div className="flex h-11 shrink-0 items-end gap-1 border-b border-line px-4">
        <TabButton active={tab === 'task'} onClick={() => setTab('task')}><FileText className="h-3.5 w-3.5" /> Question</TabButton>
        {showCoach && (
          <TabButton active={tab === 'coach'} onClick={() => { setTab('coach'); if (!prompt) void loadCoach(); }}>
            <Bot className="h-3.5 w-3.5" /> AI Coach
          </TabButton>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        {tab === 'task' ? (
          <Markdown>{task}</Markdown>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              Paste this prompt into your AI assistant (Claude Code, Cursor, Copilot, …). It contains the task and your latest failing tests, and asks for <strong className="text-fg">hints, not edits</strong>.
            </p>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-primary" onClick={copy} disabled={!prompt}>
                {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy prompt'}
              </button>
              <button className="btn btn-sm" onClick={loadCoach} disabled={loading}>
                {loading ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />} Refresh with latest run
              </button>
            </div>
            <ErrorBox error={error} />
            {prompt && <pre className="whitespace-pre-wrap rounded border border-line bg-raised p-3 font-mono text-[11px] leading-relaxed text-fg/80">{prompt}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

export function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px flex h-full items-center gap-1.5 border-b-2 px-3 text-[13px] font-semibold transition ${active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
