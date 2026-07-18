import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import {
  type CanvasLayer,
  DEFAULT_LAYER_ID,
  DEFAULT_LAYER_NAME,
  createLayerObject,
  findLayerAncestorId,
  isLayerObject,
  migrateToUnifiedTree,
} from './layerMigration';

// Pre-unified-tree payload shape: these fields no longer exist on
// CanvasObject and are only accepted as migration input.
type LegacyObject = CanvasObject & {
  layerId?: string;
  layerName?: string;
  layerOrder?: number;
  layerParentId?: string;
};

function makeObject(overrides: Partial<LegacyObject> & { id: string }): LegacyObject {
  return {
    type: 'box',
    position: { col: 0, row: 0 },
    width: 4,
    height: 2,
    zIndex: 0,
    ...overrides,
  };
}

function makeLayer(overrides: Partial<CanvasLayer> & { id: string }): CanvasLayer {
  return {
    name: 'Layer',
    order: 0,
    objectCount: 0,
    ...overrides,
  };
}

function layersOf(result: CanvasObject[]): CanvasObject[] {
  return result.filter(isLayerObject);
}

function byIdOf(result: CanvasObject[]): Map<string, CanvasObject> {
  return new Map(result.map(node => [node.id, node]));
}

describe('migrateToUnifiedTree', () => {
  it('converts a v1 payload (objects + saved layers) into layer nodes with parentId membership', () => {
    const objects = [
      makeObject({ id: 'a', layerId: 'layer-1', layerName: 'Layer 1', layerOrder: 0 }),
      makeObject({ id: 'b', layerId: 'layer-x', layerName: 'Custom', layerOrder: 1 }),
    ];
    const savedLayers = [
      makeLayer({ id: 'layer-1', name: 'Layer 1', order: 0 }),
      makeLayer({ id: 'layer-x', name: 'Custom', order: 1, parentId: 'layer-1' }),
    ];

    const result = migrateToUnifiedTree(objects, savedLayers);
    const byId = byIdOf(result);

    const layerX = byId.get('layer-x')!;
    expect(layerX.type).toBe('layer');
    expect(layerX.label).toBe('Custom');
    expect(layerX.parentId).toBe('layer-1');
    expect(byId.get('a')!.parentId).toBe('layer-1');
    expect(byId.get('b')!.parentId).toBe('layer-x');
    expect('layerId' in byId.get('a')!).toBe(false);
    expect('layerName' in byId.get('a')!).toBe(false);
    expect('layerOrder' in byId.get('a')!).toBe(false);
  });

  it('keeps an existing object parent and drops the redundant layerId (membership via ancestors)', () => {
    const objects = [
      makeObject({ id: 'parent', layerId: 'layer-x', layerName: 'X', layerOrder: 0 }),
      makeObject({ id: 'child', parentId: 'parent', layerId: 'layer-x', layerName: 'X', layerOrder: 0 }),
    ];

    const result = migrateToUnifiedTree(objects);
    const byId = byIdOf(result);

    expect(byId.get('child')!.parentId).toBe('parent');
    expect(byId.get('parent')!.parentId).toBe('layer-x');
    expect(findLayerAncestorId(result, 'child')).toBe('layer-x');
  });

  it('reconstructs layers from object fields for legacy payloads without saved layers', () => {
    const objects = [
      makeObject({ id: 'a', layerId: 'layer-x', layerName: 'Reconstructed', layerOrder: 2 }),
    ];

    const result = migrateToUnifiedTree(objects);
    const byId = byIdOf(result);

    const layerX = byId.get('layer-x')!;
    expect(layerX.type).toBe('layer');
    expect(layerX.label).toBe('Reconstructed');
    expect(byId.get('a')!.parentId).toBe('layer-x');
  });

  it('honors the legacy per-object layerParentId when no saved layers exist', () => {
    const objects = [
      { ...makeObject({ id: 'a', layerId: 'layer-x', layerName: 'X', layerOrder: 1 }), layerParentId: 'layer-1' },
      makeObject({ id: 'b', layerId: 'layer-1', layerName: 'Layer 1', layerOrder: 0 }),
    ];

    const result = migrateToUnifiedTree(objects);
    const byId = byIdOf(result);

    expect(byId.get('layer-x')!.parentId).toBe('layer-1');
    expect('layerParentId' in byId.get('a')!).toBe(false);
  });

  it('ignores legacy layerParentId when saved layers are present', () => {
    const objects = [
      { ...makeObject({ id: 'a', layerId: 'layer-x' }), layerParentId: 'layer-1' },
    ];
    const savedLayers = [makeLayer({ id: 'layer-x', name: 'X', order: 0 })];

    const result = migrateToUnifiedTree(objects, savedLayers);
    expect(byIdOf(result).get('layer-x')!.parentId).toBeUndefined();
  });

  it('always provides the default layer, defaulting parentless objects into it', () => {
    const objects = [makeObject({ id: 'a' })];

    const result = migrateToUnifiedTree(objects);
    const byId = byIdOf(result);

    const defaultLayer = byId.get(DEFAULT_LAYER_ID)!;
    expect(defaultLayer.type).toBe('layer');
    expect(defaultLayer.label).toBe(DEFAULT_LAYER_NAME);
    expect(defaultLayer.parentId).toBeUndefined();
    expect(byId.get('a')!.parentId).toBe(DEFAULT_LAYER_ID);
  });

  it('produces the default layer even for an empty payload', () => {
    const result = migrateToUnifiedTree([]);
    expect(layersOf(result).map(layer => layer.id)).toEqual([DEFAULT_LAYER_ID]);
  });

  it('is idempotent on an already-unified payload', () => {
    const unified = [
      createLayerObject(DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME),
      createLayerObject('layer-x', 'X', { parentId: DEFAULT_LAYER_ID, zIndex: 1 }),
      makeObject({ id: 'a', parentId: 'layer-x' }),
    ];

    const result = migrateToUnifiedTree(unified);
    expect(result).toEqual(unified);
  });

  it('ignores savedLayers when the payload already contains layer nodes', () => {
    const unified = [
      createLayerObject(DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME),
      makeObject({ id: 'a', parentId: DEFAULT_LAYER_ID }),
    ];

    const result = migrateToUnifiedTree(unified, [makeLayer({ id: 'stale', name: 'Stale' })]);
    expect(byIdOf(result).has('stale')).toBe(false);
  });

  it('repairs constraint violations: nested default layer, layer under a non-layer, dangling parents', () => {
    const broken = [
      { ...createLayerObject(DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME), parentId: 'layer-x' },
      createLayerObject('layer-x', 'X', { parentId: 'a' }),
      makeObject({ id: 'a', parentId: 'missing' }),
    ];

    const result = migrateToUnifiedTree(broken);
    const byId = byIdOf(result);

    expect(byId.get(DEFAULT_LAYER_ID)!.parentId).toBeUndefined();
    expect(byId.get('layer-x')!.parentId).toBeUndefined();
    expect(byId.get('a')!.parentId).toBe(DEFAULT_LAYER_ID);
  });

  it('orders siblings within a layer as objects-first-then-sublayers, preserving old paint order', () => {
    const objects = [
      makeObject({ id: 'a', layerId: 'layer-1', layerOrder: 0, zIndex: 1 }),
      makeObject({ id: 'b', layerId: 'layer-1', layerOrder: 0, zIndex: 0 }),
      makeObject({ id: 'c', layerId: 'layer-x', layerOrder: 1, zIndex: 0 }),
    ];
    const savedLayers = [
      makeLayer({ id: 'layer-1', name: 'Layer 1', order: 0 }),
      makeLayer({ id: 'layer-x', name: 'X', order: 1, parentId: 'layer-1' }),
    ];

    const result = migrateToUnifiedTree(objects, savedLayers);
    const byId = byIdOf(result);

    // Children of layer-1: b (z0) < a (z1) < layer-x (sub-layer last).
    expect(byId.get('b')!.zIndex).toBeLessThan(byId.get('a')!.zIndex);
    expect(byId.get('a')!.zIndex).toBeLessThan(byId.get('layer-x')!.zIndex);
  });
});

describe('findLayerAncestorId', () => {
  const tree = [
    createLayerObject(DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME),
    createLayerObject('layer-x', 'X', { parentId: DEFAULT_LAYER_ID }),
    makeObject({ id: 'a', parentId: 'layer-x' }),
    makeObject({ id: 'b', parentId: 'a' }),
    makeObject({ id: 'orphan' }),
  ];

  it('returns the nearest layer ancestor through object parents', () => {
    expect(findLayerAncestorId(tree, 'b')).toBe('layer-x');
    expect(findLayerAncestorId(tree, 'a')).toBe('layer-x');
  });

  it('returns the id itself for a layer node', () => {
    expect(findLayerAncestorId(tree, 'layer-x')).toBe('layer-x');
  });

  it('returns undefined when no layer is reachable', () => {
    expect(findLayerAncestorId(tree, 'orphan')).toBeUndefined();
    expect(findLayerAncestorId(tree, 'nope')).toBeUndefined();
  });
});
