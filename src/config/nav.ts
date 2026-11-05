import { Library, Sparkles, MessagesSquare, NotebookPen, Database, Settings, type LucideIcon } from 'lucide-react';

/**
 * Single source of truth for primary navigation.
 *
 * Consumed by the sidebar, the command palette (⌘K), and the topbar page title.
 * Add a routed page to the app by adding it here (and to `src/router/router.tsx`).
 */
export interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  /** Extra search terms for the command palette. */
  keywords?: string;
}

export const navItems: NavItem[] = [
  { title: 'Library', to: '/', icon: Library, keywords: 'home courses learn' },
  { title: 'New course', to: '/new', icon: Sparkles, keywords: 'create plan interview generate' },
  { title: 'Tutor', to: '/tutor', icon: MessagesSquare, keywords: 'ask question chat copilot' },
  { title: 'Notes', to: '/notes', icon: NotebookPen, keywords: 'pages notion write' },
  { title: 'Sources', to: '/sources', icon: Database, keywords: 'rag index embeddings search retrieval' },
  { title: 'Settings', to: '/settings', icon: Settings, keywords: 'account preferences profile theme' },
];

/** Human page title for a given pathname — used by the topbar. */
export function pageTitleFor(pathname: string): string {
  if (/^\/courses\/[^/]+\/building$/.test(pathname)) return 'Building course';
  if (/^\/courses\/[^/]+\/chapters\//.test(pathname)) return 'Chapter';
  if (/^\/courses\/[^/]+\/projects\//.test(pathname)) return 'Project';
  if (/^\/courses\/[^/]+$/.test(pathname)) return 'Course';
  if (pathname.startsWith('/notes')) return 'Notes';
  if (pathname.startsWith('/tutor')) return 'Tutor';
  const match = navItems.find((i) => i.to === pathname);
  return match?.title ?? 'Coursewright';
}
