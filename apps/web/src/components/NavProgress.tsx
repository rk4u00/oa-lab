'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { progress } from '@/lib/progress';

/** Thin accent bar at the very top: trickles towards 90% while busy, then completes and fades out. */
export function NavProgress() {
  const path = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const unsub = progress.subscribe((busy) => {
      clearInterval(timer.current);
      if (busy) {
        setVisible(true);
        setWidth(8);
        timer.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.08 : w)), 200);
      } else {
        setWidth(100);
        timer.current = setTimeout(() => {
          setVisible(false);
          setWidth(0);
        }, 350) as unknown as ReturnType<typeof setInterval>;
      }
    });
    // First load: finish once the requests the page made while mounting have settled.
    progress.routeChanged();

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      progress.begin(true);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      unsub();
      clearInterval(timer.current);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  useEffect(() => {
    progress.routeChanged();
  }, [path]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className="h-full bg-accent shadow-[0_0_10px_rgb(var(--accent)/0.7)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
