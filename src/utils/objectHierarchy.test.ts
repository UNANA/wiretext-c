import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import {
  buildPaintOrder,
  canReparentObject,
  collectObjectDescendants,
  flattenObjectTree,
  normalizeSiblingOrder,
  sortObjectsByStackOrder,
  remapParentIdsForClones,
  removeObjectsAndReparentChildren,
  resolveObjectDropParent,
  sanitizeObjectParents,
} from './objectHierarchy';

function makeObject(id: string, parentId?: string): CanvasObject {
  return {
    id,
    type: 'box',
    position: { col: 0, row: 0 },
    width: 4,
    height: 2,
    zIndex: 0,
    parentId,
  };
}

// obj-1 (root)
// obj-2 (root)
//   obj-3 (child of obj-2)
//     obj-4 (child of obj-3)
// obj-5 (root)
const tree: CanvasObject[] = [
  makeObject('obj-1'),
  makeObject('obj-2'),
  makeObject('obj-3', 'obj-2'),
  makeObject('obj-4', 'obj-3'),
  makeObject('obj-5'),
];

describe('collectObjectDescendants', () => {
  it('includes the roots themselves plus all descendants', () => {
    expect(collectObjectDescendants(tree, ['obj-2'])).toEqual(new Set(['obj-2', 'obj-3', 'obj-4']));
  });

  it('accepts several roots and unions their subtrees', () => {
    expect(collectObjectDescendants(tree, ['obj-3', 'obj-5'])).toEqual(new Set(['obj-3', 'obj-4', 'obj-5']));
  });

  it('returns just the id for a leaf object', () => {
    expect(collectObjectDescendants(tree, ['obj-4'])).toEqual(new Set(['obj-4']));
  });

  it('does not loop forever on cyclic parent data', () => {
    const cyclic = [makeObject('a', 'b'), makeObject('b', 'a')];
    expect(collectObjectDescendants(cyclic, ['a'])).toEqual(new Set(['a', 'b']));
  });
});

describe('canReparentObject', () => {
  it('allows nesting under an unrelated object', () => {
    expect(canReparentObject(tree, 'obj-1', 'obj-4')).toBe(true);
  });

  it('allows moving to the root', () => {
    expect(canReparentObject(tree, 'obj-4', undefined)).toBe(true);
  });

  it('rejects self-parenting', () => {
    expect(canReparentObject(tree, 'obj-2', 'obj-2')).toBe(false);
  });

  it('rejects re-parenting onto a descendant (cycle prevention)', () => {
    expect(canReparentObject(tree, 'obj-2', 'obj-3')).toBe(false);
    expect(canReparentObject(tree, 'obj-2', 'obj-4')).toBe(false);
  });

  it('rejects unknown object or parent ids', () => {
    expect(canReparentObject(tree, 'obj-nope', 'obj-1')).toBe(false);
    expect(canReparentObject(tree, 'obj-1', 'obj-nope')).toBe(false);
  });
});

describe('removeObjectsAndReparentChildren', () => {
  it('re-parents children of the deleted object to its own parent, like layer deletion', () => {
    const result = removeObjectsAndReparentChildren(tree, new Set(['obj-3']));

    expect(result.map(obj => obj.id)).toEqual(['obj-1', 'obj-2', 'obj-4', 'obj-5']);
    expect(result.find(obj => obj.id === 'obj-4')?.parentId).toBe('obj-2');
  });

  it('re-parents children to the root (undefined) when the deleted parent was a root object', () => {
    const result = removeObjectsAndReparentChildren(tree, new Set(['obj-2']));

    expect(result.find(obj => obj.id === 'obj-3')?.parentId).toBeUndefined();
  });

  it('walks up through a deleted chain to the nearest surviving ancestor', () => {
    const result = removeObjectsAndReparentChildren(tree, new Set(['obj-2', 'obj-3']));

    expect(result.map(obj => obj.id)).toEqual(['obj-1', 'obj-4', 'obj-5']);
    expect(result.find(obj => obj.id === 'obj-4')?.parentId).toBeUndefined();
  });

  it('leaves unrelated objects untouched', () => {
    const result = removeObjectsAndReparentChildren(tree, new Set(['obj-3']));

    expect(result.find(obj => obj.id === 'obj-1')).toEqual(tree[0]);
    expect(result.find(obj => obj.id === 'obj-5')).toEqual(tree[4]);
  });
});

describe('sanitizeObjectParents', () => {
  it('clears a parentId that references a missing object', () => {
    const objects = [makeObject('a'), makeObject('b', 'gone')];
    const result = sanitizeObjectParents(objects);

    expect(result.find(obj => obj.id === 'b')?.parentId).toBeUndefined();
  });

  it('breaks parent cycles', () => {
    const objects = [makeObject('a', 'b'), makeObject('b', 'a'), makeObject('c', 'a')];
    const result = sanitizeObjectParents(objects);

    expect(result.find(obj => obj.id === 'a')?.parentId).toBeUndefined();
    expect(result.find(obj => obj.id === 'b')?.parentId).toBeUndefined();
    // c pointed into the cycle; its own chain is broken with it.
    expect(result.find(obj => obj.id === 'c')?.parentId).toBeUndefined();
  });

  it('keeps valid hierarchies unchanged', () => {
    expect(sanitizeObjectParents(tree)).toEqual(tree);
  });
});

