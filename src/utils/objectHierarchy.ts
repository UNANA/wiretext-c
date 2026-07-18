import type { CanvasObject } from '../types';
import type { LayerDropPlacement } from './layerDragDrop';

type ObjectNode = Pick<CanvasObject, 'id' | 'parentId'>;

/**
 * Expands a set of object ids to include every descendant (children,
 * grandchildren, ...). Used so moving a parent object drags its whole
 * subtree along by the same delta. Cycle-safe: each id is visited once.
 */
export function collectObjectDescendants(
  objects: ObjectNode[],
  rootIds: Iterable<string>,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const obj of objects) {
    if (!obj.parentId) continue;
    childrenByParent.set(obj.parentId, [...(childrenByParent.get(obj.parentId) ?? []), obj.id]);
  }

  const result = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return result;
}

/**
 * Whether `objectId` may adopt `parentId` as its parent. Rejects unknown
 * ids, self-parenting, and any assignment that would create a cycle
 * (re-parenting onto one's own descendant). `undefined` parentId (move to
 * root) is always allowed for a known object.
 */
export function canReparentObject(
  objects: ObjectNode[],
  objectId: string,
  parentId?: string,
): boolean {
  if (objectId === parentId) return false;
  const byId = new Map(objects.map(obj => [obj.id, obj]));
  if (!byId.has(objectId)) return false;
  if (parentId === undefined) return true;
  if (!byId.has(parentId)) return false;

  const seen = new Set<string>();
  let ancestorId: string | undefined = parentId;
  while (ancestorId) {
    if (ancestorId === objectId) return false;
    if (seen.has(ancestorId)) break; // pre-existing cycle; don't loop forever
    seen.add(ancestorId);
    ancestorId = byId.get(ancestorId)?.parentId;
  }
  return true;
}

/**
 * Removes the objects in `deletedIds`, re-parenting each surviving child to
 * its nearest surviving ancestor — the same rule layer deletion uses
 * (reparentChildrenOnDelete in layerDragDrop.ts), generalized to handle
 * deleting several objects at once (e.g. a multi-selection that contains a
 * parent-and-child chain).
 */
export function removeObjectsAndReparentChildren(
  objects: CanvasObject[],
  deletedIds: ReadonlySet<string>,
): CanvasObject[] {
  const byId = new Map(objects.map(obj => [obj.id, obj]));

  const nearestSurvivingAncestor = (parentId?: string): string | undefined => {
    const seen = new Set<string>();
    let ancestorId = parentId;
    while (ancestorId && deletedIds.has(ancestorId)) {
      if (seen.has(ancestorId)) return undefined;
      seen.add(ancestorId);
      ancestorId = byId.get(ancestorId)?.parentId;
    }
    return ancestorId;
  };

  return objects
    .filter(obj => !deletedIds.has(obj.id))
    .map(obj => {
      if (!obj.parentId || !deletedIds.has(obj.parentId)) return obj;
      return { ...obj, parentId: nearestSurvivingAncestor(obj.parentId) };
    });
}

/**
 * Clears parentIds that reference missing objects and breaks any parent
 * cycles found in loaded data (hand-edited files, older builds). Run once
 * at load time so runtime code can trust the hierarchy.
 */
export function sanitizeObjectParents<T extends ObjectNode>(objects: T[]): T[] {
  const byId = new Map(objects.map(obj => [obj.id, obj]));

  const isValidParent = (obj: T): boolean => {
    if (!obj.parentId) return false;
    if (!byId.has(obj.parentId)) return false;
    const seen = new Set<string>([obj.id]);
    let ancestorId: string | undefined = obj.parentId;
    while (ancestorId) {
      if (seen.has(ancestorId)) return false; // cycle
      seen.add(ancestorId);
      ancestorId = byId.get(ancestorId)?.parentId;
    }
    return true;
  };

  return objects.map(obj => {
    if (!obj.parentId || isValidParent(obj)) return obj;
    return { ...obj, parentId: undefined };
  });
}

/**
 * Re-points parentIds after copy/duplicate: when the parent was copied too,
 * the clone's parentId follows the cloned parent; otherwise the clone
 * detaches (a pasted copy should not silently follow the original parent's
 * moves).
 */
export function remapParentIdsForClones<T extends ObjectNode>(
  clones: T[],
  oldIdToNewId: ReadonlyMap<string, string>,
): T[] {
  return clones.map(clone => {
    if (!clone.parentId) return clone;
    return { ...clone, parentId: oldIdToNewId.get(clone.parentId) };
  });
}

