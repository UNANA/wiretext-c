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

export function getLayerDropDepth(
  clientX: number,
  left: number,
  maximumDepth: number,
  baseIndent = 14,
  depthIndent = 14,
): number {
  if (depthIndent <= 0) return 0;
  const depth = Math.round((clientX - left - baseIndent) / depthIndent);
  return Math.max(0, Math.min(maximumDepth, depth));
}

export function getLayerDropEdgePlacement(
  clientY: number,
  top: number,
  height: number,
): Exclude<LayerDropPlacement, 'inside'> {
  if (height <= 0) return 'after';
  return clientY < top + height / 2 ? 'before' : 'after';
}

export interface LayerDropRow {
  id: string;
  depth: number;
}

export interface LayerDropResolution {
  targetId: string;
  placement: LayerDropPlacement;
  // Where the drop indicator is drawn: on the top/bottom edge of `rowId`
  // indented to `depth`, or as a ring around `rowId` for 'inside'.
  indicator: { rowId: string; edge: 'top' | 'bottom' | 'inside'; depth: number };
}

// Resolves a drop over `rows[rowIndex]` (depth-first flattened tree) into
// a concrete target/placement. Deeper than the hovered row nests inside it;
// otherwise the drop lands in the gap above (upper half) or below (lower
// half) the row. A gap can never be shallower than the row that follows it,
// since that row would otherwise have to move with the dropped node.
export function resolveLayerDrop(
  rows: LayerDropRow[],
  rowIndex: number,
  edge: Exclude<LayerDropPlacement, 'inside'>,
  desiredDepth: number,
): LayerDropResolution | null {
  const row = rows[rowIndex];
  if (!row) return null;
  if (desiredDepth > row.depth) {
    return {
      targetId: row.id,
      placement: 'inside',
      indicator: { rowId: row.id, edge: 'inside', depth: row.depth + 1 },
    };
  }
  if (edge === 'before') {
    return {
      targetId: row.id,
      placement: 'before',
      indicator: { rowId: row.id, edge: 'top', depth: row.depth },
    };
  }

  const next = rows[rowIndex + 1];
  const depth = Math.max(next ? next.depth : 0, desiredDepth);
  if (next && depth === next.depth) {
    return {
      targetId: next.id,
      placement: 'before',
      indicator: { rowId: row.id, edge: 'bottom', depth },
    };
  }
  for (let index = rowIndex; index >= 0; index -= 1) {
    if (rows[index].depth === depth) {
      return {
        targetId: rows[index].id,
        placement: 'after',
        indicator: { rowId: row.id, edge: 'bottom', depth },
      };
    }
  }
  return null;
}
