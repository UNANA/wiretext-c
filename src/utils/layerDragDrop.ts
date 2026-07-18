import type { CanvasLayer } from '../types';

export type LayerDropPlacement = 'before' | 'inside' | 'after';
export type LayerPanelDragPayload = { type: 'layer' | 'object'; id: string };

export const LAYER_PANEL_DRAG_TYPE = 'application/x-wiretext-layer-item';

export function setLayerPanelDragPayload(
  dataTransfer: DataTransfer,
  payload: LayerPanelDragPayload,
): void {
  const serialized = JSON.stringify(payload);
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(LAYER_PANEL_DRAG_TYPE, serialized);
  // WebKit requires a commonly supported type before it starts native dragging.
  dataTransfer.setData('text/plain', serialized);
}

export function getLayerPanelDragPayload(dataTransfer: DataTransfer): LayerPanelDragPayload | null {
  const serialized = dataTransfer.getData(LAYER_PANEL_DRAG_TYPE) || dataTransfer.getData('text/plain');
  if (!serialized) return null;
  try {
    const payload = JSON.parse(serialized) as Partial<LayerPanelDragPayload>;
    return (payload.type === 'layer' || payload.type === 'object') && typeof payload.id === 'string'
      ? payload as LayerPanelDragPayload
      : null;
  } catch {
    return null;
  }
}

export function getLayerDropPlacement(
  clientY: number,
  top: number,
  height: number,
): LayerDropPlacement {
  if (height <= 0) return 'inside';
  const position = (clientY - top) / height;
  if (position < 0.25) return 'before';
  if (position > 0.75) return 'after';
  return 'inside';
}

export function reorderLayersByDrop(
  layers: CanvasLayer[],
  dragLayerId: string,
  targetLayerId: string,
  placement: LayerDropPlacement,
  defaultLayerId = 'layer-1',
): CanvasLayer[] | null {
  if (dragLayerId === targetLayerId) return null;

  const ordered = [...layers].sort((a, b) => a.order - b.order);
  const byId = new Map(ordered.map(layer => [layer.id, layer]));
  const dragged = byId.get(dragLayerId);
  const target = byId.get(targetLayerId);
  if (!dragged || !target) return null;

  const parentId = placement === 'inside' ? targetLayerId : target.parentId;
  if (dragLayerId === defaultLayerId && parentId) return null;

  let ancestorId = parentId;
  while (ancestorId) {
    if (ancestorId === dragLayerId) return null;
    ancestorId = byId.get(ancestorId)?.parentId;
  }

  const withoutDragged = ordered.filter(layer => layer.id !== dragLayerId);
  const targetIndex = withoutDragged.findIndex(layer => layer.id === targetLayerId);
  const insertAt = placement === 'before' ? targetIndex : targetIndex + 1;
  withoutDragged.splice(insertAt, 0, { ...dragged, parentId });

  return withoutDragged.map((layer, order) => ({ ...layer, order }));
}

/**
 * Finds the id of the layer immediately preceding `layerId` among its
 * siblings (layers sharing the same parentId), ordered by `order`.
 * Used by the "indent under previous layer" action so it only ever offers
 * an actual sibling as the new parent, rather than whatever happens to sit
 * one row above in a depth-first-flattened list.
 */
export function findPreviousSiblingId(
  layers: Array<Pick<CanvasLayer, 'id' | 'order' | 'parentId'>>,
  layerId: string,
): string | undefined {
  const target = layers.find(layer => layer.id === layerId);
  if (!target) return undefined;

  const siblings = layers
    .filter(layer => layer.parentId === target.parentId)
    .sort((a, b) => a.order - b.order);
  const index = siblings.findIndex(layer => layer.id === layerId);

  return index > 0 ? siblings[index - 1].id : undefined;
}

/**
 * Removes `layerId` from a layer list, re-parenting anything that pointed to
 * it (as parentId) up to that layer's own parent so deleting a layer never
 * orphans its subtree. If `layerId` isn't found, returns `layers` unchanged
 * (aside from array identity).
 */
export function reparentChildrenOnDelete(
  layers: CanvasLayer[],
  layerId: string,
): CanvasLayer[] {
  const target = layers.find(layer => layer.id === layerId);
  const fallbackParentId = target?.parentId;

  return layers
    .filter(layer => layer.id !== layerId)
    .map(layer => (
      layer.parentId === layerId ? { ...layer, parentId: fallbackParentId } : layer
    ));
}

/**
 * Migration helper for legacy save files / share links created before layer
 * hierarchy was persisted as its own array (`WiretextProjectFile.layers`).
 * Those older payloads stashed the parent on each object via a
 * `layerParentId` field that no longer exists on `CanvasObject`. This reads
 * that legacy field (if still present on the raw, loosely-typed data) once
 * at load time so old hierarchies aren't silently dropped, without keeping
 * the field around as an ongoing source of truth.
 */
export function migrateLegacyLayerParentIds<
  T extends { layerId?: string; layerParentId?: string },
>(objects: T[], defaultLayerId: string): Map<string, string | undefined> {
  const parents = new Map<string, string | undefined>();
  for (const obj of objects) {
    const layerId = obj.layerId ?? defaultLayerId;
    if (parents.has(layerId)) continue;
    if (obj.layerParentId) parents.set(layerId, obj.layerParentId);
  }
  return parents;
}
