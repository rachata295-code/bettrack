import { describe, it, expect } from 'vitest';
import { resolveShortcut } from '@/lib/shortcuts';

const ev = (key: string, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, targetTag: 'BODY', targetEditable: false, ...o });
describe('resolveShortcut', () => {
  it.each([['w', 'win'], ['W', 'win'], ['l', 'lose'], ['u', 'undo'], ['b', 'focusBet'], ['m', 'focusMultiplier'], ['?', 'help']])('%s', (k, a) => expect(resolveShortcut(ev(k))).toBe(a));
  it('ignores typing in inputs', () => expect(resolveShortcut(ev('w', { targetTag: 'INPUT' }))).toBeNull());
  it('ignores textarea/select/contentEditable', () => {
    expect(resolveShortcut(ev('w', { targetTag: 'TEXTAREA' }))).toBeNull();
    expect(resolveShortcut(ev('w', { targetTag: 'SELECT' }))).toBeNull();
    expect(resolveShortcut(ev('w', { targetEditable: true }))).toBeNull();
  });
  it('ignores modifiers', () => {
    expect(resolveShortcut(ev('w', { metaKey: true }))).toBeNull();
    expect(resolveShortcut(ev('w', { ctrlKey: true }))).toBeNull();
    expect(resolveShortcut(ev('w', { altKey: true }))).toBeNull();
  });
  it('ignores unmapped keys', () => expect(resolveShortcut(ev('x'))).toBeNull());
});
