import { describe, expect, it } from 'vitest';
import {
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

describe('getLayerDropPlacement', () => {
  it.each([
    [100, 'before'],
    [120, 'inside'],
    [139, 'after'],
  ] as const)('maps pointer y %i to %s', (clientY, expected) => {
    expect(getLayerDropPlacement(clientY, 100, 40)).toBe(expected);
  });
});
