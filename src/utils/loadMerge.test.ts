import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import { createLayerObject } from './layerMigration';
import { remapObjectsForAdditiveLoad } from './loadMerge';

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

// Sequential id generator so tests can assert exact output ids.
function makeIdGenerator(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

describe('remapObjectsForAdditiveLoad', () => {
  it('passes through objects unchanged when nothing collides', () => {
    const objects = [
      createLayerObject('layer-a', 'A'),
      makeObject({ id: 'obj-1', parentId: 'layer-a' }),
    ];

    const result = remapObjectsForAdditiveLoad(objects, new Set(['obj-existing']), makeIdGenerator('new'));

    expect(result).toEqual(objects);
  });

  it('assigns a fresh id to a colliding object and rewrites parentId references within the incoming set', () => {
    const objects = [
      makeObject({ id: 'obj-1' }),
      makeObject({ id: 'obj-2', parentId: 'obj-1' }),
    ];

    const result = remapObjectsForAdditiveLoad(objects, new Set(['obj-1']), makeIdGenerator('new'));

    const parent = result.find(o => o.id !== 'obj-2')!;
    const child = result.find(o => o.id === 'obj-2')!;
    expect(parent.id).not.toBe('obj-1');
    expect(child.parentId).toBe(parent.id);
  });

  it('remaps a colliding layer node (single id space) and objects follow it via parentId', () => {
    // The canvas always owns 'layer-1', so an incoming default layer gets a
    // fresh id and coexists as a separate layer — the pre-unification merge
    // behavior.
    const objects = [
      createLayerObject('layer-1', 'Layer 1'),
      createLayerObject('layer-b', 'B', { parentId: 'layer-1' }),
      makeObject({ id: 'obj-1', parentId: 'layer-1' }),
    ];

    const result = remapObjectsForAdditiveLoad(objects, new Set(['layer-1']), makeIdGenerator('new'));

    const remappedDefault = result.find(o => o.type === 'layer' && o.id !== 'layer-b')!;
    expect(remappedDefault.id).not.toBe('layer-1');
    expect(result.find(o => o.id === 'layer-b')!.parentId).toBe(remappedDefault.id);
    expect(result.find(o => o.id === 'obj-1')!.parentId).toBe(remappedDefault.id);
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

    const result = remapObjectsForAdditiveLoad(objects, new Set(['obj-1']), makeIdGenerator('new'));

    const remappedObj1 = result.find(o => o.type === 'box' && o.id !== 'obj-2')!;
    const connector = result.find(o => o.isConnector)!;
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

    const result = remapObjectsForAdditiveLoad(objects, new Set(['obj-1', 'existing-1']), generateId);

    const remapped = result.find(o => o.id !== 'obj-2')!;
    expect(remapped.id).toBe('fresh-1');
  });

  it('leaves objects without parent references untouched aside from id remap', () => {
    const objects = [makeObject({ id: 'obj-1' })];
    const result = remapObjectsForAdditiveLoad(objects, new Set(['obj-1']), makeIdGenerator('new'));
    expect(result[0].parentId).toBeUndefined();
    expect(result[0].id).toBe('new-1');
  });
});
