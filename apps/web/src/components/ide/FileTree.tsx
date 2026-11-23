'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, File, FileCode2, Folder, FolderOpen, Lock } from 'lucide-react';
import type { FileNode } from '@oa-lab/shared';

export function isReadOnlyPath(readOnly: string[], p: string) {
  return readOnly.some((r) => (r.endsWith('/') ? p.startsWith(r) || `${p}/` === r : p === r));
}

const CODE = /\.(py|js|ts|tsx|jsx|java|kt|go|rb|cs|cpp|c|h|rs|php)$/;

export function FileTree({
  nodes,
  activePath,
  readOnly,
  dirty,
  onOpen,
}: {
  nodes: FileNode[];
  activePath: string | null;
  readOnly: string[];
  dirty: Set<string>;
  onOpen: (path: string) => void;
}) {
  return (
    <ul className="py-1 text-[13px]">
      {nodes.map((n) => (
        <TreeNode key={n.path} node={n} depth={0} activePath={activePath} readOnly={readOnly} dirty={dirty} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth, activePath, readOnly, dirty, onOpen }: { node: FileNode; depth: number; activePath: string | null; readOnly: string[]; dirty: Set<string>; onOpen: (p: string) => void }) {
  const [open, setOpen] = useState(depth < 1);
  const ro = isReadOnlyPath(readOnly, node.path);
  const pad = { paddingLeft: 8 + depth * 12 };
  if (node.type === 'dir') {
    return (
      <li>
        <button className="flex w-full items-center gap-1 py-[3px] pr-2 text-left text-fg/80 hover:bg-raised" style={pad} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />}
          {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent/80" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-accent/80" />}
          <span className="truncate">{node.name}</span>
          {ro && <Lock className="ml-auto h-3 w-3 shrink-0 text-muted" />}
        </button>
        {open && (
          <ul>
            {node.children?.map((c) => (
              <TreeNode key={c.path} node={c} depth={depth + 1} activePath={activePath} readOnly={readOnly} dirty={dirty} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </li>
    );
  }
  const Icon = CODE.test(node.name) ? FileCode2 : File;
  return (
    <li>
      <button
        className={`flex w-full items-center gap-1 py-[3px] pr-2 text-left hover:bg-raised ${activePath === node.path ? 'bg-raised text-fg' : 'text-fg/75'}`}
        style={{ paddingLeft: 8 + depth * 12 + 14 }}
        onClick={() => onOpen(node.path)}
        title={ro ? `${node.path} (read-only)` : node.path}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="truncate">{node.name}</span>
        {dirty.has(node.path) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
        {ro && <Lock className="ml-auto h-3 w-3 shrink-0 text-muted" />}
      </button>
    </li>
  );
}
