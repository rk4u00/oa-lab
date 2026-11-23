/**
 * Lightweight code navigation (Go to Definition / Find References) for the browser IDE.
 * A regex-based symbol search across the workspace, tuned per language family. It needs no
 * language server, so it works the same for Python/Django, JavaScript/Node and Java/Spring repositories.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { IGNORED_DIRS } from '../../common/fs-utils';

export interface NavLocation {
  path: string;
  line: number; // 1-based
  column: number; // 1-based
  endColumn: number;
  preview: string;
  kind: 'definition' | 'module' | 'assignment' | 'reference';
}

type Family = 'python' | 'js' | 'java' | 'other';
const FAMILY_EXT: Record<Family, string[]> = {
  python: ['.py'],
  js: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx'],
  java: ['.java', '.kt'],
  other: [],
};
const MAX_FILES = 4000;
const MAX_FILE_BYTES = 512_000;
const SEARCHABLE = /\.(py|js|cjs|mjs|jsx|ts|tsx|java|kt|html|json|yml|yaml|properties|sql|md)$/i;

export function familyOf(p: string): Family {
  const ext = path.extname(p).toLowerCase();
  for (const f of ['python', 'js', 'java'] as Family[]) if (FAMILY_EXT[f].includes(ext)) return f;
  return 'other';
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Ordered definition patterns; earlier = stronger. Each must capture the symbol as group "s". */
function definitionPatterns(family: Family, sym: string): { re: RegExp; kind: NavLocation['kind']; weight: number }[] {
  const S = `(?<s>${esc(sym)})`;
  switch (family) {
    case 'python':
      return [
        { re: new RegExp(`^\\s*(?:async\\s+)?def\\s+${S}\\s*\\(`), kind: 'definition', weight: 100 },
        { re: new RegExp(`^\\s*class\\s+${S}\\b`), kind: 'definition', weight: 100 },
        { re: new RegExp(`^${S}\\s*(?::[^=]+)?=(?!=)`), kind: 'assignment', weight: 70 },
        { re: new RegExp(`^\\s+${S}\\s*(?::[^=]+)?=(?!=)`), kind: 'assignment', weight: 40 },
      ];
    case 'js':
      return [
        { re: new RegExp(`\\b(?:async\\s+)?function\\s*\\*?\\s*${S}\\s*\\(`), kind: 'definition', weight: 100 },
        { re: new RegExp(`\\bclass\\s+${S}\\b`), kind: 'definition', weight: 100 },
        { re: new RegExp(`\\b(?:const|let|var)\\s+${S}\\s*=`), kind: 'definition', weight: 90 },
        { re: new RegExp(`\\b(?:interface|type|enum)\\s+${S}\\b`), kind: 'definition', weight: 90 },
        { re: new RegExp(`^\\s*(?:static\\s+|async\\s+|get\\s+|set\\s+)*${S}\\s*\\([^)]*\\)\\s*\\{`), kind: 'definition', weight: 80 },
        { re: new RegExp(`(?:module\\.)?exports\\.${S}\\s*=`), kind: 'definition', weight: 80 },
        { re: new RegExp(`^\\s*${S}\\s*:\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>|\\w+\\s*=>)`), kind: 'definition', weight: 70 },
        { re: new RegExp(`\\b(?:const|let|var)\\s*\\{[^}]*\\b${S}\\b[^}]*\\}\\s*=`), kind: 'assignment', weight: 30 },
      ];
    case 'java':
      return [
        { re: new RegExp(`\\b(?:class|interface|enum|record|@interface)\\s+${S}\\b`), kind: 'definition', weight: 100 },
        {
          re: new RegExp(`^\\s*(?:@\\w+(?:\\([^)]*\\))?\\s+)*(?:(?:public|private|protected|static|final|abstract|synchronized|default|native)\\s+)*(?:<[^>]+>\\s+)?[\\w.<>\\[\\],?\\s]+?\\s+${S}\\s*\\(`),
          kind: 'definition',
          weight: 90,
        },
        { re: new RegExp(`^\\s*(?:(?:public|private|protected|static|final|transient|volatile)\\s+)+[\\w.<>\\[\\],?\\s]+?\\s+${S}\\s*[;=]`), kind: 'assignment', weight: 60 },
      ];
    default:
      return [];
  }
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string, rel: string) => {
    if (out.length >= MAX_FILES) return;
    for (const e of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (IGNORED_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(path.join(dir, e.name), r);
      else if (e.isFile() && SEARCHABLE.test(e.name)) out.push(r);
    }
  };
  await walk(root, '');
  return out;
}

async function readLines(root: string, rel: string): Promise<string[] | null> {
  const abs = path.join(root, rel);
  const st = await fs.stat(abs).catch(() => null);
  if (!st || st.size > MAX_FILE_BYTES) return null;
  return (await fs.readFile(abs, 'utf8')).split(/\r?\n/);
}

