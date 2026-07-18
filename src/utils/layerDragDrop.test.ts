import { describe, expect, it } from 'vitest';
import type { CanvasLayer } from '../types';
import {
  getLayerDropPlacement,
  getLayerPanelDragPayload,
  LAYER_PANEL_DRAG_TYPE,
  reorderLayersByDrop,
  setLayerPanelDragPayload,
} from './layerDragDrop';

function createDataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: 'uninitialized',
    setData: (type: string, value: string) => values.set(type, value),
    getData: (type: string) => values.get(type) ?? '',
  } as DataTransfer;
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

const layers: CanvasLayer[] = [
  { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
  { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 1 },
  { id: 'layer-3', name: 'Layer 3', order: 2, objectCount: 1 },
];

describe('getLayerDropPlacement', () => {
  it.each([
    [100, 'before'],
    [120, 'inside'],
    [139, 'after'],
  ] as const)('maps pointer y %i to %s', (clientY, expected) => {
    expect(getLayerDropPlacement(clientY, 100, 40)).toBe(expected);
  });
});

describe('reorderLayersByDrop', () => {
  it('nests a layer when dropped inside another layer', () => {
    const result = reorderLayersByDrop(layers, 'layer-3', 'layer-2', 'inside');

    expect(result?.find(layer => layer.id === 'layer-3')?.parentId).toBe('layer-2');
  });

  it('moves a layer before a sibling and adopts its parent', () => {
    const nested = layers.map(layer => (
      layer.id === 'layer-3' ? { ...layer, parentId: 'layer-2' } : layer
    ));
    const result = reorderLayersByDrop(nested, 'layer-3', 'layer-2', 'before');

    expect(result?.map(layer => layer.id)).toEqual(['layer-1', 'layer-3', 'layer-2']);
    expect(result?.find(layer => layer.id === 'layer-3')?.parentId).toBeUndefined();
  });

  it('rejects dropping a parent inside its descendant', () => {
    const nested = layers.map(layer => (
      layer.id === 'layer-3' ? { ...layer, parentId: 'layer-2' } : layer
    ));

    expect(reorderLayersByDrop(nested, 'layer-2', 'layer-3', 'inside')).toBeNull();
  });

  it('keeps the default layer at the root', () => {
    expect(reorderLayersByDrop(layers, 'layer-1', 'layer-2', 'inside')).toBeNull();
  });
});
