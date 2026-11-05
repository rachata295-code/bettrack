import { Calculator, ChartLine, FolderKanban, History, LayoutDashboard, Settings, Wallet, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
  { href: '/history', label: 'History', icon: History },
  { href: '/analytics', label: 'Analytics', icon: ChartLine },
  { href: '/sessions', label: 'Sessions', icon: FolderKanban },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const MORE_HREFS = ['/sessions', '/wallet', '/settings'];

/** Bottom bar has room for 4 destinations + "More"; the rest live in the More sheet. */
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter(i => !MORE_HREFS.includes(i.href));
export const MORE_NAV_ITEMS = NAV_ITEMS.filter(i => MORE_HREFS.includes(i.href));

/** "/" must match exactly (it prefixes everything); other items match their subtree. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}
