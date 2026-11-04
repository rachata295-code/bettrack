import { BottomNav } from './bottom-nav';
import { Disclaimer } from './disclaimer';
import { HydrationGate } from './hydration-gate';
import { Sidebar } from './sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <HydrationGate>
      <Sidebar />
      <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
        {children}
        <Disclaimer />
      </main>
      <BottomNav />
    </HydrationGate>
  );
}
