import type { CanvasLayer, CanvasObject } from '../types';

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

export interface AdditiveLoadRemap {
  objects: CanvasObject[];
  layers: CanvasLayer[];
}

/**
 * Prepares objects/layers loaded from a file for an *additive* (merge)
 * load: any incoming object or layer id that collides with an id already
 * present on the canvas is replaced with a fresh id, and every reference to
 * the old id — object.parentId, object.layerId, connector
 * startBinding/endBinding.objectId, and layer.parentId — is rewritten to
 * follow it. Ids that don't collide pass through unchanged, so a merge of
 * disjoint id spaces (the common case) is a no-op remap.
 *
 * Pure and side-effect free: callers own history/undo and are responsible
 * for actually merging the returned objects/layers into canvas state.
 */
export function remapObjectsAndLayersForAdditiveLoad(
  incomingObjects: readonly CanvasObject[],
  incomingLayers: readonly CanvasLayer[],
  existingObjectIds: ReadonlySet<string>,
  existingLayerIds: ReadonlySet<string>,
  generateId: () => string,
): AdditiveLoadRemap {
  const usedLayerIds = new Set<string>([...existingLayerIds, ...incomingLayers.map(l => l.id)]);
  const layerIdMap = new Map<string, string>();
  for (const layer of incomingLayers) {
    if (existingLayerIds.has(layer.id)) {
      layerIdMap.set(layer.id, generateUniqueId(usedLayerIds, generateId));
    }
  }

  const usedObjectIds = new Set<string>([...existingObjectIds, ...incomingObjects.map(o => o.id)]);
  const objectIdMap = new Map<string, string>();
  for (const obj of incomingObjects) {
    if (existingObjectIds.has(obj.id)) {
      objectIdMap.set(obj.id, generateUniqueId(usedObjectIds, generateId));
    }
  }

  const remapObjectId = (id: string | undefined): string | undefined => {
    if (!id) return id;
    return objectIdMap.get(id) ?? id;
  };
  const remapLayerId = (id: string | undefined): string | undefined => {
    if (!id) return id;
    return layerIdMap.get(id) ?? id;
  };

  const layers = incomingLayers.map(layer => ({
    ...layer,
    id: layerIdMap.get(layer.id) ?? layer.id,
    parentId: remapLayerId(layer.parentId),
  }));

  const objects = incomingObjects.map(obj => ({
    ...obj,
    id: objectIdMap.get(obj.id) ?? obj.id,
    parentId: remapObjectId(obj.parentId),
    layerId: remapLayerId(obj.layerId),
    startBinding: obj.startBinding
      ? { ...obj.startBinding, objectId: remapObjectId(obj.startBinding.objectId) ?? obj.startBinding.objectId }
      : obj.startBinding,
    endBinding: obj.endBinding
      ? { ...obj.endBinding, objectId: remapObjectId(obj.endBinding.objectId) ?? obj.endBinding.objectId }
      : obj.endBinding,
  }));

  return { objects, layers };
}
