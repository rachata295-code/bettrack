'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { approxThbLabel } from '@/lib/calculations/fx';
import { formatMoney, parseMoneyInput } from '@/lib/calculations/money';
import { onPlatformBalance, realPnl, sessionOnPlatform } from '@/lib/calculations/wallet';
import { cn } from '@/lib/utils';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';
import { CURRENCIES, type Currency } from '@/types';

const CURRENCY_ITEMS = CURRENCIES.map(c => ({ value: c, label: c }));
type Source = 'active' | 'sessions' | 'manual';
// Default is the active session only (R18): summing every session double-counts carried-over balances.
const SOURCE_ITEMS = [
  { value: 'active', label: 'Active session' },
  { value: 'sessions', label: 'All sessions (converted)' },
  { value: 'manual', label: 'Enter manually' },
];

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <li className={cn('flex justify-between gap-3', strong && 'font-medium')}>
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </li>
  );
}

export function RealPnlCard() {
  const transactions = useWalletStore(s => s.transactions);
  const sessions = useBetStore(s => s.sessions);
  const activeId = useBetStore(s => s.activeSessionId);
  const fx = useSettingsStore(s => s.fx);
  const precision = useSettingsStore(s => s.precision);

  // Summary currency defaults to the active session's; null = user has not picked one.
  const [picked, setPicked] = useState<Currency | null>(null);
  const [source, setSource] = useState<Source>('active');
  const [manual, setManual] = useState('');
  const active = sessions.find(s => s.id === activeId);
  const currency: Currency = picked ?? active?.currency ?? 'USDT';

  let onPlatform: string | null = null;
  let missing: Currency[] = [];
  let manualError: string | null = null;
  if (source === 'active') {
    if (active) {
      const r = sessionOnPlatform(active, currency, fx);
      if ('missingRates' in r) missing = r.missingRates;
      else onPlatform = r.value;
    }
  } else if (source === 'sessions') {
    const r = onPlatformBalance(sessions, currency, fx);
    if ('missingRates' in r) missing = r.missingRates;
    else onPlatform = r.value;
  } else {
    const p = parseMoneyInput(manual);
    if (p.ok) onPlatform = p.value;
    else manualError = manual.trim() === '' ? 'Enter your balance on the platform' : 'Enter a number of 0 or more';
  }

  let pnl: ReturnType<typeof realPnl> | null = null;
  if (onPlatform !== null) {
    pnl = realPnl({ transactions, onPlatform, currency, fx });
    if ('missingRates' in pnl) {
      missing = pnl.missingRates;
      pnl = null;
    }
  }
  const okPnl = pnl && !('missingRates' in pnl) ? pnl : null;

  const money = (v: string) => formatMoney(v, { precision, currency });
  const netText = okPnl ? formatMoney(okPnl.net, { precision, currency, signed: true }) : null;
  const approx = okPnl ? approxThbLabel(okPnl.net, currency, fx, precision, { signed: true }) : null;

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-labelledby="real-pnl-title">
      <h2 id="real-pnl-title" className="text-base font-medium">Real P&amp;L</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 min-[420px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pnl-currency">Summary currency</Label>
          <Select items={CURRENCY_ITEMS} value={currency} onValueChange={v => v && setPicked(v as Currency)}>
            <SelectTrigger id="pnl-currency" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCY_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pnl-source">On platform</Label>
          <Select items={SOURCE_ITEMS} value={source} onValueChange={v => v && setSource(v as Source)}>
            <SelectTrigger id="pnl-source" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCE_ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {source === 'active' && (
        <p className="text-xs text-muted-foreground">
          {active ? <>On platform: <span className="font-medium">{active.name}</span> balance</> : 'No active session. Pick another source.'}
        </p>
      )}
      {source === 'sessions' && (
        <p className="text-xs text-muted-foreground">Adds every session&apos;s balance. Use only if each session is a separate pot of money.</p>
      )}
      {source === 'manual' && (
        <div className="space-y-1.5">
          <Label htmlFor="pnl-manual">Balance on platform ({currency})</Label>
          <Input id="pnl-manual" inputMode="decimal" autoComplete="off" value={manual} onChange={e => setManual(e.target.value)} aria-invalid={!!manualError && manual.trim() !== ''} />
          {manualError && manual.trim() !== '' && <p className="text-xs text-loss">{manualError}</p>}
        </div>
      )}

      {missing.length > 0 && (
        <p role="alert" className="text-sm text-muted-foreground">
          Set an exchange rate in <Link href="/settings" className="underline underline-offset-2">Settings</Link> to convert {missing.join(', ')} to {currency}.
        </p>
      )}
      {manualError && missing.length === 0 && manual.trim() === '' && (
        <p className="text-sm text-muted-foreground">{manualError} to see your net result.</p>
      )}

      {okPnl && netText && (
        <div className="space-y-2" aria-live="polite">
          <ul className="space-y-1 text-sm">
            <Row label="Deposits" value={money(okPnl.deposits)} />
            <Row label="Withdrawals" value={money(okPnl.withdrawals)} />
            <Row label="Fees" value={money(okPnl.fees)} />
            <Row label="On platform" value={money(okPnl.onPlatform)} />
          </ul>
          <div className="border-t border-border pt-2">
            <p className="flex justify-between gap-3 font-medium">
              <span>Net</span>
              <span
                className={cn('num text-lg', netText.startsWith('+') ? 'text-profit' : netText.startsWith('−') ? 'text-loss' : 'text-muted-foreground')}
                data-testid="real-net"
              >
                {netText}
              </span>
            </p>
            {approx && <p className="num text-right text-sm text-muted-foreground">{approx}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Net = withdrawals − deposits − fees + on platform</p>
          </div>
        </div>
      )}
    </section>
  );
}