/**
 * Resolves the parent an object should adopt when dropped on `target` in
 * the layers panel, mirroring reorderLayersByDrop: 'inside' nests under the
 * target, 'before'/'after' makes it the target's sibling. Returns
 * `{ ok: false }` when the assignment would create a cycle.
 */
export function resolveObjectDropParent(
  objects: ObjectNode[],
  dragObjectId: string,
  target: ObjectNode,
  placement: LayerDropPlacement,
): { ok: true; parentId?: string } | { ok: false } {
  const parentId = placement === 'inside' ? target.id : target.parentId;
  if (!canReparentObject(objects, dragObjectId, parentId)) return { ok: false };
  return { ok: true, parentId };
}

/**
 * Flattens one layer's objects into depth-first display order with a depth
 * per row, matching the layer tree's own indent rendering. An object whose
 * parent is not in `objectsInLayer` (parent lives on another layer, or no
 * parent) renders at the root. Sibling order preserves the incoming order
 * of `objectsInLayer` (callers pass it stack-sorted).
 */
export function flattenObjectTree<T extends ObjectNode>(
  objectsInLayer: T[],
): Array<{ object: T; depth: number }> {
  const ids = new Set(objectsInLayer.map(obj => obj.id));
  const byParent = new Map<string | undefined, T[]>();
  for (const obj of objectsInLayer) {
    const parentId = obj.parentId && ids.has(obj.parentId) ? obj.parentId : undefined;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), obj]);
  }

  const flattened: Array<{ object: T; depth: number }> = [];
  const visited = new Set<string>();
  const appendChildren = (parentId: string | undefined, depth: number) => {
    for (const obj of byParent.get(parentId) ?? []) {
      if (visited.has(obj.id)) continue; // cycle guard
      visited.add(obj.id);
      flattened.push({ object: obj, depth });
      appendChildren(obj.id, depth + 1);
    }
  };
  appendChildren(undefined, 0);

  // Anything unreachable from the root (only possible with a parent cycle
  // in corrupt data) still gets a row instead of silently disappearing.
  for (const obj of objectsInLayer) {
    if (!visited.has(obj.id)) flattened.push({ object: obj, depth: 0 });
  }
  return flattened;
}

type OrderedNode = Pick<CanvasObject, 'id' | 'parentId' | 'zIndex'>;

/**
 * Paint order for the unified tree: depth-first traversal with siblings
 * ordered by zIndex, so a node always paints above its parent and the layers
 * panel's display order equals the canvas stacking order. Returns a
 * position-per-id map; unreachable nodes (corrupt parent cycles) land at the
 * end, mirroring flattenObjectTree.
 */
export function buildPaintOrder(objects: readonly OrderedNode[]): Map<string, number> {
  const rows = flattenObjectTree([...objects].sort((a, b) => a.zIndex - b.zIndex));
  return new Map(rows.map((row, index) => [row.object.id, index]));
}

/**
 * Returns the objects sorted bottom-to-top by paint order (see
 * buildPaintOrder). Successor of the old layerOrder/zIndex two-step
 * comparator, which needed per-object denormalized layer fields.
 */
export function sortObjectsByStackOrder<T extends OrderedNode>(objects: readonly T[]): T[] {
  const order = buildPaintOrder(objects);
  return [...objects].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Reassigns zIndex to 0..n-1 within each sibling group (nodes sharing a
 * parent; nodes with a missing parent group at the root), preserving the
 * current relative order. zIndex is only meaningful among siblings — the
 * global stacking comes from the tree traversal — so run this after any
 * structural mutation to keep the values dense and comparable.
 */
export function normalizeSiblingOrder<T extends OrderedNode>(objects: readonly T[]): T[] {
  const ids = new Set(objects.map(obj => obj.id));
  const byParent = new Map<string | undefined, T[]>();
  for (const obj of objects) {
    const key = obj.parentId && ids.has(obj.parentId) ? obj.parentId : undefined;
    byParent.set(key, [...(byParent.get(key) ?? []), obj]);
  }

  const reindexed = new Map<string, number>();
  for (const siblings of byParent.values()) {
    [...siblings]
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((obj, index) => reindexed.set(obj.id, index));
  }

  return objects.map(obj => {
    const zIndex = reindexed.get(obj.id);
    return zIndex === undefined || zIndex === obj.zIndex ? obj : { ...obj, zIndex };
  });
}
