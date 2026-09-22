import { describe, expect, it } from 'vitest';
import { allowsNativeContextMenu } from './nativeContextMenu';

function fakeElement(matchesEditable: boolean): EventTarget {
  return { closest: () => (matchesEditable ? {} : null) } as unknown as EventTarget;
}

describe('allowsNativeContextMenu', () => {
  it('keeps the native menu inside text fields', () => {
    expect(allowsNativeContextMenu(fakeElement(true))).toBe(true);
  });

  it('suppresses the native menu elsewhere', () => {
    expect(allowsNativeContextMenu(fakeElement(false))).toBe(false);
  });

  it('suppresses the native menu for non-element targets', () => {
    expect(allowsNativeContextMenu(null)).toBe(false);
    expect(allowsNativeContextMenu({} as EventTarget)).toBe(false);
  });
});
