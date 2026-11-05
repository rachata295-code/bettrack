'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { MORE_NAV_ITEMS, isActivePath } from './nav-items';

/** Bottom-nav "More" tab: opens a sheet with the destinations that do not fit in the bar. */
export function MoreSheet() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // "More" reads as current when the user is on any page it contains.
  const active = MORE_NAV_ITEMS.some(i => isActivePath(pathname, i.href));
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          active ? 'text-accent' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Ellipsis className="size-5" aria-hidden />
        More
      </SheetTrigger>
      <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">Additional pages</SheetDescription>
        </SheetHeader>
        <nav aria-label="More" className="flex flex-col gap-1 px-3 pb-3">
          {MORE_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const current = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  current ? 'bg-elevated text-foreground' : 'text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
