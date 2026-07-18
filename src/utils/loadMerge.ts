import type { CanvasObject } from '../types';

/**
 * Generates a fresh id that collides with neither `usedIds` nor any id
 * generated earlier in the same remap pass, then reserves it in `usedIds`.
 * `generateId` alone can't guarantee uniqueness against ids that are still
 * about to be assigned, so callers must route every new id through this
 * helper rather than calling `generateId` directly.
 */
function generateUniqueId(usedIds: Set<string>, generateId: () => string): string {
  let candidate = generateId();
  while (usedIds.has(candidate)) {
    candidate = generateId();
  }
  usedIds.add(candidate);
  return candidate;
}

/**
 * Prepares objects loaded from a file for an *additive* (merge) load: any
 * incoming id that collides with an id already present on the canvas is
 * replaced with a fresh id, and every reference to the old id —
 * object.parentId (layer membership and object nesting alike, now that
 * layers are objects in the same id space) and connector
 * startBinding/endBinding.objectId — is rewritten to follow it. Ids that
 * don't collide pass through unchanged, so a merge of disjoint id spaces
 * (the common case) is a no-op remap.
 *
 * Pure and side-effect free: callers own history/undo and are responsible
 * for actually merging the returned objects into canvas state.
 */
export function remapObjectsForAdditiveLoad(
  incomingObjects: readonly CanvasObject[],
  existingIds: ReadonlySet<string>,
  generateId: () => string,
): CanvasObject[] {
  const usedIds = new Set<string>([...existingIds, ...incomingObjects.map(o => o.id)]);
  const idMap = new Map<string, string>();
  for (const obj of incomingObjects) {
    if (existingIds.has(obj.id)) {
      idMap.set(obj.id, generateUniqueId(usedIds, generateId));
    }
  }

  const remapId = (id: string | undefined): string | undefined => {
    if (!id) return id;
    return idMap.get(id) ?? id;
  };

  return incomingObjects.map(obj => ({
    ...obj,
    id: idMap.get(obj.id) ?? obj.id,
    parentId: remapId(obj.parentId),
    startBinding: obj.startBinding
      ? { ...obj.startBinding, objectId: remapId(obj.startBinding.objectId) ?? obj.startBinding.objectId }
      : obj.startBinding,
    endBinding: obj.endBinding
      ? { ...obj.endBinding, objectId: remapId(obj.endBinding.objectId) ?? obj.endBinding.objectId }
      : obj.endBinding,
  }));
}
