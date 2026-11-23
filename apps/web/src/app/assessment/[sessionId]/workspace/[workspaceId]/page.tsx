'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import { ArrowLeft, CheckCircle2, Clock, FileCode2, FileDiff, FlaskConical, LayoutList, Lock, PanelLeftClose, PanelLeftOpen, Play, RefreshCw, RotateCcw, ShieldCheck, SquareTerminal, X } from 'lucide-react';
import type { FileNode } from '@oa-lab/shared';
import { api, formatDuration, frameworkLabel, type Diff, type Session, type TestRun, type WorkspaceDetails } from '@/lib/api';
import { ConfirmDialog, ErrorBox, Logo, Spinner, useCountdown } from '@/components/ui';
import { CodeEditor } from '@/components/ide/CodeEditor';
import { FileTree, isReadOnlyPath } from '@/components/ide/FileTree';
import { TabButton, TaskPanel } from '@/components/ide/TaskPanel';
import { TerminalPane } from '@/components/ide/TerminalPane';
import { DiffView } from '@/components/DiffView';
import { TestList, TestSummaryBar } from '@/components/TestResultsView';

interface Tab {
  path: string;
  content: string;
  saved: string;
  readOnly: boolean;
  binary: boolean;
}

type BottomTab = 'terminal' | 'tests' | 'diff';

export default function WorkspacePage() {
  const { sessionId, workspaceId } = useParams<{ sessionId: string; workspaceId: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<WorkspaceDetails | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<unknown>(null);

  const loadDetails = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.workspace(workspaceId), api.session(sessionId)]);
      setDetails(d);
      setSession(s);
      return d;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [workspaceId, sessionId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  // Poll while dependencies are being prepared.
  useEffect(() => {
    if (details?.status !== 'PREPARING' && details?.status !== 'READY') return;
    const t = setInterval(loadDetails, 2000);
    return () => clearInterval(t);
  }, [details?.status, loadDetails]);

  if (error && !details) return <Centered><ErrorBox error={error} /></Centered>;
  if (!details || !session) return <Centered><Spinner className="h-6 w-6" /></Centered>;

  if (details.status === 'PREPARING' || details.status === 'READY') {
    return (
      <Centered>
        <div className="card max-w-lg space-y-3 p-8 text-center">
          <Spinner className="mx-auto h-7 w-7" />
          <h2 className="text-lg font-bold">Preparing your workspace</h2>
          <p className="text-sm text-muted">
            Creating a fresh copy of <span className="text-fg">{details.manifest.title}</span> and starting its {frameworkLabel(details.manifest.runtime)} sandbox.
            The first time a challenge is used its dependencies are installed — this can take a few minutes. Your timer is already running.
          </p>
        </div>
      </Centered>
    );
  }

  if (details.status === 'FAILED') {
    return (
      <Centered>
        <div className="card w-full max-w-3xl space-y-3 p-6">
          <h2 className="font-semibold text-bad">Workspace failed to start</h2>
          <ErrorBox error={details.error ?? 'Unknown error'} />
          {details.prepareLog && <pre className="max-h-96 overflow-auto rounded border border-line bg-raised p-3 font-mono text-[11px] text-muted">{details.prepareLog}</pre>}
          <p className="text-sm text-muted">Check that Docker is running and the runtime images are built (<code className="font-mono">pnpm runtimes:build</code>).</p>
          <Link href={`/assessment/${sessionId}`} className="btn"><ArrowLeft className="h-3.5 w-3.5" /> Back to assessment</Link>
        </div>
      </Centered>
    );
  }

  return <Ide details={details} session={session} sessionId={sessionId} workspaceId={workspaceId} onRefresh={loadDetails} onExpired={() => router.push(`/assessment/${sessionId}`)} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center p-4">{children}</div>;
}

