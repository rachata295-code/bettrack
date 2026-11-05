import { Calculator, FolderKanban, History, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
  { href: '/history', label: 'History', icon: History },
  { href: '/sessions', label: 'Sessions', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/** "/" must match exactly (it prefixes everything); other items match their subtree. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}
