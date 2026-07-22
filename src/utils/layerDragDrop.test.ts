import { describe, expect, it } from 'vitest';
import {
  getLayerDropDepth,
  getLayerDropEdgePlacement,
  getLayerDropPlacement,
  getLayerPanelDragPayload,
  LAYER_PANEL_DRAG_TYPE,
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
