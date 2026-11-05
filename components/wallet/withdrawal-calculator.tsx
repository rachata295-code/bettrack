'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { netBankWithdrawal, rateToThb } from '@/lib/calculations/fx';
import { formatMoney, isPositive, parseMoneyInput } from '@/lib/calculations/money';
import { useSettingsStore } from '@/store/settings-store';
import type { Currency } from '@/types';

const ITEMS = [
  { value: 'USDT', label: 'USDT' },
  { value: 'USD', label: 'USD' },
];

export function WithdrawalCalculator() {
  const fx = useSettingsStore(s => s.fx);
  const fees = useSettingsStore(s => s.fees);
  const precision = useSettingsStore(s => s.precision);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USDT');

  const rate = rateToThb(currency, fx);
  const parsed = parseMoneyInput(amount);
  const valid = parsed.ok && isPositive(parsed.value);
  const result = valid && rate !== null ? netBankWithdrawal(parsed.value, rate, fees) : null;

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="text-base font-medium">Withdrawal calculator</h3>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wd-amount">Amount to withdraw</Label>
          <Input id="wd-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wd-currency">Currency</Label>
          <Select items={ITEMS} value={currency} onValueChange={v => v && setCurrency(v as Currency)}>
            <SelectTrigger id="wd-currency" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{ITEMS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {rate === null && <p className="text-sm text-muted-foreground">Set an exchange rate above.</p>}
      {amount.trim() !== '' && !valid && <p className="text-sm text-loss">Enter an amount greater than 0.</p>}
      {result && (
        <div className="space-y-2" aria-live="polite">
          <ol className="space-y-1 text-sm">
            {result.steps.map(s => (
              <li key={s.label} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="num">{formatMoney(s.value, { precision })}</span>
              </li>
            ))}
          </ol>
          <p className="flex justify-between gap-3 border-t border-border pt-2 font-medium">
            <span>Net to your bank</span>
            <span className="num" data-testid="withdraw-net">{formatMoney(result.net, { precision, currency: 'THB' })}</span>
          </p>
          {result.clampedToZero && (
            <p role="alert" className="text-sm text-loss">Fees exceed the amount — nothing would reach your bank.</p>
          )}
        </div>
      )}
    </div>
  );
}
