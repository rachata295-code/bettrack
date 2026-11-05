import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useWalletColumns } from '@/hooks/use-analytics';
import type { BucketSummary } from '@/lib/calculations/periods';
import { useSettingsStore } from '@/store/settings-store';
import { useWalletStore } from '@/store/wallet-store';

const bucket = { key: '2026-11-04' } as BucketSummary;
const add = (currency: 'USDT' | 'THB' | 'USD', amount: string) =>
  useWalletStore.getState().addTransaction({ type: 'deposit', amount, fee: '0', currency, at: '2026-11-04T03:00:00.000Z' });

beforeEach(() => {
  localStorage.clear();
  useWalletStore.getState().resetAll();
  useSettingsStore.setState({ fx: {} });
});

describe('useWalletColumns', () => {
  it('no transactions: no columns, no missing rates', () => {
    const { result } = renderHook(() => useWalletColumns([bucket], 'day', 'USDT'));
    expect(result.current).toEqual({ totals: null, missingRates: [] });
  });
  it('passes through the actual missing currencies', () => {
    add('USDT', '10');
    add('THB', '350');
    add('USD', '1');
    const { result } = renderHook(() => useWalletColumns([bucket], 'day', 'USDT'));
    expect(result.current).toEqual({ totals: null, missingRates: ['THB', 'USD'] });
  });
  it('returns converted totals when rates exist', () => {
    add('THB', '350');
    useSettingsStore.setState({ fx: { usdtThb: '35' } });
    const { result } = renderHook(() => useWalletColumns([bucket], 'day', 'USDT'));
    expect(result.current).toEqual({ totals: { '2026-11-04': { deposits: '10', withdrawals: '0' } }, missingRates: [] });
  });
});
