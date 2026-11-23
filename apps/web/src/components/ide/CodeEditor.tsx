'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';

let monacoReady: Promise<void> | null = null;

/** The workspace the editor is currently showing; code-navigation providers read it. */
export interface NavigationContext {
  workspaceId: string;
  openAt: (path: string, line: number, column: number) => void;
}
let navCtx: NavigationContext | null = null;
export function setNavigationContext(ctx: NavigationContext | null) {
  navCtx = ctx;
}

type Monaco = typeof import('monaco-editor/esm/vs/editor/editor.api.js');

/** @monaco-editor/react names models with Uri.parse(path); keep the reverse mapping. */
const uriToPath = new Map<string, string>();
function uriFor(monaco: Monaco, path: string) {
  const uri = monaco.Uri.parse(path);
  uriToPath.set(uri.toString(), path);
  return uri;
}
function pathOf(uri: { toString(): string; path: string }) {
  return uriToPath.get(uri.toString()) ?? uri.path.replace(/^\//, '');
}

/** Make sure a model exists for `path` so Monaco can peek / jump into it. */
async function ensureModel(monaco: Monaco, workspaceId: string, path: string) {
  const uri = uriFor(monaco, path);
  if (monaco.editor.getModel(uri)) return uri;
  const f = await api.file(workspaceId, path);
  if (!monaco.editor.getModel(uri)) monaco.editor.createModel(f.binary ? '' : f.content, languageFor(path), uri);
  return uri;
}

/**
 * Go to Definition (Ctrl/Cmd+click, F12), Peek Definition (Alt+F12) and Find References (Shift+F12),
 * backed by the API's workspace-wide symbol search. Registered once for every code language.
 */
function registerNavigation(monaco: Monaco) {
  const languages = ['python', 'javascript', 'typescript', 'java', 'kotlin'];
  for (const language of languages) {
    monaco.languages.registerDefinitionProvider(language, {
      async provideDefinition(model, position) {
        const ctx = navCtx;
        const word = model.getWordAtPosition(position);
        if (!ctx || !word) return null;
        const from = pathOf(model.uri);
        uriToPath.set(model.uri.toString(), from);
        // The API ranks candidates (imports followed, same file, real definitions over assignments).
        // Return only the best one so Ctrl/Cmd+click always lands on the function itself.
        const locs = (await api.definition(ctx.workspaceId, word.word, from, position.lineNumber).catch(() => [])).slice(0, 1);
        const out = [];
        for (const l of locs) {
          const uri = await ensureModel(monaco, ctx.workspaceId, l.path).catch(() => null);
          if (uri) out.push({ uri, range: new monaco.Range(l.line, l.column, l.line, l.endColumn) });
        }
        return out;
      },
    });
    monaco.languages.registerReferenceProvider(language, {
      async provideReferences(model, position) {
        const ctx = navCtx;
        const word = model.getWordAtPosition(position);
        if (!ctx || !word) return [];
        const locs = await api.references(ctx.workspaceId, word.word, pathOf(model.uri)).catch(() => []);
        const files = [...new Set(locs.map((l) => l.path))].slice(0, 60);
        await Promise.all(files.map((f) => ensureModel(monaco, ctx.workspaceId, f).catch(() => null)));
        return locs
          .filter((l) => files.includes(l.path))
          .map((l) => ({ uri: uriFor(monaco, l.path), range: new monaco.Range(l.line, l.column, l.line, l.endColumn) }));
      },
    });
  }
  // Jumping into another file: open it as a tab in OA Lab instead of a Monaco-internal editor.
  monaco.editor.registerEditorOpener({
    openCodeEditor(_source, resource, selectionOrPosition) {
      const ctx = navCtx;
      if (!ctx) return false;
      let line = 1;
      let column = 1;
      if (selectionOrPosition && 'startLineNumber' in selectionOrPosition) {
        line = selectionOrPosition.startLineNumber;
        column = selectionOrPosition.startColumn;
      } else if (selectionOrPosition) {
        line = selectionOrPosition.lineNumber;
        column = selectionOrPosition.column;
      }
      ctx.openAt(pathOf(resource), line, column);
      return true;
    },
  });
}

/** Load Monaco from the local bundle (never from a CDN) — OA Lab must work offline. */
function ensureMonaco() {
  if (!monacoReady) {
    monacoReady = (async () => {
      (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker: () => new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
      };
      // edcore.main = the core API + every editor contribution (go to definition, peek, find/replace,
      // context menu, folding, command palette…). editor.api alone ships none of those.
      const monaco = (await import('monaco-editor/esm/vs/editor/edcore.main.js')) as unknown as typeof import('monaco-editor/esm/vs/editor/editor.api.js');
      // Syntax highlighting for every language Monaco ships (Monarch tokenizers, no language servers).
      await import('monaco-editor/esm/vs/basic-languages/monaco.contribution.js');
      monaco.editor.defineTheme('oa-light', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
          'editor.lineHighlightBackground': '#f3f5f7',
          'editor.lineHighlightBorder': '#00000000',
          'editorLineNumber.foreground': '#9aa3ad',
          'editorLineNumber.activeForeground': '#0e141e',
          'editorGutter.background': '#f7f8fa',
          'editorIndentGuide.background1': '#eceef1',
          'editor.selectionBackground': '#1e9d5033',
          'editorCursor.foreground': '#0e141e',
        },
      });
      registerNavigation(monaco as unknown as Monaco);
      // Monaco cancels superseded requests (e.g. moving the mouse while Ctrl is held) by rejecting
      // with a "Canceled" error; that is expected and should not surface as an unhandled rejection.
      window.addEventListener('unhandledrejection', (e) => {
        if ((e.reason as { name?: string; message?: string })?.name === 'Canceled' || (e.reason as Error)?.message === 'Canceled') e.preventDefault();
      });
      loader.config({ monaco });
    })();
  }
  return monacoReady;
}