function Ide({
  details,
  session,
  sessionId,
  workspaceId,
  onRefresh,
  onExpired,
}: {
  details: WorkspaceDetails;
  session: Session;
  sessionId: string;
  workspaceId: string;
  onRefresh: () => Promise<WorkspaceDetails | null>;
  onExpired: () => void;
}) {
  const router = useRouter();
  const active = details.section.status === 'IN_PROGRESS';
  const remaining = useCountdown(active ? details.section.deadline : null, session.serverTime);
  const features = details.manifest.features;

  const [tree, setTree] = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [task, setTask] = useState('');
  const [bottom, setBottom] = useState<BottomTab>('tests');
  const [testRun, setTestRun] = useState<TestRun | null>(null);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState('');
  const [diff, setDiff] = useState<Diff | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [taskOpen, setTaskOpen] = useState(true);
  const [confirm, setConfirm] = useState<null | 'submit' | 'reset'>(null);
  const [busy, setBusy] = useState(false);
  const taskRef = useRef<ImperativePanelHandle>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const expiredRef = useRef(false);

  const loadTree = useCallback(async () => {
    try {
      const t = await api.files(workspaceId);
      setTree(t);
      // Open the README (or the first top-level file) so the editor is never empty on arrival.
      if (tabsRef.current.length === 0) {
        const first = t.find((n) => n.type === 'file' && /^readme\.md$/i.test(n.name)) ?? t.find((n) => n.type === 'file');
        if (first) void openFileRef.current?.(first.path);
      }
    } catch (e) {
      setError(e);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadTree();
    api.challenge(details.challengeId).then((c) => setTask(c.task), setError);
    api.latestRun(workspaceId).then((r) => r && setTestRun(r), () => undefined);
  }, [workspaceId, details.challengeId, loadTree]);

  // Timer expiry → server auto-submits; take the candidate back to the overview.
  useEffect(() => {
    if (remaining === 0 && active && !expiredRef.current) {
      expiredRef.current = true;
      setTimeout(async () => {
        await onRefresh();
        onExpired();
      }, 1500);
    }
  }, [remaining, active, onRefresh, onExpired]);

  const openFileRef = useRef<((p: string) => Promise<void>) | null>(null);
  const openFile = useCallback(
    async (path: string) => {
      setActivePath(path);
      if (tabsRef.current.some((t) => t.path === path)) return;
      try {
        const f = await api.file(workspaceId, path);
        const ro = f.readOnly || f.binary || isReadOnlyPath(details.manifest.readOnly, path);
        setTabs((ts) => (ts.some((t) => t.path === path) ? ts : [...ts, { path, content: f.content, saved: f.content, readOnly: ro, binary: f.binary }]));
      } catch (e) {
        setError(e);
      }
    },
    [workspaceId, details.manifest.readOnly],
  );

  openFileRef.current = openFile;

  const save = useCallback(
    async (path: string) => {
      const tab = tabsRef.current.find((t) => t.path === path);
      if (!tab || tab.readOnly || tab.content === tab.saved || !active) return;
      const content = tab.content;
      setSaveState('saving');
      try {
        await api.saveFile(workspaceId, path, content);
        setTabs((ts) => ts.map((t) => (t.path === path ? { ...t, saved: content } : t)));
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        setError(e);
      }
    },
    [workspaceId, active],
  );

  const saveAll = useCallback(async () => {
    for (const t of tabsRef.current) if (t.content !== t.saved) await save(t.path);
  }, [save]);

  // Debounced autosave.
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  useEffect(() => {
    if (!activeTab || activeTab.content === activeTab.saved || activeTab.readOnly) return;
    const t = setTimeout(() => void save(activeTab.path), 1500);
    return () => clearTimeout(t);
  }, [activeTab?.content, activeTab?.path, activeTab?.saved, activeTab?.readOnly, save, activeTab]);

  const closeTab = async (path: string) => {
    await save(path);
    setTabs((ts) => {
      const next = ts.filter((t) => t.path !== path);
      if (activePath === path) setActivePath(next.length ? next[next.length - 1].path : null);
      return next;
    });
  };

  const runTests = async () => {
    setRunning(true);
    setBottom('tests');
    setError(null);
    try {
      await saveAll();
      setTestRun(await api.runTests(workspaceId, target.trim() || undefined));
    } catch (e) {
      setError(e);
    } finally {
      setRunning(false);
    }
  };

  const loadDiff = useCallback(async () => {
    try {
      setDiff(await api.diff(workspaceId));
    } catch (e) {
      setError(e);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (bottom === 'diff') void loadDiff();
  }, [bottom, loadDiff]);

  const reset = async () => {
    setBusy(true);
    try {
      await api.reset(workspaceId);
      const fresh = await Promise.all(
        tabsRef.current.map(async (t) => {
          try {
            const f = await api.file(workspaceId, t.path);
            return { ...t, content: f.content, saved: f.content };
          } catch {
            return null;
          }
        }),
      );
      setTabs(fresh.filter((t): t is Tab => !!t));
      await loadTree();
      if (bottom === 'diff') await loadDiff();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      await saveAll();
      const s = await api.submitSection(sessionId, details.section.id);
      const finished = ['SUBMITTED', 'EXPIRED'].includes(s.status);
      router.push(finished ? `/results/${sessionId}` : `/assessment/${sessionId}`);
    } catch (e) {
      setError(e);
      setBusy(false);
      setConfirm(null);
    }
  };

  const toggleTask = () => {
    const p = taskRef.current;
    if (!p) return;
    if (p.isCollapsed()) p.expand();
    else p.collapse();
  };

  // Global Ctrl/Cmd+S (outside Monaco) saves all.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveAll();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        void runTests();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const dirty = new Set(tabs.filter((t) => t.content !== t.saved).map((t) => t.path));
  const lowTime = remaining !== null && remaining < 5 * 60_000;

  // Every challenge in the session, numbered like an assessment's question list.
  const questions = session.sections.flatMap((sec) => sec.challenges.map((c) => ({ ...c, section: sec })));
  const currentIndex = questions.findIndex((q) => q.workspaceId === workspaceId);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      {/* Top bar */}
      <header className="topnav flex h-14 shrink-0 items-center gap-4 px-4">
        <Logo href={`/assessment/${sessionId}`} />
        <div className="h-6 w-px bg-white/15" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{session.assessment.title}</p>
          <p className="truncate text-[11px] text-white/55">
            Question {currentIndex + 1} of {questions.length} · {frameworkLabel(details.manifest.runtime)}
            {details.driver === 'local' ? ' · local driver (unsafe)' : ''}
          </p>
        </div>
        <span className="hidden text-[11px] text-white/55 lg:inline">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ All changes saved' : saveState === 'error' ? <span className="text-red-300">Save failed</span> : ''}
        </span>
        {active ? (
          <div
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm tabular-nums ${lowTime ? 'animate-pulse bg-red-500/20 text-red-200' : 'bg-white/10 text-white'}`}
            title="Time remaining in this section"
          >
            <Clock className="h-4 w-4 opacity-80" />
            <span className="font-mono font-semibold">{remaining === null ? '--:--' : formatDuration(remaining)}</span>
            <span className="hidden text-xs text-white/60 sm:inline">left</span>
          </div>
        ) : (
          <span className="flex items-center gap-1.5 rounded bg-white/10 px-3 py-1.5 text-xs text-white/80"><Lock className="h-3.5 w-3.5" /> Section {details.section.status.toLowerCase()}</span>
        )}
        <Link href={`/assessment/${sessionId}`} className="btn-nav">
          <LayoutList className="h-3.5 w-3.5" /> Overview
        </Link>
      </header>

      {!active && (
        <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-2 text-xs font-medium text-warn">
          <Lock className="h-3.5 w-3.5" /> This section has ended — the workspace is read-only.
          <Link href={`/results/${sessionId}`} className="underline">View results</Link>
        </div>
      )}
      {error ? (
        <div className="relative border-b border-line bg-panel px-4 py-2">
          <ErrorBox error={error} />
          <button className="absolute right-6 top-4 text-bad" onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* Question rail */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-line bg-panel py-3">
          {questions.map((q, i) => {
            const current = q.workspaceId === workspaceId;
            const done = q.section.status === 'SUBMITTED' || q.section.status === 'EXPIRED';
            const href = q.workspaceId ? `/assessment/${sessionId}/workspace/${q.workspaceId}` : `/assessment/${sessionId}`;
            return (
              <Link
                key={`${q.section.id}-${q.id}`}
                href={href}
                title={`${i + 1}. ${q.title}`}
                className={`relative grid h-9 w-9 place-items-center rounded text-sm font-semibold transition ${
                  current ? 'bg-accent text-white shadow' : done ? 'bg-accent/10 text-accent' : 'bg-raised text-muted hover:text-fg'
                }`}
              >
                {i + 1}
                {done && !current && <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-panel text-accent" />}
              </Link>
            );
          })}
        </nav>

        <PanelGroup direction="horizontal" autoSaveId="oa-ide-h2" className="min-h-0 flex-1">
          {/* Question */}
          <Panel
            ref={taskRef}
            defaultSize={34}
            minSize={20}
            collapsible
            collapsedSize={0}
            onCollapse={() => setTaskOpen(false)}
            onExpand={() => setTaskOpen(true)}
            className="border-r border-line"
          >
            <TaskPanel workspaceId={workspaceId} task={task || 'Loading question…'} aiCoach={features.aiCoach} aiPolicy={session.assessment.aiAssistance} />
          </Panel>
          <PanelResizeHandle className="w-1" />

          {/* Code */}
          <Panel defaultSize={66} minSize={35}>
            <div className="flex h-full flex-col bg-panel">
              <PanelGroup direction="vertical" autoSaveId="oa-ide-v2" className="min-h-0 flex-1">
                <Panel defaultSize={62} minSize={20}>
                  <PanelGroup direction="horizontal" autoSaveId="oa-ide-files">
                    {/* Files */}
                    <Panel defaultSize={24} minSize={12} className="flex flex-col border-r border-line bg-raised">
                      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
                        <span className="text-[13px] font-semibold">Files</span>
                        <div className="flex items-center">
                          <button className="btn btn-ghost btn-sm px-1.5" onClick={loadTree} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></button>
                          <button className="btn btn-ghost btn-sm px-1.5" onClick={() => setConfirm('reset')} disabled={!active} title="Reset repository"><RotateCcw className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto">
                        <FileTree nodes={tree} activePath={activePath} readOnly={details.manifest.readOnly} dirty={dirty} onOpen={openFile} />
                      </div>
                    </Panel>
                    <PanelResizeHandle className="w-px" />
                    {/* Editor */}
                    <Panel defaultSize={76} minSize={30} className="flex flex-col">
                      <div className="flex h-11 shrink-0 items-stretch overflow-x-auto border-b border-line bg-raised">
                        {tabs.length === 0 && <span className="flex items-center px-4 text-xs text-muted">No file open</span>}
                        {tabs.map((t) => (
                          <div
                            key={t.path}
                            className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-line px-3 text-[13px] ${
                              t.path === activePath ? '-mb-px border-t-2 border-t-accent bg-panel font-semibold text-fg' : 'border-t-2 border-t-transparent text-muted hover:text-fg'
                            }`}
                            onClick={() => setActivePath(t.path)}
                            title={t.path}
                          >
                            {t.readOnly && <Lock className="h-3 w-3" />}
                            <span>{t.path.split('/').pop()}</span>
                            <button
                              className="grid h-4 w-4 place-items-center rounded hover:bg-line"
                              onClick={(e) => {
                                e.stopPropagation();
                                void closeTab(t.path);
                              }}
                            >
                              {t.content !== t.saved ? <span className="h-2 w-2 rounded-full bg-accent group-hover:hidden" /> : null}
                              <X className={`h-3 w-3 ${t.content !== t.saved ? 'hidden group-hover:block' : ''}`} />
                            </button>
                          </div>
                        ))}
                        <div className="flex-1" />
                        {activeTab && <span className="hidden items-center px-3 font-mono text-[11px] text-muted xl:flex">{activeTab.path}</span>}
                      </div>
                      <div className="min-h-0 flex-1">
                        {activeTab ? (
                          activeTab.binary ? (
                            <div className="p-4 text-sm text-muted">Binary file — not shown.</div>
                          ) : (
                            <CodeEditor
                              path={activeTab.path}
                              value={activeTab.content}
                              readOnly={activeTab.readOnly || !active}
                              onChange={(v) => setTabs((ts) => ts.map((t) => (t.path === activeTab.path ? { ...t, content: v } : t)))}
                              onSave={() => void save(activeTab.path)}
                            />
                          )
                        ) : (
                          <div className="grid h-full place-items-center text-center">
                            <div className="space-y-2">
                              <FileCode2 className="mx-auto h-8 w-8 text-line" />
                              <p className="text-sm font-medium text-fg/80">Select a file to start editing</p>
                              <p className="text-xs text-muted">Files autosave · Ctrl/Cmd+S to save · Ctrl/Cmd+&apos; to run tests</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </Panel>
                  </PanelGroup>
                </Panel>
                <PanelResizeHandle className="h-1" />

                {/* Console */}
                <Panel defaultSize={38} minSize={12} className="flex flex-col border-t border-line">
                  <div className="flex h-10 shrink-0 items-end gap-1 border-b border-line bg-panel px-3">
                    <TabButton active={bottom === 'tests'} onClick={() => setBottom('tests')}>
                      <FlaskConical className="h-3.5 w-3.5" /> Test Results
                      {testRun && (
                        <span className={`rounded-full px-1.5 py-px font-mono text-[11px] ${testRun.failed ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok'}`}>
                          {testRun.passed}/{testRun.total}
                        </span>
                      )}
                    </TabButton>
                    <TabButton active={bottom === 'terminal'} onClick={() => setBottom('terminal')}><SquareTerminal className="h-3.5 w-3.5" /> Terminal</TabButton>
                    {features.gitDiff && <TabButton active={bottom === 'diff'} onClick={() => setBottom('diff')}><FileDiff className="h-3.5 w-3.5" /> Changes</TabButton>}
                  </div>
                  <div className="relative min-h-0 flex-1">
                    <div className={`absolute inset-0 bg-console ${bottom === 'terminal' ? '' : 'invisible'}`}>
                      <TerminalPane workspaceId={workspaceId} visible={bottom === 'terminal'} enabled={features.terminal && active} />
                    </div>
                    {bottom === 'tests' && (
                      <div className="absolute inset-0 flex flex-col bg-panel">
                        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-2">
                          {running ? null : testRun ? (
                            <TestSummaryBar passed={testRun.passed} failed={testRun.failed} total={testRun.total} />
                          ) : (
                            <span className="text-xs text-muted">Run the tests to see results here.</span>
                          )}
                          {testRun?.timedOut && <span className="badge text-warn">timed out</span>}
                          {testRun && <span className="font-mono text-[11px] text-muted">{(testRun.durationMs / 1000).toFixed(1)}s</span>}
                          <div className="flex-1" />
                          {details.manifest.supportsTarget && (
                            <input
                              className="input h-8 w-72 font-mono text-xs"
                              placeholder="Run a subset: file, -k expr or test class"
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && void runTests()}
                            />
                          )}
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">
                          {running && (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted">
                              <Spinner /> Running tests in the sandbox…
                            </div>
                          )}
                          {testRun && !running && (
                            <>
                              <TestList tests={testRun.tests} />
                              {testRun.output && (
                                <details className="border-t border-line">
                                  <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted">Raw output</summary>
                                  <pre className="overflow-x-auto bg-raised px-4 py-3 font-mono text-[11px] leading-relaxed text-fg/75">{testRun.output}</pre>
                                </details>
                              )}
                            </>
                          )}
                          <p className="px-4 py-2 font-mono text-[11px] text-muted">$ {details.manifest.testCommand}</p>
                        </div>
                      </div>
                    )}
                    {bottom === 'diff' && (
                      <div className="absolute inset-0 overflow-auto bg-panel">
                        <div className="flex items-center justify-between border-b border-line px-4 py-2">
                          <span className="text-xs text-muted">{diff ? `${diff.files.length} file(s) changed vs. the original repository` : 'Loading…'}</span>
                          <button className="btn btn-ghost btn-sm" onClick={loadDiff}><RefreshCw className="h-3 w-3" /></button>
                        </div>
                        {diff && <DiffView files={diff.files} />}
                      </div>
                    )}
                  </div>
                </Panel>
              </PanelGroup>

              {/* Action bar */}
              <div className="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-panel px-4">
                <button className="btn btn-ghost btn-sm text-muted" onClick={toggleTask} title="Toggle question panel">
                  {taskOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                  {taskOpen ? 'Hide question' : 'Show question'}
                </button>
                <span className="hidden items-center gap-1.5 text-[11px] text-muted md:flex">
                  <ShieldCheck className="h-3.5 w-3.5 text-ok" />
                  {details.driver === 'docker' ? 'Sandboxed · no network' : 'Local driver'} · {details.manifest.runtime.image}
                </span>
                <div className="flex-1" />
                <button className="btn" onClick={runTests} disabled={running || !active} title="Run tests (Ctrl/Cmd+')">
                  {running ? <Spinner className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} Run Tests
                </button>
                <button className="btn btn-primary" onClick={() => setConfirm('submit')} disabled={!active}>
                  Submit
                </button>
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <ConfirmDialog
        open={confirm === 'submit'}
        title="Submit this section?"
        body={
          <>
            Your files are saved, protected test files are restored to their original state and the full suite is run for scoring.
            <br />
            <br />
            You won&apos;t be able to edit this repository afterwards.
          </>
        }
        confirmLabel="Submit section"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={submit}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset the repository?"
        body="All your changes are discarded and the repository returns to its original state. Installed dependencies are kept. The timer keeps running."
        confirmLabel="Reset repository"
        danger
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={reset}
      />
    </div>
  );
}
