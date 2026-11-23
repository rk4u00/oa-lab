'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { WS_URL } from '@/lib/api';

export function TerminalPane({ workspaceId, visible, enabled }: { workspaceId: string; visible: boolean; enabled: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<import('@xterm/xterm').Terminal | null>(null);
  const fitRef = useRef<import('@xterm/addon-fit').FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [state, setState] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [gen, setGen] = useState(0);

  const sendResize = useCallback(() => {
    const t = termRef.current;
    const ws = wsRef.current;
    if (t && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols: t.cols, rows: t.rows }));
  }, []);

  useEffect(() => {
    if (!enabled || !hostRef.current) return;
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);
      if (disposed || !hostRef.current) return;
      const term = new Terminal({
        fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
        fontSize: 13,
        cursorBlink: true,
        theme: { background: '#11161d', foreground: '#e4e4e7', cursor: '#39d27a', selectionBackground: '#39d27a44' },
        scrollback: 5000,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(hostRef.current);
      try {
        fit.fit();
      } catch {
        /* hidden */
      }
      termRef.current = term;
      fitRef.current = fit;

      setState('connecting');
      const ws = new WebSocket(`${WS_URL}/ws/terminal/${workspaceId}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setState('open');
        sendResize();
      };
      ws.onmessage = (e) => term.write(typeof e.data === 'string' ? e.data : '');
      ws.onclose = () => {
        setState('closed');
        term.write('\r\n\x1b[90m[session closed — press Reconnect]\x1b[0m\r\n');
      };
      const sub = term.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'input', data: d })));
      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
          sendResize();
        } catch {
          /* ignore */
        }
      });
      ro.observe(hostRef.current);
      cleanup = () => {
        ro.disconnect();
        sub.dispose();
        ws.close();
        term.dispose();
        termRef.current = null;
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [workspaceId, enabled, gen, sendResize]);

  useEffect(() => {
    if (visible) {
      requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
          sendResize();
          termRef.current?.focus();
        } catch {
          /* ignore */
        }
      });
    }
  }, [visible, sendResize]);

  if (!enabled) return <div className="p-4 text-sm text-muted">The terminal is disabled for this challenge.</div>;
  return (
    <div className="relative h-full">
      <div ref={hostRef} className="h-full w-full" />
      {state === 'closed' && (
        <button className="btn btn-sm absolute right-3 top-2" onClick={() => setGen((g) => g + 1)}>
          <RotateCw className="h-3 w-3" /> Reconnect
        </button>
      )}
    </div>
  );
}
