/** The tutor's codebase tools (agent/app/codebase.py): result shape and the words the chat shows. */

export type CodeTool = 'repo_tree' | 'file_outline' | 'read_repo_file' | 'search_repo' | 'find_definition';

export interface CodeResult {
  error?: string;
  repo?: string;
  path?: string;
  url?: string;
  query?: string;
  name?: string;
  startLine?: number;
  endLine?: number;
  totalLines?: number;
  totalFiles?: number;
  entries?: string[];
  symbols?: unknown[];
  hits?: { path: string; line: number; url: string }[];
  definitions?: { path: string; line: number; url: string }[];
  searchedFiles?: number;
}

function where(r: CodeResult): string {
  return r.path ? `${r.repo} · ${r.path}` : (r.repo ?? '');
}

/** What the tutor is doing while the call runs, from its arguments. */
export function codeWorkingLabel(tool: CodeTool, args: Record<string, unknown>): string {
  const repo = String(args.repo ?? '');
  const path = String(args.path ?? '');
  switch (tool) {
    case 'repo_tree':
      return `Looking through ${path ? `${repo} · ${path}` : repo}`;
    case 'file_outline':
      return `Outlining ${path}`;
    case 'read_repo_file':
      return `Reading ${path}`;
    case 'search_repo':
      return `Searching ${repo} for “${String(args.query ?? '')}”`;
    case 'find_definition':
      return `Finding where ${String(args.name ?? '')} is defined`;
  }
}

export function codeSummary(tool: CodeTool, r: CodeResult): string {
  switch (tool) {
    case 'repo_tree':
      return `Listed ${where(r)} (${r.entries?.length ?? 0} entries)`;
    case 'file_outline':
      return `Outlined ${r.path}: ${r.symbols?.length ?? 0} definitions in ${r.totalLines ?? 0} lines`;
    case 'read_repo_file':
      return `Read ${r.path}, lines ${r.startLine}–${r.endLine} of ${r.totalLines}`;
    case 'search_repo':
      return `Searched ${r.searchedFiles ?? 0} files for “${r.query}”: ${r.hits?.length ?? 0} lines`;
    case 'find_definition': {
      const d = r.definitions ?? [];
      return d.length ? `${r.name} is defined in ${d[0].path}:${d[0].line}` : `No definition of ${r.name} found`;
    }
  }
}