const LANGS: Record<string, string> = {
  py: 'python', js: 'javascript', cjs: 'javascript', mjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  java: 'java', kt: 'kotlin', json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss', md: 'markdown', yml: 'yaml', yaml: 'yaml',
  xml: 'xml', sql: 'sql', sh: 'shell', bash: 'shell', properties: 'ini', ini: 'ini', cfg: 'ini', toml: 'ini', txt: 'plaintext',
  dockerfile: 'dockerfile', go: 'go', rb: 'ruby', php: 'php', cpp: 'cpp', c: 'c', h: 'cpp', hpp: 'cpp', cs: 'csharp', rs: 'rust',
};

export function languageFor(path: string) {
  const base = path.split('/').pop()!.toLowerCase();
  if (base === 'dockerfile') return 'dockerfile';
  if (base === 'makefile') return 'plaintext';
  return LANGS[base.split('.').pop() ?? ''] ?? 'plaintext';
}

export function CodeEditor({
  path,
  value,
  readOnly,
  onChange,
  onSave,
  reveal,
}: {
  path: string;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  /** Scroll to and select this position (changes to `nonce` re-trigger). */
  reveal?: { line: number; column: number; nonce: number } | null;
}) {
  const [ready, setReady] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  // State (not just a ref) so the reveal effect re-runs once a freshly mounted editor is ready.
  const [mounted, setMounted] = useState(0);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    ensureMonaco().then(() => setReady(true));
  }, []);

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    editorRef.current = editor;
    setMounted((n) => n + 1);
    editor.focus();
  };

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed || !reveal) return;
    // A newly opened tab attaches its model asynchronously: retry until the editor shows `path`.
    let tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const go = () => {
      const model = ed.getModel();
      const ready = model && model.getLineCount() >= reveal.line && pathOf(model.uri) === path;
      if (!ready && tries++ < 40) {
        t = setTimeout(go, 25);
        return;
      }
      ed.setSelection({ startLineNumber: reveal.line, startColumn: reveal.column, endLineNumber: reveal.line, endColumn: reveal.column });
      ed.revealLineInCenter(reveal.line);
      ed.focus();
    };
    t = setTimeout(go, 0);
    return () => clearTimeout(t);
  }, [reveal?.nonce, path, reveal, mounted]);

  if (!ready) return <div className="grid h-full place-items-center"><Spinner /></div>;
  return (
    <Editor
      path={path}
      value={value}
      language={languageFor(path)}
      theme="oa-light"
      onChange={(v) => onChange(v ?? '')}
      onMount={onMount}
      loading={<Spinner />}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        tabSize: 4,
        automaticLayout: true,
        smoothScrolling: true,
        padding: { top: 8 },
        bracketPairColorization: { enabled: true },
        // Ctrl/Cmd+click → go to definition; multiple matches open the peek view.
        gotoLocation: { multipleDefinitions: 'goto', multipleReferences: 'peek' },
        definitionLinkOpensInPeek: false,
      }}
    />
  );
}
