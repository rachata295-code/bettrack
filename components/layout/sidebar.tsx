'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActiveSession } from '@/hooks/use-active-session';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, isActivePath } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const session = useActiveSession();
  return (
    // w-64 must match the lg:pl-64 offset on <main> in AppShell.
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
      <div className="px-5 py-5 text-lg font-semibold tracking-tight">BetTrack</div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-5 py-4">
        <div className="text-xs text-muted-foreground">Active session</div>
        <div className="truncate text-sm font-medium" title={session.name}>
          {session.name}
        </div>
      </div>
    </aside>
  );
}
