import {
  LayoutDashboard,
  Building2,
  Inbox,
  Settings,
  Users,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

/**
 * Single source of truth for primary navigation.
 *
 * Consumed by the sidebar, the command palette (⌘K), and the topbar page title.
 * Add a routed page to the app by adding it here (and to `src/router/router.tsx`).
 * The `add-page` skill automates both edits.
 */
export interface NavItem {
  title: string;
  to: string;
  icon: LucideIcon;
  /** Extra search terms for the command palette. */
  keywords?: string;
}

export const navItems: NavItem[] = [
  { title: 'Dashboard', to: '/', icon: LayoutDashboard, keywords: 'home overview metrics' },
  { title: 'Customers', to: '/customers', icon: Building2, keywords: 'accounts revenue mrr churn subscriptions' },
  { title: 'Inbox', to: '/inbox', icon: Inbox, keywords: 'notifications mentions comments activity' },
  { title: 'Team', to: '/team', icon: Users, keywords: 'members invite roles seats' },
  { title: 'Billing', to: '/billing', icon: CreditCard, keywords: 'plans invoices payment subscription' },
  { title: 'Settings', to: '/settings', icon: Settings, keywords: 'account preferences profile theme' },
];

/** Human page title for a given pathname — used by the topbar. */
export function pageTitleFor(pathname: string): string {
  if (/^\/customers\/[^/]+$/.test(pathname)) return 'Customers';
  const match = navItems.find((i) => i.to === pathname);
  return match?.title ?? 'Console';
}
