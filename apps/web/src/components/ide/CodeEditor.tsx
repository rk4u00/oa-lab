'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import { Spinner } from '@/components/ui';

let monacoReady: Promise<void> | null = null;

/** Load Monaco from the local bundle (never from a CDN) — OA Lab must work offline. */
function ensureMonaco() {
  if (!monacoReady) {
    monacoReady = (async () => {
      (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
        getWorker: () => new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
      };
      const monaco = await import('monaco-editor/esm/vs/editor/editor.api.js');
      // Syntax highlighting for every language Monaco ships (Monarch tokenizers, no language servers).
      await import('monaco-editor/esm/vs/basic-languages/monaco.contribution.js');
      monaco.editor.defineTheme('oa-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#0c0c0e',
          'editor.lineHighlightBackground': '#18181b',
          'editorLineNumber.foreground': '#52525b',
          'editorGutter.background': '#0c0c0e',
          'editor.selectionBackground': '#f59e0b33',
          'editorCursor.foreground': '#f59e0b',
        },
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
}: {
  path: string;
  value: string;
  readOnly: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  const [ready, setReady] = useState(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  useEffect(() => {
    ensureMonaco().then(() => setReady(true));
  }, []);

  const onMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
    editor.focus();
  };

  if (!ready) return <div className="grid h-full place-items-center"><Spinner /></div>;
  return (
    <Editor
      path={path}
      value={value}
      language={languageFor(path)}
      theme="oa-dark"
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
      }}
    />
  );
}
