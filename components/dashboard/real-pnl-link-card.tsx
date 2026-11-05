'use client';

import Link from 'next/link';
import { approxThbLabel } from '@/lib/calculations/fx';
import { formatMoney } from '@/lib/calculations/money';
import { onPlatformBalance, realPnl } from '@/lib/calculations/wallet';
import { cn } from '@/lib/utils';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';
import type { Currency } from '@/types';

/** Compact Real P&L on the Dashboard; renders only once the user has recorded a transaction. All math lives in lib. */
export function RealPnlLinkCard({ currency }: { currency: Currency }) {
  const transactions = useWalletStore(s => s.transactions);
  const sessions = useBetStore(s => s.sessions);
  const fx = useSettingsStore(s => s.fx);
  const precision = useSettingsStore(s => s.precision);
  if (transactions.length === 0) return null;

  const platform = onPlatformBalance(sessions, currency, fx);
  const result = 'value' in platform ? realPnl({ transactions, onPlatform: platform.value, currency, fx }) : platform;
  const net = 'missingRates' in result ? null : formatMoney(result.net, { precision, currency, signed: true });
  const approx = 'missingRates' in result ? null : approxThbLabel(result.net, currency, fx, precision, { signed: true });

  return (
    <section aria-label="Real P&L" className="space-y-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Real P&amp;L</h2>
        <Link href="/wallet" className="text-sm underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/60">
          Open Wallet
        </Link>
      </div>
      {net ? (
        <>
          <p className={cn('num text-2xl font-semibold', net.startsWith('+') ? 'text-profit' : net.startsWith('−') ? 'text-loss' : 'text-muted-foreground')} data-testid="dashboard-real-net">
            {net}
          </p>
          {approx && <p className="num text-sm text-muted-foreground">{approx}</p>}
          <p className="text-xs text-muted-foreground">Withdrawals − deposits − fees + balance on platform.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Set an exchange rate in <Link href="/settings" className="underline underline-offset-2">Settings</Link> to see your net result.
        </p>
      )}
    </section>
  );
}
