import { describe, expect, it } from 'vitest';
import type { CanvasLayer } from '../types';
import {
  findPreviousSiblingId,
  getLayerDropPlacement,
  getLayerPanelDragPayload,
  LAYER_PANEL_DRAG_TYPE,
  migrateLegacyLayerParentIds,
  reorderLayersByDrop,
  reparentChildrenOnDelete,
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

describe('findPreviousSiblingId', () => {
  // layer-1 (root)
  // layer-2 (root)
  //   layer-4 (child of layer-2)
  // layer-3 (root)
  const withNesting: CanvasLayer[] = [
    { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
    { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 1 },
    { id: 'layer-4', name: 'Layer 4', order: 2, objectCount: 1, parentId: 'layer-2' },
    { id: 'layer-3', name: 'Layer 3', order: 3, objectCount: 1 },
  ];

  it('skips over a preceding sibling\'s nested children to find the true previous sibling', () => {
    // In a depth-first flattening, layer-4 sits directly above layer-3, but
    // layer-4 is layer-2's child, not layer-3's sibling — the previous root
    // sibling of layer-3 is layer-2.
    expect(findPreviousSiblingId(withNesting, 'layer-3')).toBe('layer-2');
  });

  it('finds the previous sibling within a nested parent', () => {
    const withTwoChildren: CanvasLayer[] = [
      ...withNesting,
      { id: 'layer-5', name: 'Layer 5', order: 4, objectCount: 1, parentId: 'layer-2' },
    ];
    expect(findPreviousSiblingId(withTwoChildren, 'layer-5')).toBe('layer-4');
  });

  it('returns undefined for the first layer among its siblings', () => {
    expect(findPreviousSiblingId(withNesting, 'layer-1')).toBeUndefined();
    expect(findPreviousSiblingId(withNesting, 'layer-4')).toBeUndefined();
  });

  it('returns undefined for an unknown layer id', () => {
    expect(findPreviousSiblingId(withNesting, 'layer-nope')).toBeUndefined();
  });
});

describe('migrateLegacyLayerParentIds', () => {
  it('recovers a parent from the legacy per-object layerParentId field, once per layer', () => {
    const legacyObjects = [
      { id: 'a', layerId: 'layer-3', layerParentId: 'layer-2' },
      { id: 'b', layerId: 'layer-3', layerParentId: undefined },
      { id: 'c', layerId: 'layer-4' },
    ];

    const result = migrateLegacyLayerParentIds(legacyObjects, 'layer-1');

    expect(result.get('layer-3')).toBe('layer-2');
    expect(result.get('layer-4')).toBeUndefined();
    expect(result.has('layer-4')).toBe(false);
  });

  it('falls back to the default layer id for objects without a layerId', () => {
    const legacyObjects = [{ id: 'a', layerParentId: 'layer-2' }];

    const result = migrateLegacyLayerParentIds(legacyObjects, 'layer-1');

    expect(result.get('layer-1')).toBe('layer-2');
  });

  it('returns an empty map when nothing carries legacy hierarchy data', () => {
    const modernObjects = [{ id: 'a', layerId: 'layer-2' }];

    expect(migrateLegacyLayerParentIds(modernObjects, 'layer-1').size).toBe(0);
  });
});

describe('reparentChildrenOnDelete', () => {
  // layer-1 (root)
  // layer-2 (root)
  //   layer-4 (child of layer-2)
  //     layer-5 (child of layer-4)
  const withGrandchild: CanvasLayer[] = [
    { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
    { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 1 },
    { id: 'layer-4', name: 'Layer 4', order: 2, objectCount: 0, parentId: 'layer-2' },
    { id: 'layer-5', name: 'Layer 5', order: 3, objectCount: 1, parentId: 'layer-4' },
  ];

  it('removes the deleted layer from the list', () => {
    const result = reparentChildrenOnDelete(withGrandchild, 'layer-4');
    expect(result.map(layer => layer.id)).toEqual(['layer-1', 'layer-2', 'layer-5']);
  });

  it('re-parents children of the deleted layer to its own parent, avoiding orphans', () => {
    const result = reparentChildrenOnDelete(withGrandchild, 'layer-4');
    expect(result.find(layer => layer.id === 'layer-5')?.parentId).toBe('layer-2');
  });

  it('re-parents children to root (undefined) when the deleted layer was itself a root layer', () => {
    const rootWithChild: CanvasLayer[] = [
      { id: 'layer-1', name: 'Layer 1', order: 0, objectCount: 0 },
      { id: 'layer-2', name: 'Layer 2', order: 1, objectCount: 0 },
      { id: 'layer-4', name: 'Layer 4', order: 2, objectCount: 1, parentId: 'layer-2' },
    ];
    const result = reparentChildrenOnDelete(rootWithChild, 'layer-2');
    expect(result.find(layer => layer.id === 'layer-4')?.parentId).toBeUndefined();
  });

  it('leaves unrelated layers untouched', () => {
    const result = reparentChildrenOnDelete(withGrandchild, 'layer-4');
    expect(result.find(layer => layer.id === 'layer-1')).toEqual(withGrandchild[0]);
    expect(result.find(layer => layer.id === 'layer-2')).toEqual(withGrandchild[1]);
  });

  it('is a no-op (aside from array identity) when the layer id is not found', () => {
    const result = reparentChildrenOnDelete(withGrandchild, 'layer-nope');
    expect(result).toEqual(withGrandchild);
  });
});
