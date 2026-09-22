import { describe, it, expect } from 'vitest';
import { computeLabelLines, computeLabelPlacement } from './labelLayout';

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

describe('computeLabelLines', () => {
  it('matches computeLabelPlacement for a single line', () => {
    for (const verticalAlign of ['top', 'middle', 'bottom'] as const) {
      expect(computeLabelLines(0, 0, 10, 6, 'Hi', 'center', verticalAlign))
        .toEqual([computeLabelPlacement(0, 0, 10, 6, 'Hi', 'center', verticalAlign)]);
    }
  });

  it('centers a multi-line block vertically and each line horizontally', () => {
    expect(computeLabelLines(0, 0, 10, 6, 'Hi\nLong')).toEqual([
      { col: 4, row: 2, text: 'Hi' },
      { col: 3, row: 3, text: 'Long' },
    ]);
  });

  it('stacks lines from the top or up from the bottom', () => {
    expect(computeLabelLines(0, 0, 10, 6, 'a\nb', 'left', 'top').map(p => p.row)).toEqual([1, 2]);
    expect(computeLabelLines(0, 0, 10, 6, 'a\nb', 'left', 'bottom').map(p => p.row)).toEqual([3, 4]);
  });

  it('drops lines that do not fit inside the frame', () => {
    expect(computeLabelLines(0, 0, 10, 4, 'a\nb\nc').map(p => p.text)).toEqual(['a', 'b']);
  });
});
