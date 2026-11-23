import type { Metadata } from 'next';
import '@xterm/xterm/css/xterm.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'OA Lab',
  description: 'Local-first online assessment simulator for AI-assisted repository debugging.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
