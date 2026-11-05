import { beforeEach, expect, it } from 'vitest';
import { useSettingsStore } from '@/store/settings-store';
import { clearLoadIssue, getLoadIssues } from '@/store/storage';
import { DEFAULT_FEES } from '@/lib/calculations/fx';
import { DEFAULT_GUARD } from '@/lib/calculations/guard';
import { DEFAULT_REALITY_CHECK } from '@/lib/calculations/reality-check';

const SETTINGS = 'bettrack:v1:settings';
beforeEach(() => {
  localStorage.clear();
  clearLoadIssue();
  useSettingsStore.setState({ fx: {}, fees: DEFAULT_FEES, realityCheck: DEFAULT_REALITY_CHECK, guard: DEFAULT_GUARD });
});

it('defaults', () => {
  const s = useSettingsStore.getState();
  expect(s.fx).toEqual({});
  expect(s.fees).toEqual(DEFAULT_FEES);
  expect(s.realityCheck).toEqual({ enabled: true, intervalMin: 30 });
});

it.each([1, 2])('migrates v%i to v3 with fx/fees/realityCheck defaults', async v => {
  localStorage.setItem(SETTINGS, JSON.stringify({ state: { precision: 4, ...(v === 2 ? { guard: DEFAULT_GUARD } : {}) }, version: v }));
  await useSettingsStore.persist.rehydrate();
  const s = useSettingsStore.getState();
  expect(s.precision).toBe(4);
  expect(s.fx).toEqual({});
  expect(s.fees).toEqual(DEFAULT_FEES);
  expect(s.realityCheck).toEqual(DEFAULT_REALITY_CHECK);
  expect(getLoadIssues()).toEqual([]);
});

it('invalid fx/fees/realityCheck on read fall back without a load issue', async () => {
  localStorage.setItem(SETTINGS, JSON.stringify({
    state: { precision: 2, guard: DEFAULT_GUARD, fx: { usdtThb: '-5' }, fees: { tradeFeePct: '200' }, realityCheck: { enabled: 'y', intervalMin: 0 } },
    version: 3,
  }));
  await useSettingsStore.persist.rehydrate();
  const s = useSettingsStore.getState();
  expect(s.fx).toEqual({});
  expect(s.fees).toEqual(DEFAULT_FEES);
  expect(s.realityCheck).toEqual(DEFAULT_REALITY_CHECK);
  expect(getLoadIssues()).toEqual([]);
});

it('setFx / setFees validate, persist at version 3, and round-trip', async () => {
  const st = useSettingsStore.getState();
  expect(st.setFx({ usdtThb: '35.5', usdThb: '' })).toEqual({ ok: true });
  expect(st.setFx({ usdThb: '0' }).ok).toBe(false);
  expect(useSettingsStore.getState().fx).toEqual({ usdtThb: '35.5' });
  expect(st.setFees({ spreadPct: '0.5', thbWithdrawFee: '20' })).toEqual({ ok: true });
  expect(st.setFees({ tradeFeePct: '100' }).ok).toBe(false);
  expect(useSettingsStore.getState().fees.spreadPct).toBe('0.5');
  const stored = JSON.parse(localStorage.getItem(SETTINGS)!);
  expect(stored.version).toBe(3);
  useSettingsStore.setState({ fx: {}, fees: DEFAULT_FEES });
  localStorage.setItem(SETTINGS, JSON.stringify(stored));
  await useSettingsStore.persist.rehydrate();
  expect(useSettingsStore.getState().fx).toEqual({ usdtThb: '35.5' });
  expect(useSettingsStore.getState().fees.thbWithdrawFee).toBe('20');
});

it('setFx can clear a rate', () => {
  useSettingsStore.getState().setFx({ usdtThb: '35' });
  useSettingsStore.getState().setFx({ usdtThb: '' });
  expect(useSettingsStore.getState().fx).toEqual({});
});