describe('remapParentIdsForClones', () => {
  it('re-points a clone at its cloned parent when both were copied', () => {
    const clones = [makeObject('new-2'), makeObject('new-3', 'obj-2')];
    const result = remapParentIdsForClones(clones, new Map([['obj-2', 'new-2'], ['obj-3', 'new-3']]));

    expect(result.find(obj => obj.id === 'new-3')?.parentId).toBe('new-2');
  });

  it('detaches a clone whose parent was not copied', () => {
    const clones = [makeObject('new-3', 'obj-2')];
    const result = remapParentIdsForClones(clones, new Map([['obj-3', 'new-3']]));

    expect(result[0].parentId).toBeUndefined();
  });
});

describe('resolveObjectDropParent', () => {
  it('nests under the target when dropped inside', () => {
    const target = tree.find(obj => obj.id === 'obj-5')!;
    expect(resolveObjectDropParent(tree, 'obj-1', target, 'inside')).toEqual({ ok: true, parentId: 'obj-5' });
  });

  it('adopts the target\'s parent when dropped before or after (sibling drop)', () => {
    const target = tree.find(obj => obj.id === 'obj-3')!;
    expect(resolveObjectDropParent(tree, 'obj-1', target, 'before')).toEqual({ ok: true, parentId: 'obj-2' });
    expect(resolveObjectDropParent(tree, 'obj-1', target, 'after')).toEqual({ ok: true, parentId: 'obj-2' });
  });

  it('rejects dropping a parent inside its own descendant', () => {
    const target = tree.find(obj => obj.id === 'obj-4')!;
    expect(resolveObjectDropParent(tree, 'obj-2', target, 'inside')).toEqual({ ok: false });
  });
});

describe('flattenObjectTree', () => {
  it('flattens depth-first with a depth per row', () => {
    const result = flattenObjectTree(tree);

    expect(result.map(row => row.object.id)).toEqual(['obj-1', 'obj-2', 'obj-3', 'obj-4', 'obj-5']);
    expect(result.map(row => row.depth)).toEqual([0, 0, 1, 2, 0]);
  });

  it('renders an object at the root when its parent is not in the same list (other layer)', () => {
    const partial = tree.filter(obj => obj.id !== 'obj-2');
    const result = flattenObjectTree(partial);

    expect(result.find(row => row.object.id === 'obj-3')?.depth).toBe(0);
    expect(result.find(row => row.object.id === 'obj-4')?.depth).toBe(1);
  });

  it('keeps every row visible even with cyclic parent data', () => {
    const cyclic = [makeObject('a', 'b'), makeObject('b', 'a')];
    const result = flattenObjectTree(cyclic);

    expect(result.map(row => row.object.id).sort()).toEqual(['a', 'b']);
  });
});

describe('buildPaintOrder / sortObjectsByStackOrder', () => {
  function node(id: string, zIndex: number, parentId?: string, type: CanvasObject['type'] = 'box'): CanvasObject {
    return { ...makeObject(id, parentId), zIndex, type };
  }

  it('orders depth-first: children paint directly above their parent, before the next sibling', () => {
    const objects = [
      node('layer-1', 0, undefined, 'layer'),
      node('a', 0, 'layer-1'),
      node('a1', 0, 'a'),
      node('b', 1, 'layer-1'),
    ];
    const sorted = sortObjectsByStackOrder(objects).map(obj => obj.id);
    expect(sorted).toEqual(['layer-1', 'a', 'a1', 'b']);
  });

  it('orders root layers by zIndex, whole subtree after whole subtree', () => {
    const objects = [
      node('layer-2', 1, undefined, 'layer'),
      node('x', 0, 'layer-2'),
      node('layer-1', 0, undefined, 'layer'),
      node('y', 0, 'layer-1'),
    ];
    const sorted = sortObjectsByStackOrder(objects).map(obj => obj.id);
    expect(sorted).toEqual(['layer-1', 'y', 'layer-2', 'x']);
  });

  it('keeps unreachable nodes (parent cycles) at the end instead of dropping them', () => {
    const objects = [
      node('a', 0),
      node('c1', 0, 'c2'),
      node('c2', 1, 'c1'),
    ];
    const order = buildPaintOrder(objects);
    expect(order.size).toBe(3);
    expect(order.get('a')).toBe(0);
  });
});

describe('normalizeSiblingOrder', () => {
  it('reassigns dense zIndex per sibling group, preserving relative order', () => {
    const objects = [
      { ...makeObject('a', 'p'), zIndex: 5 },
      { ...makeObject('b', 'p'), zIndex: 2 },
      { ...makeObject('p'), zIndex: 7 },
      { ...makeObject('q'), zIndex: 3 },
    ];
    const result = normalizeSiblingOrder(objects);
    const byId = new Map(result.map(obj => [obj.id, obj]));
    expect(byId.get('b')!.zIndex).toBe(0);
    expect(byId.get('a')!.zIndex).toBe(1);
    expect(byId.get('q')!.zIndex).toBe(0);
    expect(byId.get('p')!.zIndex).toBe(1);
  });

  it('groups nodes with a missing parent at the root', () => {
    const objects = [
      { ...makeObject('a', 'missing'), zIndex: 9 },
      { ...makeObject('b'), zIndex: 1 },
    ];
    const result = normalizeSiblingOrder(objects);
    const byId = new Map(result.map(obj => [obj.id, obj]));
    expect(byId.get('b')!.zIndex).toBe(0);
    expect(byId.get('a')!.zIndex).toBe(1);
  });

  it('returns identical object references when nothing changes', () => {
    const objects = [
      { ...makeObject('a'), zIndex: 0 },
      { ...makeObject('b'), zIndex: 1 },
    ];
    const result = normalizeSiblingOrder(objects);
    expect(result[0]).toBe(objects[0]);
    expect(result[1]).toBe(objects[1]);
  });
});
