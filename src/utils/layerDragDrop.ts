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
