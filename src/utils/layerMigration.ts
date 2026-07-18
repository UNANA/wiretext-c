import type { CanvasObject } from '../types';
import { sanitizeObjectParents } from './objectHierarchy';

export const DEFAULT_LAYER_ID = 'layer-1';
export const DEFAULT_LAYER_NAME = 'Layer 1';

/**
 * v1 serialization shape: before the unified tree, layers were separate
 * entities persisted next to `objects` in project files and share URLs.
 * Only read at load time as migration input — never written anymore.
 */
export interface CanvasLayer {
  id: string;
  name: string;
  order: number;
  objectCount: number;
  parentId?: string;
}

export function isLayerObject(obj: Pick<CanvasObject, 'type'>): boolean {
  return obj.type === 'layer';
}

/**
 * Builds a non-graphic layer node. Position/size are fixed at zero — layer
 * objects never render on the canvas; they only exist as tree nodes whose
 * `label` is the layer name and whose `zIndex` orders them among siblings.
 */
export function createLayerObject(
  id: string,
  label: string,
  options?: { parentId?: string; zIndex?: number },
): CanvasObject {
  return {
    id,
    type: 'layer',
    position: { col: 0, row: 0 },
    width: 0,
    height: 0,
    zIndex: options?.zIndex ?? 0,
    parentId: options?.parentId,
    label,
  };
}

/**
 * Nearest ancestor of type 'layer' for `objectId` (the id itself when it
 * already names a layer node). Returns undefined when the parent chain never
 * reaches a layer — callers decide their own fallback (usually
 * DEFAULT_LAYER_ID). Cycle-safe.
 */
export function findLayerAncestorId(
  objects: ReadonlyArray<Pick<CanvasObject, 'id' | 'type' | 'parentId'>>,
  objectId: string,
): string | undefined {
  const byId = new Map(objects.map(obj => [obj.id, obj]));
  const seen = new Set<string>();
  let current = byId.get(objectId);
  while (current) {
    if (isLayerObject(current)) return current.id;
    if (seen.has(current.id)) return undefined;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return undefined;
}

// Loose input shape for payloads that may predate the unified tree: objects
// may still carry the removed layerId/layerName/layerOrder fields, plus the
// even older layerParentId (pre-`WiretextProjectFile.layers` builds).
type RawObject = CanvasObject & {
  layerId?: string;
  layerName?: string;
  layerOrder?: number;
  layerParentId?: string;
};

function stripLegacyFields(obj: RawObject): CanvasObject {
  const { layerId: _layerId, layerName: _layerName, layerOrder: _layerOrder, layerParentId: _layerParentId, ...rest } = obj;
  return rest;
}

/**
 * Converts any supported payload shape into the unified single-tree model
 * where layers are `type: 'layer'` objects and membership is expressed via
 * parentId. Accepts:
 *  - unified (v2) payloads: objects already contain layer nodes — passed
 *    through with only sanitation/constraint repair (idempotent);
 *  - v1 payloads: `savedLayers` (from `WiretextProjectFile.layers` or share
 *    URLs) plus objects carrying layerId references;
 *  - legacy payloads: bare object arrays, optionally with per-object
 *    layerParentId for layer nesting.
 *
 * Guarantees on the result:
 *  - legacy objects keep their old layer membership;
 *  - parentId references are valid and acyclic (sanitizeObjectParents);
 *  - deprecated layerId/layerName/layerOrder fields are stripped.
 */
export function migrateToUnifiedTree(
  rawObjects: readonly RawObject[],
  savedLayers?: readonly CanvasLayer[],
): CanvasObject[] {
  const alreadyUnified = rawObjects.some(isLayerObject);

  const merged = alreadyUnified
    ? rawObjects.map(stripLegacyFields)
    : convertV1ToUnified(rawObjects, savedLayers);

  return repairConstraints(merged);
}

function convertV1ToUnified(
  rawObjects: readonly RawObject[],
  savedLayers?: readonly CanvasLayer[],
): CanvasObject[] {
  // 1. Assemble layer nodes: persisted layers first, then any layer id still
  //    referenced by an object but missing from the persisted list.
  const layerNodes = new Map<string, CanvasObject>();
  for (const layer of savedLayers ?? []) {
    layerNodes.set(layer.id, createLayerObject(layer.id, layer.name || DEFAULT_LAYER_NAME, {
      parentId: layer.parentId,
      zIndex: layer.order,
    }));
  }

  // Pre-`layers` payloads stashed layer nesting on each object as
  // layerParentId; honor it only when no persisted layer list exists
  // (mirrors the old resolveIncomingLayers fallback).
  const legacyParents = new Map<string, string>();
  if (!savedLayers || savedLayers.length === 0) {
    for (const obj of rawObjects) {
      const layerId = obj.layerId ?? DEFAULT_LAYER_ID;
      if (obj.layerParentId && !legacyParents.has(layerId)) {
        legacyParents.set(layerId, obj.layerParentId);
      }
    }
  }

  for (const obj of rawObjects) {
    const layerId = obj.layerId ?? DEFAULT_LAYER_ID;
    if (layerNodes.has(layerId)) continue;
    layerNodes.set(layerId, createLayerObject(layerId, obj.layerName || DEFAULT_LAYER_NAME, {
      parentId: legacyParents.get(layerId),
      zIndex: obj.layerOrder ?? 0,
    }));
  }

  if (!layerNodes.has(DEFAULT_LAYER_ID)) {
    layerNodes.set(DEFAULT_LAYER_ID, createLayerObject(DEFAULT_LAYER_ID, DEFAULT_LAYER_NAME));
  }

  // 2. Attach objects: an existing object parent wins (its layer follows
  //    from the ancestor chain); otherwise the old layerId becomes the
  //    parent directly.
  const objects = rawObjects.map(obj => ({
    ...stripLegacyFields(obj),
    parentId: obj.parentId ?? obj.layerId ?? DEFAULT_LAYER_ID,
  }));

  // 3. Canonicalize sibling order per parent: non-layer objects first (their
  //    old intra-layer zIndex), then sub-layers (their old global order).
  //    This reproduces the old paint order, where a nested layer's contents
  //    drew at the nested layer's own slot, above its parent layer's
  //    directly-owned objects.
  const combined = [...layerNodes.values(), ...objects];
  const byParent = new Map<string | undefined, CanvasObject[]>();
  for (const node of combined) {
    const key = node.parentId && combined.some(other => other.id === node.parentId)
      ? node.parentId
      : undefined;
    byParent.set(key, [...(byParent.get(key) ?? []), node]);
  }

  const reindexed = new Map<string, number>();
  for (const siblings of byParent.values()) {
    siblings
      .sort((a, b) => {
        if (isLayerObject(a) !== isLayerObject(b)) return isLayerObject(a) ? 1 : -1;
        return a.zIndex - b.zIndex;
      })
      .forEach((node, index) => reindexed.set(node.id, index));
  }

  return combined.map(node => ({ ...node, zIndex: reindexed.get(node.id) ?? node.zIndex }));
}

function repairConstraints(nodes: CanvasObject[]): CanvasObject[] {
  // Layers and graphic objects share one unrestricted tree. Only dangling
  // references and cycles need repair; root graphic objects are valid.
  return sanitizeObjectParents(nodes);
}