/** Names imported into `fromPath` mapped to the module text they come from (used to rank candidates). */
function importHints(lines: string[], family: Family): Map<string, string> {
  const hints = new Map<string, string>();
  for (const l of lines) {
    let m: RegExpMatchArray | null;
    if (family === 'python' && (m = l.match(/^\s*from\s+([\w.]+)\s+import\s+\(?([^)#]+)/))) {
      for (const n of m[2].split(',')) {
        const [name, alias] = n.trim().split(/\s+as\s+/);
        if (name) hints.set((alias ?? name).trim(), m[1]);
      }
    } else if (family === 'js' && (m = l.match(/(?:const|let|var|import)\s*\{([^}]+)\}\s*(?:=\s*require\(\s*|from\s*)['"]([^'"]+)['"]/))) {
      for (const n of m[1].split(',')) {
        const [name, alias] = n.trim().split(/\s*(?::|\s+as\s+)\s*/);
        if (name) hints.set((alias ?? name).trim(), m[2]);
      }
    } else if (family === 'js' && (m = l.match(/(?:const|let|var|import)\s+(\w+)\s*(?:=\s*require\(\s*|from\s*)['"]([^'"]+)['"]/))) {
      hints.set(m[1], m[2]);
    } else if (family === 'java' && (m = l.match(/^\s*import\s+(?:static\s+)?([\w.]+)\.(\w+)\s*;/))) {
      hints.set(m[2], `${m[1]}.${m[2]}`);
    }
  }
  return hints;
}

/** Does `candidate` (a workspace path) look like the module `spec` imported from `fromPath`? */
function matchesModule(candidate: string, spec: string, fromPath: string, family: Family): boolean {
  const noExt = candidate.replace(/\.[^.]+$/, '').replace(/\/index$/, '').replace(/\/__init__$/, '');
  if (family === 'python') {
    let mod = spec;
    if (mod.startsWith('.')) {
      const dots = mod.match(/^\.+/)![0].length;
      const base = path.posix.dirname(fromPath).split('/').slice(0, Math.max(0, path.posix.dirname(fromPath).split('/').length - (dots - 1)));
      mod = [...base.filter((x) => x && x !== '.'), ...mod.slice(dots).split('.').filter(Boolean)].join('/');
    } else mod = mod.replace(/\./g, '/');
    return noExt === mod || noExt.endsWith(`/${mod}`) || candidate.startsWith(`${mod}/`);
  }
  if (family === 'js') {
    const target = spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), spec)) : spec;
    return noExt === target.replace(/\.[^.\/]+$/, '') || noExt.endsWith(`/${target}`);
  }
  if (family === 'java') return noExt.endsWith(spec.replace(/\./g, '/'));
  return false;
}

export async function findDefinitions(root: string, symbol: string, fromPath: string, fromLine?: number): Promise<NavLocation[]> {
  if (!/^[A-Za-z_$][\w$]{0,120}$/.test(symbol)) return [];
  const family = familyOf(fromPath);
  const files = (await listFiles(root)).filter((f) => family === 'other' || FAMILY_EXT[family].includes(path.extname(f).toLowerCase()));
  const fromLines = (await readLines(root, fromPath)) ?? [];
  const hint = importHints(fromLines, family).get(symbol);
  const patterns = definitionPatterns(family, symbol);
  const scored: (NavLocation & { score: number })[] = [];

  for (const f of files) {
    const lines = f === fromPath ? fromLines : await readLines(root, f);
    if (!lines) continue;
    const isTest = /(^|\/)(tests?|__tests__|src\/test)\//.test(f) || /(^|\/)test_[^/]*\.py$|\.test\.[jt]sx?$|Test\.java$/.test(f);
    const fromHint = hint ? matchesModule(f, hint, fromPath, family) : false;
    lines.forEach((text, i) => {
      if (f === fromPath && fromLine === i + 1 && !patterns.some((p) => p.re.test(text))) return;
      for (const p of patterns) {
        const m = text.match(p.re);
        if (!m || m.index === undefined) continue;
        const col = text.indexOf(symbol, m.index + (m[0].lastIndexOf(symbol) - (m[0].length - m[0].length))) + 1 || m.index + 1;
        let score = p.weight;
        if (fromHint) score += 200;
        if (f === fromPath) score += 50;
        if (isTest) score -= 60;
        scored.push({ path: f, line: i + 1, column: col, endColumn: col + symbol.length, preview: text.trim().slice(0, 200), kind: p.kind, score });
        break;
      }
    });
  }

  // A module name (e.g. `services` in `from . import services`, or `orders` in require('./routes/orders')).
  for (const f of files) {
    const base = path.posix.basename(f).replace(/\.[^.]+$/, '');
    const dir = path.posix.basename(path.posix.dirname(f));
    if (base === symbol || ((base === '__init__' || base === 'index') && dir === symbol)) {
      scored.push({ path: f, line: 1, column: 1, endColumn: 1, preview: f, kind: 'module', score: 55 + (hint && matchesModule(f, hint, fromPath, family) ? 200 : 0) });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line);
  // If an import hint resolved, prefer only those; otherwise return the strongest tier.
  const top = scored[0]?.score ?? 0;
  return scored.filter((s) => s.score >= top - 40).slice(0, 25).map(({ score: _s, ...l }) => l);
}

export async function findReferences(root: string, symbol: string, fromPath: string): Promise<NavLocation[]> {
  if (!/^[A-Za-z_$][\w$]{0,120}$/.test(symbol)) return [];
  const family = familyOf(fromPath);
  const files = (await listFiles(root)).filter((f) => family === 'other' || FAMILY_EXT[family].includes(path.extname(f).toLowerCase()) || /\.(html|ya?ml|properties|json)$/.test(f));
  const re = new RegExp(`(?<![\\w$])${esc(symbol)}(?![\\w$])`, 'g');
  const out: NavLocation[] = [];
  for (const f of files) {
    const lines = await readLines(root, f);
    if (!lines) continue;
    lines.forEach((text, i) => {
      for (const m of text.matchAll(re)) {
        out.push({ path: f, line: i + 1, column: m.index! + 1, endColumn: m.index! + 1 + symbol.length, preview: text.trim().slice(0, 200), kind: 'reference' });
        if (out.length >= 500) return;
      }
    });
    if (out.length >= 500) break;
  }
  return out;
}
