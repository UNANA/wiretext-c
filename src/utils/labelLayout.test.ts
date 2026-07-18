import { describe, it, expect } from 'vitest';
import { computeLabelPlacement } from './labelLayout';

describe('computeLabelPlacement', () => {
  it('defaults reproduce the legacy centered placement', () => {
    // Legacy: centerRow = row + floor(height/2),
    // startCol = col + floor((width - len)/2).
    const placement = computeLabelPlacement(0, 0, 10, 6, 'Hi');
    expect(placement).toEqual({ col: 4, row: 3, text: 'Hi' });
  });

  it('honours object offset for centered default', () => {
    const placement = computeLabelPlacement(5, 2, 12, 4, 'OK');
    expect(placement.col).toBe(5 + Math.floor((12 - 2) / 2));
    expect(placement.row).toBe(2 + Math.floor(4 / 2));
  });

  it('left/top aligns to the inner top-left corner with padding', () => {
    const placement = computeLabelPlacement(0, 0, 10, 6, 'Hi', 'left', 'top');
    expect(placement).toEqual({ col: 2, row: 1, text: 'Hi' });
  });

  it('right/bottom aligns to the inner bottom-right corner with padding', () => {
    const placement = computeLabelPlacement(0, 0, 10, 6, 'Hi', 'right', 'bottom');
    // right: col + width - PADDING - len = 0 + 10 - 2 - 2 = 6
    // bottom: row + height - 2 = 4
    expect(placement).toEqual({ col: 6, row: 4, text: 'Hi' });
  });

  it('truncates overlong text with an ellipsis (matches legacy budget)', () => {
    const placement = computeLabelPlacement(0, 0, 8, 3, 'HelloWorld');
    // maxLen = 8 - 4 = 4 -> slice(0, 3) + '…'
    expect(placement.text).toBe('Hel…');
  });

  it('does not truncate text that exactly fits the budget', () => {
    const placement = computeLabelPlacement(0, 0, 8, 3, 'Four');
    expect(placement.text).toBe('Four');
  });
});
