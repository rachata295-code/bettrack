import { beforeEach, expect, it } from 'vitest';
import { useBetStore } from '@/store/bet-store';
import { useSettingsStore } from '@/store/settings-store';
import { DEFAULT_REALITY_CHECK } from '@/lib/calculations/reality-check';

const BETS = 'bettrack:v1:bets';
beforeEach(() => {
  localStorage.clear();
  useBetStore.getState().resetAll();
  useSettingsStore.setState({ realityCheck: DEFAULT_REALITY_CHECK });
});

it('ackReality persists and rehydrates', async () => {
  const id = useBetStore.getState().activeSessionId;
  useBetStore.getState().ackReality(id, '2026-11-05', 2);
  const stored = JSON.parse(localStorage.getItem(BETS)!);
  expect(stored.state.realityAck).toEqual({ sessionId: id, day: '2026-11-05', index: 2 });
  useBetStore.setState({ realityAck: null }); // also persists null, so put the stored copy back
  localStorage.setItem(BETS, JSON.stringify(stored));
  await useBetStore.persist.rehydrate();
  expect(useBetStore.getState().realityAck).toEqual({ sessionId: id, day: '2026-11-05', index: 2 });
});

it('invalid stored ack -> null; resetAll clears', async () => {
  const st = JSON.parse(JSON.stringify({ state: { ...useBetStore.getState(), realityAck: { sessionId: 1, day: 'x', index: 'y' } }, version: 1 }));
  localStorage.setItem(BETS, JSON.stringify(st));
  await useBetStore.persist.rehydrate();
  expect(useBetStore.getState().realityAck).toBeNull();
  useBetStore.getState().ackReality(useBetStore.getState().activeSessionId, '2026-11-05', 1);
  useBetStore.getState().resetAll();
  expect(useBetStore.getState().realityAck).toBeNull();
});

it('setRealityCheck validates 5-240 and changes nothing on failure', () => {
  const s = useSettingsStore.getState();
  expect(s.setRealityCheck({ intervalMin: 45 })).toEqual({ ok: true });
  expect(useSettingsStore.getState().realityCheck).toEqual({ enabled: true, intervalMin: 45 });
  const bad = useSettingsStore.getState().setRealityCheck({ intervalMin: 3 });
  expect(bad.ok).toBe(false);
  expect(useSettingsStore.getState().realityCheck.intervalMin).toBe(45);
  expect(useSettingsStore.getState().setRealityCheck({ enabled: false })).toEqual({ ok: true });
});
