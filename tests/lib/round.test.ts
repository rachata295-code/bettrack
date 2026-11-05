import { describe, expect, it } from 'vitest';
import { BET_ERROR_MESSAGES, previewRound, validateBetInput } from '@/lib/calculations/round';

describe('validateBetInput', () => {
  it('accepts bet equal to balance', () => expect(validateBetInput({ balance: '4', bet: '4', multiplier: '2.03' }).ok).toBe(true));
  it('returns parsed values on success', () =>
    expect(validateBetInput({ balance: '10', bet: ' 4 ', multiplier: '2.030' })).toEqual({ ok: true, bet: '4', multiplier: '2.03' }));
  it('blocks bet above balance', () => expect(validateBetInput({ balance: '3.99', bet: '4', multiplier: '2.03' })).toEqual({ ok: false, errors: ['insufficient_balance'] }));
  it('blocks when balance <= 0', () => expect(validateBetInput({ balance: '-3', bet: '1', multiplier: '2' })).toMatchObject({ ok: false, errors: expect.arrayContaining(['no_balance']) }));
  it('no_balance does not also add insufficient_balance', () =>
    expect(validateBetInput({ balance: '0', bet: '1', multiplier: '2' })).toEqual({ ok: false, errors: ['no_balance'] }));
  it('rejects multiplier <= 1 and bad bet', () => expect(validateBetInput({ balance: '10', bet: '0', multiplier: '1' })).toMatchObject({ ok: false, errors: expect.arrayContaining(['invalid_bet', 'invalid_multiplier']) }));
  it.each(['', '4,00', '1e3', '-4', 'abc', '4.'])('rejects bet %j', (bet) =>
    expect(validateBetInput({ balance: '10', bet, multiplier: '2' })).toEqual({ ok: false, errors: ['invalid_bet'] }));
  it('rejects non-numeric multiplier', () =>
    expect(validateBetInput({ balance: '10', bet: '1', multiplier: 'x' })).toEqual({ ok: false, errors: ['invalid_multiplier'] }));
});
describe('previewRound', () => {
  it('matches spec', () => expect(previewRound('16.99', '4', '2.03')).toEqual({
    win: { payout: '8.12', profit: '4.12', newBalance: '21.11' }, lose: { loss: '4', newBalance: '12.99' } }));
});
describe('BET_ERROR_MESSAGES', () => {
  it('has a message for every error', () =>
    expect(Object.keys(BET_ERROR_MESSAGES).sort()).toEqual(['insufficient_balance', 'invalid_bet', 'invalid_multiplier', 'no_balance']));
});
