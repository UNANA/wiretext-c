import { describe, expect, it } from 'vitest';
import {
  getLayerDropDepth,
  getLayerDropEdgePlacement,
  getLayerDropPlacement,
  getLayerPanelDragPayload,
  LAYER_PANEL_DRAG_TYPE,
  resolveLayerDrop,
  setLayerPanelDragPayload,
} from './layerDragDrop';

function createDataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: 'uninitialized',
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer;
}

describe('layer panel drag payload', () => {
  it('writes a WebKit-compatible text payload and reads it back', () => {
    const dataTransfer = createDataTransfer();
    setLayerPanelDragPayload(dataTransfer, { type: 'layer', id: 'layer-2' });

    expect(dataTransfer.effectAllowed).toBe('move');
    expect(dataTransfer.getData(LAYER_PANEL_DRAG_TYPE)).not.toBe('');
    expect(dataTransfer.getData('text/plain')).not.toBe('');
    expect(getLayerPanelDragPayload(dataTransfer)).toEqual({ type: 'layer', id: 'layer-2' });
  });

  it('rejects unrelated plain text drops', () => {
    const dataTransfer = createDataTransfer();
    dataTransfer.setData('text/plain', 'not wiretext drag data');

    expect(getLayerPanelDragPayload(dataTransfer)).toBeNull();
  });
});

describe('horizontal layer drop depth', () => {
  it.each([
    [110, 0],
    [126, 1],
    [140, 2],
    [200, 3],
    [80, 0],
  ])('maps pointer x %i to depth %i', (clientX, expected) => {
    expect(getLayerDropDepth(clientX, 96, 3)).toBe(expected);
  });

  it('uses the vertical midpoint only to choose before or after', () => {
    expect(getLayerDropEdgePlacement(109, 100, 20)).toBe('before');
    expect(getLayerDropEdgePlacement(110, 100, 20)).toBe('after');
  });
});

describe('getLayerDropPlacement', () => {
  it.each([
    [100, 'before'],
    [120, 'inside'],
    [139, 'after'],
  ] as const)('maps pointer y %i to %s', (clientY, expected) => {
    expect(getLayerDropPlacement(clientY, 100, 40)).toBe(expected);
  });
});

// L1
//   BoxA
//   BoxB
// L2
//   BoxC
describe('resolveLayerDrop', () => {
  const rows = [
    { id: 'L1', depth: 0 },
    { id: 'BoxA', depth: 1 },
    { id: 'BoxB', depth: 1 },
    { id: 'L2', depth: 0 },
    { id: 'BoxC', depth: 1 },
  ];

  it('nests inside the hovered row when pointing deeper than it', () => {
    expect(resolveLayerDrop(rows, 2, 'before', 2)).toEqual({
      targetId: 'BoxB',
      placement: 'inside',
      indicator: { rowId: 'BoxB', edge: 'inside', depth: 2 },
    });
  });

  it('keeps an upper-half drop between the hovered row and the one above (#28)', () => {
    expect(resolveLayerDrop(rows, 2, 'before', 0)).toEqual({
      targetId: 'BoxB',
      placement: 'before',
      indicator: { rowId: 'BoxB', edge: 'top', depth: 1 },
    });
  });

  it('draws a shallow lower-half drop below the hovered row (#27)', () => {
    expect(resolveLayerDrop(rows, 2, 'after', 0)).toEqual({
      targetId: 'L2',
      placement: 'before',
      indicator: { rowId: 'BoxB', edge: 'bottom', depth: 0 },
    });
  });

  it('does not go shallower than the following row', () => {
    expect(resolveLayerDrop(rows, 1, 'after', 0)).toEqual({
      targetId: 'BoxB',
      placement: 'before',
      indicator: { rowId: 'BoxA', edge: 'bottom', depth: 1 },
    });
  });

  it('allows any depth below the last row', () => {
    expect(resolveLayerDrop(rows, 4, 'after', 0)).toEqual({
      targetId: 'L2',
      placement: 'after',
      indicator: { rowId: 'BoxC', edge: 'bottom', depth: 0 },
    });
  });
});
