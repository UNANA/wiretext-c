import { describe, expect, it } from 'vitest';
import type { CanvasLayer, CanvasObject } from '../types';
import { remapObjectsAndLayersForAdditiveLoad } from './loadMerge';

function makeObject(overrides: Partial<CanvasObject> & { id: string }): CanvasObject {
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

// Sequential id generator so tests can assert exact output ids.
function makeIdGenerator(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

describe('remapObjectsAndLayersForAdditiveLoad', () => {
  it('passes through objects and layers unchanged when nothing collides', () => {
    const objects = [makeObject({ id: 'obj-1', layerId: 'layer-a' })];
    const layers = [makeLayer({ id: 'layer-a' })];

    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      layers,
      new Set(['obj-existing']),
      new Set(['layer-existing']),
      makeIdGenerator('new'),
    );

    expect(result.objects).toEqual(objects);
    expect(result.layers).toEqual(layers);
  });

  it('assigns a fresh id to a colliding object and rewrites parentId references within the incoming set', () => {
    const objects = [
      makeObject({ id: 'obj-1' }),
      makeObject({ id: 'obj-2', parentId: 'obj-1' }),
    ];

    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      [],
      new Set(['obj-1']),
      new Set(),
      makeIdGenerator('new'),
    );

    const parent = result.objects.find(o => o.id !== 'obj-2')!;
    const child = result.objects.find(o => o.id === 'obj-2')!;
    expect(parent.id).not.toBe('obj-1');
    expect(child.parentId).toBe(parent.id);
  });

  it('assigns a fresh id to a colliding layer and rewrites layer parentId and object layerId references', () => {
    const layers = [
      makeLayer({ id: 'layer-a' }),
      makeLayer({ id: 'layer-b', parentId: 'layer-a' }),
    ];
    const objects = [makeObject({ id: 'obj-1', layerId: 'layer-a' })];

    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      layers,
      new Set(),
      new Set(['layer-a']),
      makeIdGenerator('new'),
    );

    const remappedA = result.layers.find(l => l.id !== 'layer-b')!;
    const remappedB = result.layers.find(l => l.id === 'layer-b')!;
    expect(remappedA.id).not.toBe('layer-a');
    expect(remappedB.parentId).toBe(remappedA.id);
    expect(result.objects[0].layerId).toBe(remappedA.id);
  });

  it('rewrites connector startBinding/endBinding objectId references when the bound object collides', () => {
    const objects = [
      makeObject({ id: 'obj-1' }),
      makeObject({ id: 'obj-2' }),
      makeObject({
        id: 'obj-3',
        type: 'arrow',
        isConnector: true,
        startBinding: { objectId: 'obj-1', handle: 'e' },
        endBinding: { objectId: 'obj-2', handle: 'w' },
      }),
    ];

    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      [],
      new Set(['obj-1']),
      new Set(),
      makeIdGenerator('new'),
    );

    const remappedObj1 = result.objects.find(o => o.type === 'box' && o.id !== 'obj-2')!;
    const connector = result.objects.find(o => o.isConnector)!;
    expect(remappedObj1.id).not.toBe('obj-1');
    expect(connector.startBinding?.objectId).toBe(remappedObj1.id);
    expect(connector.endBinding?.objectId).toBe('obj-2');
  });

  it('never produces an id that collides with an existing id, even if the generator repeats one', () => {
    // Generator first offers an id that's already taken on the canvas, then
    // one already taken by an unrelated incoming object, before a free one.
    const idSequence = ['existing-1', 'obj-2', 'fresh-1'];
    let i = 0;
    const generateId = () => idSequence[i++];

    const objects = [
      makeObject({ id: 'obj-1' }),
      makeObject({ id: 'obj-2' }),
    ];

    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      [],
      new Set(['obj-1', 'existing-1']),
      new Set(),
      generateId,
    );

    const remapped = result.objects.find(o => o.id !== 'obj-2')!;
    expect(remapped.id).toBe('fresh-1');
  });

  it('leaves objects/layers without parent or layer references untouched aside from id remap', () => {
    const objects = [makeObject({ id: 'obj-1' })];
    const result = remapObjectsAndLayersForAdditiveLoad(
      objects,
      [],
      new Set(['obj-1']),
      new Set(),
      makeIdGenerator('new'),
    );
    expect(result.objects[0].parentId).toBeUndefined();
    expect(result.objects[0].layerId).toBeUndefined();
  });
});
