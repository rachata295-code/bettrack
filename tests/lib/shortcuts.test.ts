import { describe, it, expect } from 'vitest';
import { resolveShortcut } from '@/lib/shortcuts';

const ev = (key: string, o = {}) => ({ key, code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, targetTag: 'BODY', targetEditable: false, ...o });
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
  it('ignores unmapped keys', () => expect(resolveShortcut(ev('x', { code: 'KeyX' }))).toBeNull());

  describe('non-Latin layouts (Thai Kedmanee) fall back to the physical key (I6)', () => {
    it.each([
      ['ไ', 'KeyW', 'win'],
      ['ส', 'KeyL', 'lose'],
      ['ี', 'KeyU', 'undo'],
      ['ิ', 'KeyB', 'focusBet'],
      ['ท', 'KeyM', 'focusMultiplier'],
    ])('%s (%s) -> %s', (key, code, action) => expect(resolveShortcut(ev(key, { code }))).toBe(action));
    it('Shift+Slash opens help even when key is not "?"', () => {
      expect(resolveShortcut(ev('ฦ', { code: 'Slash', shiftKey: true }))).toBe('help');
      expect(resolveShortcut(ev('ฝ', { code: 'Slash' }))).toBeNull();
    });
    it('still ignores typing and modifiers on the fallback', () => {
      expect(resolveShortcut(ev('ไ', { code: 'KeyW', targetTag: 'INPUT' }))).toBeNull();
      expect(resolveShortcut(ev('ไ', { code: 'KeyW', ctrlKey: true }))).toBeNull();
    });
    it('does not remap Latin layouts by position (AZERTY "z" sits on KeyW)', () => {
      expect(resolveShortcut(ev('z', { code: 'KeyW' }))).toBeNull();
    });
  });
});
