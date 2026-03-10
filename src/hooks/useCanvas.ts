import { useState, useCallback, useMemo, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  renderObjectsToGrid,
  createDefaultObject,
  compareObjectsByStackOrder,
  hitTest,
  getResizeHandle,
  getLineLength,
  gridToString,
  isResizable,
  getBoundingBox,
  calculateGridSize,
  generateId,
} from '../utils/boxDrawing';
import type { Grid, Tool, Position, CanvasObject, ComponentType, DragState, ResizeHandle, GridSize, CanvasLayer, AlignmentGuide } from '../types';

export const TOOLS = {
  SELECT: 'select' as Tool,
  BOX: 'box' as Tool,
  TEXT: 'text' as Tool,
  LINE: 'line' as Tool,
  ARROW: 'arrow' as Tool,
  CONNECTOR: 'connector' as Tool,
};

export type ExportFormat = 'text' | 'markdown' | 'html' | 'github';

export interface MarqueeState {
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

export interface UseCanvasReturn {
  // State
  objects: CanvasObject[];
  grid: Grid;
  gridSize: GridSize;
  tool: Tool;
  setTool: (tool: Tool) => void;
  selectedIds: Set<string>;
  pendingComponent: ComponentType | null;
  setPendingComponent: (type: ComponentType | null) => void;
  dragState: DragState;
  zoom: number;
  setZoom: (zoom: number) => void;
  panX: number;
  panY: number;
  editingObjectId: string | null;
  setEditingObjectId: (id: string | null) => void;
  marquee: MarqueeState | null;
  layers: CanvasLayer[];
  alignmentGuides: AlignmentGuide[];

  // Actions
  addObject: (obj: Omit<CanvasObject, 'id' | 'zIndex'>) => CanvasObject;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  deleteSelection: () => void;
  moveObject: (id: string, dCol: number, dRow: number) => void;
  moveSelection: (dCol: number, dRow: number) => void;
  resizeObject: (id: string, width: number, height: number) => void;
  clearAll: () => void;
  selectObject: (id: string, addToSelection?: boolean) => void;
  clearSelection: () => void;
  handleCellMouseDown: (col: number, row: number, handle?: ResizeHandle | null) => void;
  handleCellMouseMove: (col: number, row: number) => void;
  handleCellMouseUp: () => void;
  handleKeyDown: (key: string) => void;
  panViewport: (dx: number, dy: number) => void;
  zoomViewport: (delta: number, centerX: number, centerY: number) => void;
  exportToText: (format?: ExportFormat) => string;
  ensureSpace: (col: number, row: number) => void;
  loadObjects: (objs: CanvasObject[]) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Copy/Paste/Duplicate
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  duplicateSelection: () => void;
  selectAll: () => void;
  createLayerFromSelection: () => void;
  moveSelectionToLayer: (layerId: string) => void;
  moveObjectToLayer: (objectId: string, layerId: string) => void;
  reorderObjectByDrop: (dragObjectId: string, targetObjectId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  reorderLayer: (dragLayerId: string, targetLayerId: string) => void;
  arrangeSelectionLayer: (mode: 'toFront' | 'forward' | 'backward' | 'toBack') => void;

  // Getters
  selectedObjects: CanvasObject[];
  objectsCount: number;
  cursor: Position;
}

// Initial grid size - matches Next.js (120x60)
const INITIAL_COLS = 120;
const INITIAL_ROWS = 60;
const EXPAND_MARGIN = 20;
const MAX_HISTORY = 100;
const DEFAULT_LAYER_ID = 'layer-1';
const DEFAULT_LAYER_NAME = 'Layer 1';

function ensureLayerFields(obj: CanvasObject): CanvasObject {
  return {
    ...obj,
    layerId: obj.layerId ?? DEFAULT_LAYER_ID,
    layerName: obj.layerName ?? DEFAULT_LAYER_NAME,
    layerOrder: obj.layerOrder ?? 0,
  };
}

function normalizeStackOrder(list: CanvasObject[], preferredLayerOrder: Map<string, number> = new Map()): CanvasObject[] {
  const withLayers = list.map(ensureLayerFields);
  const grouped = new Map<string, CanvasObject[]>();
  for (const obj of withLayers) {
    const key = obj.layerId ?? DEFAULT_LAYER_ID;
    const layer = grouped.get(key) ?? [];
    layer.push(obj);
    grouped.set(key, layer);
  }

  const sortedLayers = [...grouped.values()]
    .sort((a, b) => {
      const aId = a[0]?.layerId ?? DEFAULT_LAYER_ID;
      const bId = b[0]?.layerId ?? DEFAULT_LAYER_ID;
      const aOrder = preferredLayerOrder.get(aId) ?? (a[0]?.layerOrder ?? 0);
      const bOrder = preferredLayerOrder.get(bId) ?? (b[0]?.layerOrder ?? 0);
      return aOrder - bOrder;
    });

  const normalized: CanvasObject[] = [];
  sortedLayers.forEach((layer) => {
    const layerId = layer[0]?.layerId ?? DEFAULT_LAYER_ID;
    const layerOrder = preferredLayerOrder.get(layerId) ?? (layer[0]?.layerOrder ?? 0);
    layer
      .sort((a, b) => a.zIndex - b.zIndex)
      .forEach((obj, zIndex) => {
        normalized.push({
          ...obj,
          layerOrder,
          zIndex,
        });
      });
  });

  return normalized;
}

function buildLayers(list: CanvasObject[]): CanvasLayer[] {
  const grouped = new Map<string, CanvasObject[]>();
  for (const obj of list.map(ensureLayerFields)) {
    const key = obj.layerId ?? DEFAULT_LAYER_ID;
    const layer = grouped.get(key) ?? [];
    layer.push(obj);
    grouped.set(key, layer);
  }

  const fromObjects = [...grouped.entries()]
    .map(([id, objectsInLayer]) => ({
      id,
      name: objectsInLayer[0]?.layerName || DEFAULT_LAYER_NAME,
      order: objectsInLayer[0]?.layerOrder ?? 0,
      objectCount: objectsInLayer.length,
    }))
    .sort((a, b) => a.order - b.order);

  if (fromObjects.length === 0) {
    return [{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME, order: 0, objectCount: 0 }];
  }
  return fromObjects;
}

export function useCanvas(options?: { smartGuidesEnabled?: boolean }): UseCanvasReturn {
  const smartGuidesEnabled = options?.smartGuidesEnabled ?? true;
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [layersState, setLayersState] = useState<CanvasLayer[]>([
    { id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME, order: 0, objectCount: 0 },
  ]);
  const [gridSize, setGridSize] = useState<GridSize>({ cols: INITIAL_COLS, rows: INITIAL_ROWS });
  const [tool, setTool] = useState<Tool>(TOOLS.SELECT);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingComponent, setPendingComponent] = useState<ComponentType | null>(null);
  const [dragState, setDragState] = useState<DragState>({ type: 'none' });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [cursor, setCursor] = useState<Position>({ col: 0, row: 0 });
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [connectorStartAnchor, setConnectorStartAnchor] = useState<{
    objectId: string;
    handle: ResizeHandle;
    position: Position;
  } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  useEffect(() => {
    if (!smartGuidesEnabled) {
      setAlignmentGuides([]);
    }
  }, [smartGuidesEnabled]);

  // Undo/Redo history
  const [past, setPast] = useState<CanvasObject[][]>([]);
  const [future, setFuture] = useState<CanvasObject[][]>([]);

  // Clipboard
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);

  const clamp = useCallback((value: number, min: number, max: number) => {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }, []);

  const clampDeltaForObjects = useCallback((movingObjects: CanvasObject[], dCol: number, dRow: number) => {
    if (movingObjects.length === 0) return { dCol: 0, dRow: 0 };

    let minCol = Number.POSITIVE_INFINITY;
    let minRow = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;

    for (const obj of movingObjects) {
      const bbox = getBoundingBox(obj);
      minCol = Math.min(minCol, bbox.col);
      minRow = Math.min(minRow, bbox.row);
      maxCol = Math.max(maxCol, bbox.col + bbox.width - 1);
      maxRow = Math.max(maxRow, bbox.row + bbox.height - 1);
    }

    const minDeltaCol = -minCol;
    const minDeltaRow = -minRow;
    const maxDeltaCol = (gridSize.cols - 1) - maxCol;
    const maxDeltaRow = (gridSize.rows - 1) - maxRow;

    return {
      dCol: clamp(dCol, minDeltaCol, maxDeltaCol),
      dRow: clamp(dRow, minDeltaRow, maxDeltaRow),
    };
  }, [clamp, gridSize.cols, gridSize.rows]);

  const getBoundsForObjects = useCallback((list: CanvasObject[]) => {
    let minCol = Number.POSITIVE_INFINITY;
    let minRow = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;

    for (const obj of list) {
      const bbox = getBoundingBox(obj);
      minCol = Math.min(minCol, bbox.col);
      minRow = Math.min(minRow, bbox.row);
      maxCol = Math.max(maxCol, bbox.col + bbox.width - 1);
      maxRow = Math.max(maxRow, bbox.row + bbox.height - 1);
    }

    if (!Number.isFinite(minCol) || !Number.isFinite(minRow) || !Number.isFinite(maxCol) || !Number.isFinite(maxRow)) {
      return null;
    }

    return {
      left: minCol,
      right: maxCol,
      top: minRow,
      bottom: maxRow,
      centerX: Math.round((minCol + maxCol) / 2),
      centerY: Math.round((minRow + maxRow) / 2),
    };
  }, []);

  const computeSmartGuidesForBounds = useCallback((
    movingBounds: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number },
    staticObjects: CanvasObject[],
    snapThreshold: number = 1
  ) => {
    const MAX_GUIDES_TOTAL = 3;
    type CandidateGuide = AlignmentGuide & { diff: number };
    let bestXDiff = Number.POSITIVE_INFINITY;
    let bestYDiff = Number.POSITIVE_INFINITY;
    let snapDx = 0;
    let snapDy = 0;
    const verticalCandidates: CandidateGuide[] = [];
    const horizontalCandidates: CandidateGuide[] = [];

    for (const staticObj of staticObjects) {
      const bbox = getBoundingBox(staticObj);
      const staticLeft = bbox.col;
      const staticTop = bbox.row;
      const staticRight = bbox.col + bbox.width - 1;
      const staticBottom = bbox.row + bbox.height - 1;
      const staticCenterX = Math.round((staticLeft + staticRight) / 2);
      const staticCenterY = Math.round((staticTop + staticBottom) / 2);

      const movingXCandidates = [movingBounds.left, movingBounds.centerX, movingBounds.right];
      const staticXCandidates = [staticLeft, staticCenterX, staticRight];
      for (const movingX of movingXCandidates) {
        for (const staticX of staticXCandidates) {
          const diff = staticX - movingX;
          const absDiff = Math.abs(diff);
          if (absDiff <= snapThreshold && absDiff < bestXDiff) {
            bestXDiff = absDiff;
            snapDx = diff;
          }
          if (absDiff <= snapThreshold) {
            verticalCandidates.push({
              orientation: 'vertical',
              at: staticX,
              start: Math.min(movingBounds.top, staticTop),
              end: Math.max(movingBounds.bottom, staticBottom),
              diff: absDiff,
            });
          }
        }
      }

      const movingYCandidates = [movingBounds.top, movingBounds.centerY, movingBounds.bottom];
      const staticYCandidates = [staticTop, staticCenterY, staticBottom];
      for (const movingY of movingYCandidates) {
        for (const staticY of staticYCandidates) {
          const diff = staticY - movingY;
          const absDiff = Math.abs(diff);
          if (absDiff <= snapThreshold && absDiff < bestYDiff) {
            bestYDiff = absDiff;
            snapDy = diff;
          }
          if (absDiff <= snapThreshold) {
            horizontalCandidates.push({
              orientation: 'horizontal',
              at: staticY,
              start: Math.min(movingBounds.left, staticLeft),
              end: Math.max(movingBounds.right, staticRight),
              diff: absDiff,
            });
          }
        }
      }
    }

    const dedupeAndSelect = (
      guides: CandidateGuide[],
      orientation: 'vertical' | 'horizontal',
      maxCount: number
    ): CandidateGuide[] => {
      const byAt = new Map<number, CandidateGuide>();
      for (const guide of guides) {
        const existing = byAt.get(guide.at);
        if (!existing) {
          byAt.set(guide.at, guide);
          continue;
        }
        const existingSpan = existing.end - existing.start;
        const currentSpan = guide.end - guide.start;
        if (guide.diff < existing.diff || (guide.diff === existing.diff && currentSpan > existingSpan)) {
          byAt.set(guide.at, {
            ...guide,
            start: Math.min(guide.start, existing.start),
            end: Math.max(guide.end, existing.end),
          });
        } else {
          byAt.set(guide.at, {
            ...existing,
            start: Math.min(guide.start, existing.start),
            end: Math.max(guide.end, existing.end),
          });
        }
      }

      return [...byAt.values()]
        .sort((a, b) => a.diff - b.diff || (b.end - b.start) - (a.end - a.start))
        .slice(0, maxCount)
        .map((guide) => ({ ...guide, orientation }));
    };

    const verticalGuides = dedupeAndSelect(verticalCandidates, 'vertical', MAX_GUIDES_TOTAL);
    const horizontalGuides = dedupeAndSelect(horizontalCandidates, 'horizontal', MAX_GUIDES_TOTAL);
    const guides = [...verticalGuides, ...horizontalGuides]
      .sort((a, b) => a.diff - b.diff || (b.end - b.start) - (a.end - a.start))
      .slice(0, MAX_GUIDES_TOTAL)
      .map(({ diff: _diff, ...guide }) => guide);

    return {
      snapDx,
      snapDy,
      guides,
    };
  }, []);

  // Push current state to history before mutation
  const pushHistory = useCallback(() => {
    setObjects(current => {
      setPast(prev => [...prev.slice(-(MAX_HISTORY - 1)), current]);
      setFuture([]);
      return current;
    });
  }, []);

  // Keep a fixed preset canvas size (no infinite auto-expansion).
  const ensureSpace = useCallback((_col: number, _row: number) => {
    // Intentionally no-op.
  }, []);

  // Render grid from objects
  const grid = useMemo(() => {
    return renderObjectsToGrid(objects, gridSize);
  }, [objects, gridSize]);

  const selectedObjects = useMemo(() => {
    return objects
      .filter(obj => selectedIds.has(obj.id))
      .sort(compareObjectsByStackOrder);
  }, [objects, selectedIds]);

  const layers = useMemo(() => {
    const objectLayers = buildLayers(objects);
    const stateById = new Map(layersState.map(layer => [layer.id, layer]));
    const objectById = new Map(objectLayers.map(layer => [layer.id, layer]));
    const mergedIds = new Set<string>([
      ...layersState.map(layer => layer.id),
      ...objectLayers.map(layer => layer.id),
    ]);

    const merged = [...mergedIds].map((id, idx) => {
      const fromState = stateById.get(id);
      const fromObjects = objectById.get(id);
      return {
        id,
        name: fromState?.name ?? fromObjects?.name ?? `Layer ${idx + 1}`,
        order: fromState?.order ?? fromObjects?.order ?? idx,
        objectCount: fromObjects?.objectCount ?? 0,
      };
    });

    return merged
      .sort((a, b) => a.order - b.order)
      .map((layer, order) => ({ ...layer, order }));
  }, [layersState, objects]);

  const getAnchorPosition = useCallback((obj: CanvasObject, handle: ResizeHandle): Position => {
    const bbox = getBoundingBox(obj);
    switch (handle) {
      case 'nw': return { col: bbox.col, row: bbox.row };
      case 'n': return { col: bbox.col + Math.floor(bbox.width / 2), row: bbox.row };
      case 'ne': return { col: bbox.col + bbox.width - 1, row: bbox.row };
      case 'e': return { col: bbox.col + bbox.width - 1, row: bbox.row + Math.floor(bbox.height / 2) };
      case 'se': return { col: bbox.col + bbox.width - 1, row: bbox.row + bbox.height - 1 };
      case 's': return { col: bbox.col + Math.floor(bbox.width / 2), row: bbox.row + bbox.height - 1 };
      case 'sw': return { col: bbox.col, row: bbox.row + bbox.height - 1 };
      case 'w': return { col: bbox.col, row: bbox.row + Math.floor(bbox.height / 2) };
    }
  }, []);

  const getConnectorAnchor = useCallback((col: number, row: number): {
    objectId: string;
    handle: ResizeHandle;
    position: Position;
  } | null => {
    const hit = hitTest(objects, col, row);
    if (!hit || hit.type === 'line' || hit.type === 'arrow') {
      return null;
    }

    const anchors: { handle: ResizeHandle; position: Position }[] = [
      { handle: 'nw', position: getAnchorPosition(hit, 'nw') },
      { handle: 'n', position: getAnchorPosition(hit, 'n') },
      { handle: 'ne', position: getAnchorPosition(hit, 'ne') },
      { handle: 'e', position: getAnchorPosition(hit, 'e') },
      { handle: 'se', position: getAnchorPosition(hit, 'se') },
      { handle: 's', position: getAnchorPosition(hit, 's') },
      { handle: 'sw', position: getAnchorPosition(hit, 'sw') },
      { handle: 'w', position: getAnchorPosition(hit, 'w') },
    ];

    let closest = anchors[0];
    let minDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const dx = anchor.position.col - col;
      const dy = anchor.position.row - row;
      const distance = dx * dx + dy * dy;
      if (distance < minDistance) {
        minDistance = distance;
        closest = anchor;
      }
    }

    return {
      objectId: hit.id,
      handle: closest.handle,
      position: closest.position,
    };
  }, [objects, getAnchorPosition]);

  const getConnectorAnchorForEdit = useCallback((col: number, row: number, editingConnectorId: string): {
    objectId: string;
    handle: ResizeHandle;
    position: Position;
  } | null => {
    const hit = hitTest(objects.filter(obj => obj.id !== editingConnectorId), col, row);
    if (!hit || hit.type === 'line' || hit.type === 'arrow') {
      return null;
    }

    const anchors: { handle: ResizeHandle; position: Position }[] = [
      { handle: 'nw', position: getAnchorPosition(hit, 'nw') },
      { handle: 'n', position: getAnchorPosition(hit, 'n') },
      { handle: 'ne', position: getAnchorPosition(hit, 'ne') },
      { handle: 'e', position: getAnchorPosition(hit, 'e') },
      { handle: 'se', position: getAnchorPosition(hit, 'se') },
      { handle: 's', position: getAnchorPosition(hit, 's') },
      { handle: 'sw', position: getAnchorPosition(hit, 'sw') },
      { handle: 'w', position: getAnchorPosition(hit, 'w') },
    ];

    let closest = anchors[0];
    let minDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const dx = anchor.position.col - col;
      const dy = anchor.position.row - row;
      const distance = dx * dx + dy * dy;
      if (distance < minDistance) {
        minDistance = distance;
        closest = anchor;
      }
    }

    return {
      objectId: hit.id,
      handle: closest.handle,
      position: closest.position,
    };
  }, [objects, getAnchorPosition]);

  const pointKey = useCallback((col: number, row: number) => `${col},${row}`, []);

  const routeConnectorPath = useCallback((
    start: Position,
    end: Position,
    list: CanvasObject[],
    startHandle?: ResizeHandle,
    endHandle?: ResizeHandle
  ): Position[] => {
    if (start.col === end.col && start.row === end.row) return [start, end];

    const nonConnectorObjects = list.filter(obj => obj.type === 'box' || obj.type === 'component' || obj.type === 'text');
    const obstacleCells = new Set<string>();

    // Keep a one-cell clearance around objects so connectors don't visually overlap.
    for (const obj of nonConnectorObjects) {
      const bbox = getBoundingBox(obj);
      const minCol = Math.max(0, bbox.col - 1);
      const minRow = Math.max(0, bbox.row - 1);
      const maxCol = bbox.col + bbox.width;
      const maxRow = bbox.row + bbox.height;
      for (let c = minCol; c <= maxCol; c++) {
        for (let r = minRow; r <= maxRow; r++) {
          obstacleCells.add(pointKey(c, r));
        }
      }
    }

    const getHandleDirection = (handle?: ResizeHandle): { dc: number; dr: number } => {
      if (handle === 'n') return { dc: 0, dr: -1 };
      if (handle === 's') return { dc: 0, dr: 1 };
      if (handle === 'e' || handle === 'ne' || handle === 'se') return { dc: 1, dr: 0 };
      if (handle === 'w' || handle === 'nw' || handle === 'sw') return { dc: -1, dr: 0 };

      // Fallback if no handle is available.
      if (Math.abs(end.col - start.col) >= Math.abs(end.row - start.row)) {
        return { dc: end.col >= start.col ? 1 : -1, dr: 0 };
      }
      return { dc: 0, dr: end.row >= start.row ? 1 : -1 };
    };

    const stubLen = 2;
    const startDir = getHandleDirection(startHandle);
    const endDir = getHandleDirection(endHandle);
    const startStub: Position = {
      col: start.col + startDir.dc * stubLen,
      row: start.row + startDir.dr * stubLen,
    };
    const endStub: Position = {
      col: end.col + endDir.dc * stubLen,
      row: end.row + endDir.dr * stubLen,
    };

    obstacleCells.delete(pointKey(start.col, start.row));
    obstacleCells.delete(pointKey(end.col, end.row));
    obstacleCells.delete(pointKey(startStub.col, startStub.row));
    obstacleCells.delete(pointKey(endStub.col, endStub.row));

    const extraPad = 25;
    const minCol = Math.max(0, Math.min(start.col, end.col, startStub.col, endStub.col) - extraPad);
    const minRow = Math.max(0, Math.min(start.row, end.row, startStub.row, endStub.row) - extraPad);
    const maxCol = Math.max(start.col, end.col, startStub.col, endStub.col) + extraPad;
    const maxRow = Math.max(start.row, end.row, startStub.row, endStub.row) + extraPad;

    const queue: Position[] = [startStub];
    const visited = new Set<string>([pointKey(startStub.col, startStub.row)]);
    const parent = new Map<string, string>();
    const dirs = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 },
    ];

    let found = false;
    while (queue.length > 0 && !found) {
      const current = queue.shift()!;
      for (const dir of dirs) {
        const nextCol = current.col + dir.dc;
        const nextRow = current.row + dir.dr;
        if (nextCol < minCol || nextCol > maxCol || nextRow < minRow || nextRow > maxRow) continue;
        const nextKey = pointKey(nextCol, nextRow);
        if (visited.has(nextKey)) continue;
        if (obstacleCells.has(nextKey)) continue;
        visited.add(nextKey);
        parent.set(nextKey, pointKey(current.col, current.row));
        if (nextCol === endStub.col && nextRow === endStub.row) {
          found = true;
          break;
        }
        queue.push({ col: nextCol, row: nextRow });
      }
    }

    if (!found) {
      // Fallback to simple elbow/straight route.
      const simple: Position[] = [start, startStub];
      if (startStub.col === endStub.col || startStub.row === endStub.row) {
        simple.push(endStub, end);
      } else {
        simple.push({ col: endStub.col, row: startStub.row }, endStub, end);
      }
      return simple;
    }

    const fullPath: Position[] = [];
    let cursorKey = pointKey(endStub.col, endStub.row);
    fullPath.push(endStub);
    while (cursorKey !== pointKey(startStub.col, startStub.row)) {
      const prevKey = parent.get(cursorKey);
      if (!prevKey) break;
      const [prevColStr, prevRowStr] = prevKey.split(',');
      fullPath.push({ col: parseInt(prevColStr, 10), row: parseInt(prevRowStr, 10) });
      cursorKey = prevKey;
    }
    fullPath.reverse();

    // Compress full path to turn-points only.
    const turns: Position[] = [fullPath[0]];
    for (let i = 1; i < fullPath.length - 1; i++) {
      const prev = fullPath[i - 1];
      const current = fullPath[i];
      const next = fullPath[i + 1];
      const prevDirCol = current.col - prev.col;
      const prevDirRow = current.row - prev.row;
      const nextDirCol = next.col - current.col;
      const nextDirRow = next.row - current.row;
      if (prevDirCol !== nextDirCol || prevDirRow !== nextDirRow) {
        turns.push(current);
      }
    }
    turns.push(fullPath[fullPath.length - 1]);

    const withStubs = [start, startStub, ...turns.slice(1, -1), endStub, end];

    // Remove consecutive duplicates and collinear noise.
    const normalized: Position[] = [];
    for (const point of withStubs) {
      const last = normalized[normalized.length - 1];
      if (last && last.col === point.col && last.row === point.row) continue;
      normalized.push(point);
    }
    const compact: Position[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const prev = compact[compact.length - 1];
      const curr = normalized[i];
      const next = normalized[i + 1];
      if (prev && next) {
        const sameCol = prev.col === curr.col && curr.col === next.col;
        const sameRow = prev.row === curr.row && curr.row === next.row;
        if (sameCol || sameRow) continue;
      }
      compact.push(curr);
    }

    return compact;
  }, [pointKey]);

  const syncConnectorLines = useCallback((list: CanvasObject[]): CanvasObject[] => {
    const byId = new Map(list.map(obj => [obj.id, obj]));
    return list.map(obj => {
      if (obj.type !== 'line' || !obj.isConnector) return obj;
      if (!obj.endPosition) return obj;

      const startObj = obj.startBinding ? byId.get(obj.startBinding.objectId) : null;
      const endObj = obj.endBinding ? byId.get(obj.endBinding.objectId) : null;

      const startPos = (startObj && obj.startBinding) ? getAnchorPosition(startObj, obj.startBinding.handle) : obj.position;
      const endPos = (endObj && obj.endBinding) ? getAnchorPosition(endObj, obj.endBinding.handle) : obj.endPosition;
      const connectorPath = routeConnectorPath(
        startPos,
        endPos,
        list,
        obj.startBinding?.handle,
        obj.endBinding?.handle
      );

      return {
        ...obj,
        position: startPos,
        endPosition: endPos,
        connectorPath,
        width: Math.abs(endPos.col - startPos.col) + 1,
        height: Math.abs(endPos.row - startPos.row) + 1,
        rotation: undefined,
      };
    });
  }, [getAnchorPosition, routeConnectorPath]);

  const objectsCount = objects.length;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const addObject = useCallback((obj: Omit<CanvasObject, 'id' | 'zIndex'>): CanvasObject => {
    const maxCol = obj.position.col + obj.width;
    const maxRow = obj.position.row + obj.height;
    ensureSpace(maxCol, maxRow);

    const newObj: CanvasObject = {
      ...obj,
      id: generateId(),
      zIndex: objects.length,
      layerId: DEFAULT_LAYER_ID,
      layerName: DEFAULT_LAYER_NAME,
      layerOrder: 0,
    };
    pushHistory();
    setObjects(prev => normalizeStackOrder([...prev, newObj]));
    return newObj;
  }, [objects.length, ensureSpace, pushHistory]);

  const updateObject = useCallback((id: string, updates: Partial<CanvasObject>) => {
    setObjects(prev => {
      const obj = prev.find(o => o.id === id);
      if (!obj) return prev;

      let nextUpdates = updates;

      // Auto-calculate width/height for text objects based on content
      if (obj.type === 'text' && updates.content !== undefined) {
        const lines = updates.content.split('\n');
        nextUpdates = {
          ...updates,
          width: Math.max(...lines.map(l => l.length), 1),
          height: lines.length || 1
        };
      }

      // Check if we need to expand grid for new position/size
      if (nextUpdates.position || nextUpdates.width || nextUpdates.height) {
        const newWidth = nextUpdates.width ?? obj.width;
        const newHeight = nextUpdates.height ?? obj.height;
        const requestedCol = nextUpdates.position?.col ?? obj.position.col;
        const requestedRow = nextUpdates.position?.row ?? obj.position.row;
        const maxCol = Math.max(0, gridSize.cols - newWidth);
        const maxRow = Math.max(0, gridSize.rows - newHeight);
        const newCol = clamp(requestedCol, 0, maxCol);
        const newRow = clamp(requestedRow, 0, maxRow);

        nextUpdates = {
          ...nextUpdates,
          position: { col: newCol, row: newRow },
        };

        ensureSpace(newCol + newWidth, newRow + newHeight);
      }

      const updated = prev.map(o => o.id === id ? { ...o, ...nextUpdates } : o);
      return normalizeStackOrder(syncConnectorLines(updated));
    });
  }, [clamp, ensureSpace, gridSize.cols, gridSize.rows, syncConnectorLines]);

  const deleteObject = useCallback((id: string) => {
    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.filter(obj => obj.id !== id)));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [pushHistory]);

  const deleteSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.filter(obj => !selectedIds.has(obj.id))));
    setSelectedIds(new Set());
  }, [selectedIds, pushHistory]);

  const moveObject = useCallback((id: string, dCol: number, dRow: number) => {
    setObjects(prev => normalizeStackOrder(syncConnectorLines(prev.map(obj => {
      if (obj.id !== id) return obj;
      const target = prev.find(candidate => candidate.id === id);
      if (!target) return obj;
      const bounded = clampDeltaForObjects([target], dCol, dRow);
      const newCol = obj.position.col + bounded.dCol;
      const newRow = obj.position.row + bounded.dRow;

      ensureSpace(newCol + obj.width, newRow + obj.height);

      if (obj.endPosition) {
        return {
          ...obj,
          position: { col: newCol, row: newRow },
          endPosition: {
            col: obj.endPosition.col + bounded.dCol,
            row: obj.endPosition.row + bounded.dRow
          }
        };
      }
      return { ...obj, position: { col: newCol, row: newRow } };
    }))));
  }, [clampDeltaForObjects, ensureSpace, syncConnectorLines]);

  const moveSelection = useCallback((dCol: number, dRow: number) => {
    if (selectedIds.size === 0) return;
    setObjects(prev => {
      const moving = prev.filter(obj => selectedIds.has(obj.id));
      const bounded = clampDeltaForObjects(moving, dCol, dRow);
      return normalizeStackOrder(syncConnectorLines(prev.map(obj => {
      if (!selectedIds.has(obj.id)) return obj;
      const newCol = obj.position.col + bounded.dCol;
      const newRow = obj.position.row + bounded.dRow;

      ensureSpace(newCol + obj.width, newRow + obj.height);

      if (obj.endPosition) {
        return {
          ...obj,
          position: { col: newCol, row: newRow },
          endPosition: {
            col: obj.endPosition.col + bounded.dCol,
            row: obj.endPosition.row + bounded.dRow
          }
        };
      }
      return { ...obj, position: { col: newCol, row: newRow } };
      })));
    });
  }, [selectedIds, clampDeltaForObjects, ensureSpace, syncConnectorLines]);

  const resizeObject = useCallback((id: string, width: number, height: number) => {
    setObjects(prev => normalizeStackOrder(syncConnectorLines(prev.map(obj => {
      if (obj.id !== id || !isResizable(obj)) return obj;

      if (obj.type === 'line' || obj.type === 'arrow') {
        const newWidth = Math.max(2, width);
        const newHeight = Math.max(2, height);
        ensureSpace(obj.position.col + newWidth, obj.position.row + newHeight);
        const currentEndCol = obj.endPosition?.col ?? (obj.position.col + obj.width - 1);
        const currentEndRow = obj.endPosition?.row ?? obj.position.row;
        const dx = currentEndCol - obj.position.col;
        const dy = currentEndRow - obj.position.row;
        const currentLength = Math.sqrt(dx * dx + dy * dy) || 1;
        const newLength = Math.max(newWidth, newHeight);
        const ratio = newLength / currentLength;
        const newEndCol = obj.position.col + Math.round(dx * ratio);
        const newEndRow = obj.position.row + Math.round(dy * ratio);
        return {
          ...obj,
          width: newWidth,
          height: newHeight,
          endPosition: { col: newEndCol, row: newEndRow },
        };
      }

      const newWidth = Math.max(3, width);
      const newHeight = Math.max(3, height);
      ensureSpace(obj.position.col + newWidth, obj.position.row + newHeight);
      return { ...obj, width: newWidth, height: newHeight };
    }))));
  }, [ensureSpace, syncConnectorLines]);

  const clearAll = useCallback(() => {
    pushHistory();
    setObjects([]);
    setLayersState([{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME, order: 0, objectCount: 0 }]);
    setSelectedIds(new Set());
    setGridSize({ cols: INITIAL_COLS, rows: INITIAL_ROWS });
  }, [pushHistory]);

  const selectObject = useCallback((id: string, addToSelection: boolean = false) => {
    setSelectedIds(prev => {
      const next = new Set(addToSelection ? prev : []);
      if (addToSelection && next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // --- Undo/Redo ---
  const undo = useCallback(() => {
    setPast(pastStates => {
      if (pastStates.length === 0) return pastStates;
      const previous = pastStates[pastStates.length - 1];
      const remaining = pastStates.slice(0, -1);

      setObjects(current => {
        setFuture(f => [current, ...f]);
        return previous;
      });

      return remaining;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(futureStates => {
      if (futureStates.length === 0) return futureStates;
      const next = futureStates[0];
      const remaining = futureStates.slice(1);

      setObjects(current => {
        setPast(p => [...p, current]);
        return next;
      });

      return remaining;
    });
  }, []);

  // --- Copy/Paste/Duplicate ---
  const copySelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    setClipboard(objects.filter(obj => selectedIds.has(obj.id)));
  }, [selectedIds, objects]);

  const cutSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    setClipboard(objects.filter(obj => selectedIds.has(obj.id)));
    deleteSelection();
  }, [selectedIds, objects, deleteSelection]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.length === 0) return;
    pushHistory();

    const newIds = new Set<string>();
    const newObjects = clipboard.map(obj => {
      const newId = generateId();
      newIds.add(newId);
      const base: CanvasObject = {
        ...obj,
        id: newId,
        position: { col: obj.position.col + 2, row: obj.position.row + 1 },
      };
      if (obj.endPosition) {
        return {
          ...base,
          endPosition: { col: obj.endPosition.col + 2, row: obj.endPosition.row + 1 },
        };
      }
      return base;
    });

    setObjects(prev => normalizeStackOrder([...prev, ...newObjects]));
    setSelectedIds(newIds);
    // Update clipboard to pasted objects so subsequent paste offsets further
    setClipboard(newObjects);
  }, [clipboard, pushHistory]);

  const duplicateSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();

    const selected = objects.filter(obj => selectedIds.has(obj.id));
    const newIds = new Set<string>();
    const duplicated = selected.map(obj => {
      const newId = generateId();
      newIds.add(newId);
      const base: CanvasObject = {
        ...obj,
        id: newId,
        position: { col: obj.position.col + 2, row: obj.position.row + 1 },
      };
      if (obj.endPosition) {
        return {
          ...base,
          endPosition: { col: obj.endPosition.col + 2, row: obj.endPosition.row + 1 },
        };
      }
      return base;
    });

    setObjects(prev => normalizeStackOrder([...prev, ...duplicated]));
    setSelectedIds(newIds);
  }, [selectedIds, objects, pushHistory]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(objects.map(obj => obj.id)));
  }, [objects]);

  const createLayerFromSelection = useCallback(() => {
    const nextOrder = layers.length > 0 ? Math.max(...layers.map(layer => layer.order)) + 1 : 0;
    const nextLayerName = `Layer ${nextOrder + 1}`;
    const nextLayerId = `layer-${Date.now()}`;
    setLayersState(prev => [
      ...prev,
      { id: nextLayerId, name: nextLayerName, order: nextOrder, objectCount: 0 },
    ]);

    if (selectedIds.size === 0) return;

    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => (
      selectedIds.has(obj.id)
        ? { ...obj, layerId: nextLayerId, layerName: nextLayerName, layerOrder: nextOrder }
        : obj
    ))));
  }, [layers, pushHistory, selectedIds]);

  const moveSelectionToLayer = useCallback((layerId: string) => {
    if (selectedIds.size === 0) return;
    const targetLayer = layers.find(layer => layer.id === layerId);
    if (!targetLayer) return;
    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => (
      selectedIds.has(obj.id)
        ? { ...obj, layerId: targetLayer.id, layerName: targetLayer.name, layerOrder: targetLayer.order }
        : obj
    ))));
  }, [layers, pushHistory, selectedIds]);

  const moveObjectToLayer = useCallback((objectId: string, layerId: string) => {
    const targetLayer = layers.find(layer => layer.id === layerId);
    if (!targetLayer) return;
    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => (
      obj.id === objectId
        ? { ...obj, layerId: targetLayer.id, layerName: targetLayer.name, layerOrder: targetLayer.order }
        : obj
    ))));
    setSelectedIds(new Set([objectId]));
  }, [layers, pushHistory]);

  const reorderObjectByDrop = useCallback((dragObjectId: string, targetObjectId: string) => {
    if (dragObjectId === targetObjectId) return;
    pushHistory();
    setObjects(prev => {
      const dragObj = prev.find(obj => obj.id === dragObjectId);
      const targetObj = prev.find(obj => obj.id === targetObjectId);
      if (!dragObj || !targetObj) return prev;

      const sourceLayerId = dragObj.layerId ?? DEFAULT_LAYER_ID;
      const targetLayerId = targetObj.layerId ?? DEFAULT_LAYER_ID;
      const targetLayerName = targetObj.layerName ?? DEFAULT_LAYER_NAME;
      const targetLayerOrder = targetObj.layerOrder ?? 0;

      let updated = prev.map(obj => (
        obj.id === dragObjectId
          ? { ...obj, layerId: targetLayerId, layerName: targetLayerName, layerOrder: targetLayerOrder }
          : obj
      ));

      const targetLayerObjects = updated
        .filter(obj => (obj.layerId ?? DEFAULT_LAYER_ID) === targetLayerId)
        .sort((a, b) => a.zIndex - b.zIndex);
      const dragMoved = targetLayerObjects.find(obj => obj.id === dragObjectId);
      if (!dragMoved) return prev;
      const withoutDrag = targetLayerObjects.filter(obj => obj.id !== dragObjectId);
      const targetIndex = withoutDrag.findIndex(obj => obj.id === targetObjectId);
      const insertAt = targetIndex >= 0 ? targetIndex : withoutDrag.length;
      withoutDrag.splice(insertAt, 0, dragMoved);

      const zMap = new Map<string, number>();
      withoutDrag.forEach((obj, idx) => zMap.set(obj.id, idx));

      if (sourceLayerId !== targetLayerId) {
        updated
          .filter(obj => (obj.layerId ?? DEFAULT_LAYER_ID) === sourceLayerId)
          .sort((a, b) => a.zIndex - b.zIndex)
          .forEach((obj, idx) => zMap.set(obj.id, idx));
      }

      updated = updated.map(obj => (
        zMap.has(obj.id) ? { ...obj, zIndex: zMap.get(obj.id)! } : obj
      ));

      return normalizeStackOrder(updated);
    });
    setSelectedIds(new Set([dragObjectId]));
  }, [pushHistory]);

  const renameLayer = useCallback((layerId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const targetLayer = layers.find(layer => layer.id === layerId);
    if (!targetLayer || targetLayer.name === trimmed) return;
    setLayersState(prev => prev.map(layer => (
      layer.id === layerId ? { ...layer, name: trimmed } : layer
    )));

    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => (
      (obj.layerId ?? DEFAULT_LAYER_ID) === layerId
        ? { ...obj, layerName: trimmed }
        : obj
    ))));
  }, [layers, pushHistory]);

  const reorderLayer = useCallback((dragLayerId: string, targetLayerId: string) => {
    if (dragLayerId === targetLayerId) return;
    const orderedLayers = [...layers].sort((a, b) => a.order - b.order);
    const fromIndex = orderedLayers.findIndex(layer => layer.id === dragLayerId);
    const toIndex = orderedLayers.findIndex(layer => layer.id === targetLayerId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...orderedLayers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const orderMap = new Map<string, number>(reordered.map((layer, order) => [layer.id, order]));

    setLayersState(prev => prev.map(layer => ({
      ...layer,
      order: orderMap.get(layer.id) ?? layer.order,
    })));

    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => ({
      ...obj,
      layerOrder: orderMap.get(obj.layerId ?? DEFAULT_LAYER_ID) ?? (obj.layerOrder ?? 0),
    })), orderMap));
  }, [layers, pushHistory]);

  const arrangeSelectionLayer = useCallback((mode: 'toFront' | 'forward' | 'backward' | 'toBack') => {
    if (selectedIds.size === 0) return;
    const selected = objects.filter(obj => selectedIds.has(obj.id)).sort(compareObjectsByStackOrder);
    if (selected.length === 0) return;
    const selectedLayerId = selected[0].layerId ?? DEFAULT_LAYER_ID;
    const orderedLayers = [...layers].sort((a, b) => a.order - b.order);
    const index = orderedLayers.findIndex(layer => layer.id === selectedLayerId);
    if (index < 0) return;

    let targetIndex = index;
    if (mode === 'toFront') targetIndex = orderedLayers.length - 1;
    if (mode === 'toBack') targetIndex = 0;
    if (mode === 'forward') targetIndex = Math.min(orderedLayers.length - 1, index + 1);
    if (mode === 'backward') targetIndex = Math.max(0, index - 1);
    if (targetIndex === index) return;

    const reordered = [...orderedLayers];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderMap = new Map<string, number>(reordered.map((layer, order) => [layer.id, order]));
    setLayersState(prev => prev.map(layer => ({
      ...layer,
      order: orderMap.get(layer.id) ?? layer.order,
    })));

    pushHistory();
    setObjects(prev => normalizeStackOrder(prev.map(obj => ({
      ...obj,
      layerOrder: orderMap.get(obj.layerId ?? DEFAULT_LAYER_ID) ?? (obj.layerOrder ?? 0),
    }))));
  }, [layers, objects, pushHistory, selectedIds]);

  // --- Load objects (for share URL) ---
  const loadObjects = useCallback((objs: CanvasObject[]) => {
    const normalized = normalizeStackOrder(syncConnectorLines(objs));
    setObjects(normalized);
    const loadedLayers = buildLayers(normalized)
      .sort((a, b) => a.order - b.order)
      .map((layer, order) => ({ ...layer, order }));
    setLayersState(
      loadedLayers.length > 0
        ? loadedLayers
        : [{ id: DEFAULT_LAYER_ID, name: DEFAULT_LAYER_NAME, order: 0, objectCount: 0 }]
    );
    setSelectedIds(new Set());
    setPast([]);
    setFuture([]);
    // Preserve fixed preset canvas size when loading.
    setGridSize({ cols: INITIAL_COLS, rows: INITIAL_ROWS });
  }, [syncConnectorLines]);

  const handleCellMouseDown = useCallback((col: number, row: number, resizeHandle?: ResizeHandle | null) => {
    setCursor({ col, row });
    setAlignmentGuides([]);

    // Handle resize handle click (skip text objects)
    if (resizeHandle && selectedIds.size === 1) {
      const selectedId = Array.from(selectedIds)[0];
      const selectedObj = objects.find(obj => obj.id === selectedId);
      if (selectedObj && selectedObj.type !== 'text') {
        pushHistory();
        setDragState({ type: 'resizing', objectId: selectedId, handle: resizeHandle });
        return;
      }
    }

    // Handle pending component placement
    if (pendingComponent) {
      ensureSpace(col + 50, row + 30);
      pushHistory();
      const newObj = createDefaultObject('component', col, row, { componentType: pendingComponent, zIndex: objects.length });
      setObjects(prev => normalizeStackOrder([...prev, newObj]));
      setSelectedIds(new Set([newObj.id]));
      setPendingComponent(null);
      setTool(TOOLS.SELECT);
      return;
    }

    if (tool === TOOLS.SELECT) {
      const hit = hitTest(objects, col, row);

      if (hit) {
        const handle = getResizeHandle(hit, col, row);
        if (handle && selectedIds.has(hit.id)) {
          pushHistory();
          setDragState({ type: 'resizing', objectId: hit.id, handle: handle as ResizeHandle });
        } else {
          if (!selectedIds.has(hit.id)) {
            selectObject(hit.id);
          }
          const bbox = getBoundingBox(hit);
          pushHistory();
          setDragState({
            type: 'moving',
            objectId: hit.id,
            offsetCol: col - bbox.col,
            offsetRow: row - bbox.row
          });
        }
      } else {
        // Start marquee selection on empty area
        clearSelection();
        setMarquee({ startCol: col, startRow: row, endCol: col, endRow: row });
      }
      return;
    }

    // Start drawing box/line/arrow/connector
    if (tool === TOOLS.BOX || tool === TOOLS.LINE || tool === TOOLS.ARROW || tool === TOOLS.CONNECTOR) {
      if (tool === TOOLS.CONNECTOR) {
        const anchor = getConnectorAnchor(col, row);
        if (!anchor) return;
        setConnectorStartAnchor(anchor);
        setCursor(anchor.position);
        setDragState({ type: 'drawing', startCol: anchor.position.col, startRow: anchor.position.row, tool });
        return;
      }
      setDragState({ type: 'drawing', startCol: col, startRow: row, tool });
      return;
    }

    // Place text immediately and enter edit mode
    if (tool === TOOLS.TEXT) {
      ensureSpace(col + 20, row + 5);
      pushHistory();
      const newObj = createDefaultObject('text', col, row, { zIndex: objects.length, content: '' });
      flushSync(() => {
        setObjects(prev => normalizeStackOrder([...prev, newObj]));
        setSelectedIds(new Set([newObj.id]));
      });
      setEditingObjectId(newObj.id);
      setTool(TOOLS.SELECT);
      return;
    }
  }, [tool, objects, selectedIds, pendingComponent, selectObject, clearSelection, objects.length, ensureSpace, pushHistory, getConnectorAnchor]);

  const handleCellMouseMove = useCallback((col: number, row: number) => {
    if (dragState.type === 'drawing' && dragState.tool === TOOLS.CONNECTOR) {
      // Keep preview visible like line tool while dragging connector.
      setCursor({ col, row });
    } else {
      setCursor({ col, row });
    }

    // Update marquee
    if (marquee) {
      setMarquee(prev => prev ? { ...prev, endCol: col, endRow: row } : null);
      return;
    }

    if (dragState.type === 'moving' && dragState.objectId) {
      const newCol = Math.max(0, col - dragState.offsetCol);
      const newRow = Math.max(0, row - dragState.offsetRow);

      setObjects(prev => {
        const movingSelection = selectedIds.has(dragState.objectId) && selectedIds.size > 1;
        const movingIds = movingSelection ? selectedIds : new Set([dragState.objectId]);
        const anchor = prev.find(obj => obj.id === dragState.objectId);
        if (!anchor) return prev;
        const anchorBox = getBoundingBox(anchor);
        const dCol = newCol - anchorBox.col;
        const dRow = newRow - anchorBox.row;
        const movingObjects = prev.filter(obj => movingIds.has(obj.id));
        const bounded = clampDeltaForObjects(movingObjects, dCol, dRow);
        const staticObjects = prev.filter(obj => !movingIds.has(obj.id));

        let finalDelta = bounded;
        let nextGuides: AlignmentGuide[] = [];

        if (smartGuidesEnabled && prev.length > 1 && staticObjects.length > 0) {
          const movedProbe = movingObjects.map(obj => ({
            ...obj,
            position: { col: obj.position.col + bounded.dCol, row: obj.position.row + bounded.dRow },
            endPosition: obj.endPosition
              ? { col: obj.endPosition.col + bounded.dCol, row: obj.endPosition.row + bounded.dRow }
              : obj.endPosition,
          }));
          const movingBounds = getBoundsForObjects(movedProbe);
          if (movingBounds) {
            const snap = computeSmartGuidesForBounds(movingBounds, staticObjects);
            const snapped = clampDeltaForObjects(
              movingObjects,
              bounded.dCol + snap.snapDx,
              bounded.dRow + snap.snapDy
            );
            finalDelta = snapped;
            nextGuides = snap.guides;
          }
        }
        setAlignmentGuides(smartGuidesEnabled ? nextGuides : []);

        const moved = prev.map(obj => {
          if (!movingIds.has(obj.id)) return obj;
          const nextCol = obj.position.col + finalDelta.dCol;
          const nextRow = obj.position.row + finalDelta.dRow;
          ensureSpace(nextCol + obj.width, nextRow + obj.height);

          if (obj.endPosition) {
            return {
              ...obj,
              position: { col: nextCol, row: nextRow },
              endPosition: {
                col: obj.endPosition.col + finalDelta.dCol,
                row: obj.endPosition.row + finalDelta.dRow,
              },
            };
          }

          return { ...obj, position: { col: nextCol, row: nextRow } };
        });

        return normalizeStackOrder(syncConnectorLines(moved));
      });
    } else if (dragState.type === 'resizing' && dragState.objectId) {
      setObjects(prev => normalizeStackOrder(syncConnectorLines(prev.map(obj => {
        if (obj.id !== dragState.objectId) return obj;

        // Skip text objects
        if (obj.type === 'text') return obj;

        // Handle line/arrow resizing - support all corner handles (nw, ne, sw, se)
        if (obj.type === 'line' || obj.type === 'arrow') {
          if (obj.type === 'line' && obj.isConnector) {
            const movingStart = dragState.handle === 'nw';
            const anchor = getConnectorAnchorForEdit(col, row, obj.id);
            if (!anchor) return obj;

            if (movingStart) {
              if (obj.endBinding && anchor.objectId === obj.endBinding.objectId && anchor.handle === obj.endBinding.handle) {
                return obj;
              }
              return {
                ...obj,
                position: anchor.position,
                startBinding: { objectId: anchor.objectId, handle: anchor.handle },
                width: obj.endPosition ? Math.abs(obj.endPosition.col - anchor.position.col) + 1 : obj.width,
                height: obj.endPosition ? Math.abs(obj.endPosition.row - anchor.position.row) + 1 : obj.height,
                rotation: undefined,
              };
            }

            if (obj.startBinding && anchor.objectId === obj.startBinding.objectId && anchor.handle === obj.startBinding.handle) {
              return obj;
            }
            return {
              ...obj,
              endPosition: anchor.position,
              endBinding: { objectId: anchor.objectId, handle: anchor.handle },
              width: Math.abs(anchor.position.col - obj.position.col) + 1,
              height: Math.abs(anchor.position.row - obj.position.row) + 1,
              rotation: undefined,
            };
          }

          const cornerHandles = ['nw', 'ne', 'sw', 'se'] as const;
          if (!cornerHandles.includes(dragState.handle as typeof cornerHandles[number])) return obj;

          let endCol: number, endRow: number;
          if (obj.rotation !== undefined) {
            const length = getLineLength(obj);
            const rad = (obj.rotation * Math.PI) / 180;
            endCol = obj.position.col + Math.round(Math.cos(rad) * length);
            endRow = obj.position.row + Math.round(Math.sin(rad) * length);
          } else if (obj.endPosition) {
            endCol = obj.endPosition.col;
            endRow = obj.endPosition.row;
          } else {
            return obj;
          }
          const startCol = obj.position.col;
          const startRow = obj.position.row;
          const bbox = getBoundingBox(obj);

          // Map handle to the corner position - which point (start or end) is at that corner?
          const handleCorners: Record<string, [number, number]> = {
            nw: [bbox.col, bbox.row],
            ne: [bbox.col + bbox.width - 1, bbox.row],
            sw: [bbox.col, bbox.row + bbox.height - 1],
            se: [bbox.col + bbox.width - 1, bbox.row + bbox.height - 1],
          };
          const [handleCol, handleRow] = handleCorners[dragState.handle] ?? [0, 0];
          const movingStart = handleCol === startCol && handleRow === startRow;

          ensureSpace(
            Math.max(col, movingStart ? endCol : startCol),
            Math.max(row, movingStart ? endRow : startRow)
          );

          if (movingStart) {
            return {
              ...obj,
              position: { col, row },
              endPosition: { col: endCol, row: endRow },
              width: Math.abs(endCol - col) + 1,
              height: Math.abs(endRow - row) + 1,
              rotation: undefined,
            };
          } else {
            return {
              ...obj,
              endPosition: { col, row },
              width: Math.abs(col - startCol) + 1,
              height: Math.abs(row - startRow) + 1,
              rotation: undefined,
            };
          }
        }

        // Handle box/component resizing
        let newCol = obj.position.col;
        let newRow = obj.position.row;
        let newWidth = obj.width;
        let newHeight = obj.height;

        switch (dragState.handle) {
          case 'se':
            newWidth = Math.max(3, col - obj.position.col + 1);
            newHeight = Math.max(3, row - obj.position.row + 1);
            break;
          case 'nw':
            newWidth = Math.max(3, obj.position.col + obj.width - col);
            newHeight = Math.max(3, obj.position.row + obj.height - row);
            newCol = Math.min(col, obj.position.col + obj.width - 3);
            newRow = Math.min(row, obj.position.row + obj.height - 3);
            break;
          case 'ne':
            newWidth = Math.max(3, col - obj.position.col + 1);
            newHeight = Math.max(3, obj.position.row + obj.height - row);
            newRow = Math.min(row, obj.position.row + obj.height - 3);
            break;
          case 'sw':
            newWidth = Math.max(3, obj.position.col + obj.width - col);
            newHeight = Math.max(3, row - obj.position.row + 1);
            newCol = Math.min(col, obj.position.col + obj.width - 3);
            break;
          case 'n':
            newHeight = Math.max(3, obj.position.row + obj.height - row);
            newRow = Math.min(row, obj.position.row + obj.height - 3);
            break;
          case 's':
            newHeight = Math.max(3, row - obj.position.row + 1);
            break;
          case 'e':
            newWidth = Math.max(3, col - obj.position.col + 1);
            break;
          case 'w':
            newWidth = Math.max(3, obj.position.col + obj.width - col);
            newCol = Math.min(col, obj.position.col + obj.width - 3);
            break;
        }

        if (smartGuidesEnabled && prev.length > 1) {
          const staticObjects = prev.filter(other => other.id !== obj.id);
          if (staticObjects.length > 0) {
            const probeBounds = {
              left: newCol,
              right: newCol + newWidth - 1,
              top: newRow,
              bottom: newRow + newHeight - 1,
              centerX: Math.round((newCol + (newCol + newWidth - 1)) / 2),
              centerY: Math.round((newRow + (newRow + newHeight - 1)) / 2),
            };
            const snap = computeSmartGuidesForBounds(probeBounds, staticObjects);
            const handleXActive = dragState.handle.includes('e') || dragState.handle.includes('w');
            const handleYActive = dragState.handle.includes('n') || dragState.handle.includes('s');

            if (handleXActive && snap.snapDx !== 0) {
              if (dragState.handle.includes('e')) {
                newWidth = Math.max(3, newWidth + snap.snapDx);
              } else if (dragState.handle.includes('w')) {
                newCol += snap.snapDx;
                newWidth = Math.max(3, newWidth - snap.snapDx);
              }
            }
            if (handleYActive && snap.snapDy !== 0) {
              if (dragState.handle.includes('s')) {
                newHeight = Math.max(3, newHeight + snap.snapDy);
              } else if (dragState.handle.includes('n')) {
                newRow += snap.snapDy;
                newHeight = Math.max(3, newHeight - snap.snapDy);
              }
            }

            const visibleGuides = snap.guides.filter(guide => (
              (guide.orientation === 'vertical' && handleXActive) ||
              (guide.orientation === 'horizontal' && handleYActive)
            ));
            setAlignmentGuides(visibleGuides);
          }
        }

        ensureSpace(newCol + newWidth, newRow + newHeight);
        return { ...obj, position: { col: newCol, row: newRow }, width: newWidth, height: newHeight };
      }))));
    }
  }, [clampDeltaForObjects, computeSmartGuidesForBounds, dragState, ensureSpace, getBoundsForObjects, marquee, getConnectorAnchor, getConnectorAnchorForEdit, smartGuidesEnabled, syncConnectorLines]);

  const handleCellMouseUp = useCallback(() => {
    // Finalize marquee selection
    if (marquee) {
      const minCol = Math.min(marquee.startCol, marquee.endCol);
      const maxCol = Math.max(marquee.startCol, marquee.endCol);
      const minRow = Math.min(marquee.startRow, marquee.endRow);
      const maxRow = Math.max(marquee.startRow, marquee.endRow);

      // Only select if marquee has some area
      if (maxCol - minCol > 1 || maxRow - minRow > 1) {
        const hitIds = new Set<string>();
        for (const obj of objects) {
          const bbox = getBoundingBox(obj);
          // Check if object bounding box intersects with marquee
          const objRight = bbox.col + bbox.width;
          const objBottom = bbox.row + bbox.height;
          if (bbox.col < maxCol && objRight > minCol && bbox.row < maxRow && objBottom > minRow) {
            hitIds.add(obj.id);
          }
        }
        setSelectedIds(hitIds);
      }
      setMarquee(null);
      return;
    }

    if (dragState.type === 'drawing') {
      const { startCol, startRow } = dragState;
      const endCol = cursor.col;
      const endRow = cursor.row;

      const col = Math.min(startCol, endCol);
      const row = Math.min(startRow, endRow);
      const width = Math.abs(endCol - startCol) + 1;
      const height = Math.abs(endRow - startRow) + 1;

      const isValidBox = width >= 2 && height >= 2;
      const isValidLine = width > 1 || height > 1;

      if (tool === TOOLS.BOX && isValidBox) {
        ensureSpace(col + width + EXPAND_MARGIN, row + height + EXPAND_MARGIN);
        pushHistory();
        const newObj = createDefaultObject('box', col, row, { zIndex: objects.length });
        newObj.width = width;
        newObj.height = height;
        setObjects(prev => normalizeStackOrder([...prev, newObj]));
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      } else if (tool === TOOLS.LINE && isValidLine) {
        ensureSpace(Math.max(startCol, endCol) + EXPAND_MARGIN, Math.max(startRow, endRow) + EXPAND_MARGIN);
        pushHistory();
        const newObj = createDefaultObject('line', startCol, startRow, { zIndex: objects.length });
        newObj.endPosition = { col: endCol, row: endRow };
        newObj.width = Math.abs(endCol - startCol) + 1;
        newObj.height = Math.abs(endRow - startRow) + 1;
        setObjects(prev => normalizeStackOrder([...prev, newObj]));
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      } else if (tool === TOOLS.ARROW && isValidLine) {
        ensureSpace(Math.max(startCol, endCol) + EXPAND_MARGIN, Math.max(startRow, endRow) + EXPAND_MARGIN);
        pushHistory();
        const newObj = createDefaultObject('arrow', startCol, startRow, { zIndex: objects.length });
        newObj.endPosition = { col: endCol, row: endRow };
        newObj.width = Math.abs(endCol - startCol) + 1;
        newObj.height = Math.abs(endRow - startRow) + 1;
        setObjects(prev => normalizeStackOrder([...prev, newObj]));
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      } else if (tool === TOOLS.CONNECTOR && connectorStartAnchor) {
        const endAnchor = getConnectorAnchor(endCol, endRow);
        if (endAnchor && (endAnchor.objectId !== connectorStartAnchor.objectId || endAnchor.handle !== connectorStartAnchor.handle)) {
          ensureSpace(Math.max(startCol, endAnchor.position.col) + EXPAND_MARGIN, Math.max(startRow, endAnchor.position.row) + EXPAND_MARGIN);
          pushHistory();
          const newObj = createDefaultObject('line', startCol, startRow, { zIndex: objects.length });
          newObj.isConnector = true;
          newObj.connectorFromHead = 'line';
          newObj.connectorToHead = 'line';
          newObj.startBinding = { objectId: connectorStartAnchor.objectId, handle: connectorStartAnchor.handle };
          newObj.endBinding = { objectId: endAnchor.objectId, handle: endAnchor.handle };
          newObj.endPosition = { col: endAnchor.position.col, row: endAnchor.position.row };
          newObj.width = Math.abs(endAnchor.position.col - startCol) + 1;
          newObj.height = Math.abs(endAnchor.position.row - startRow) + 1;
          setObjects(prev => normalizeStackOrder(syncConnectorLines([...prev, newObj])));
          setSelectedIds(new Set([newObj.id]));
          setTool(TOOLS.SELECT);
        }
      }
    }

    setDragState({ type: 'none' });
    setConnectorStartAnchor(null);
    setAlignmentGuides([]);
  }, [dragState, cursor, tool, objects, ensureSpace, pushHistory, marquee, connectorStartAnchor, getConnectorAnchor, syncConnectorLines]);

  const handleKeyDown = useCallback((key: string) => {
    if (selectedIds.size > 0) {
      switch (key) {
        case 'ArrowUp':
          pushHistory();
          moveSelection(0, -1);
          break;
        case 'ArrowDown':
          pushHistory();
          moveSelection(0, 1);
          break;
        case 'ArrowLeft':
          pushHistory();
          moveSelection(-1, 0);
          break;
        case 'ArrowRight':
          pushHistory();
          moveSelection(1, 0);
          break;
        case 'Delete':
        case 'Backspace':
          deleteSelection();
          break;
      }
    }
  }, [selectedIds, moveSelection, deleteSelection, pushHistory]);

  const panViewport = useCallback((dx: number, dy: number) => {
    setPanX(prev => prev + dx);
    setPanY(prev => prev + dy);
  }, []);

  const zoomViewport = useCallback((delta: number, centerX: number, centerY: number) => {
    setZoom(prev => {
      const newZoom = Math.max(0.25, Math.min(4, prev + delta));
      const scale = newZoom / prev;
      setPanX(prevPan => centerX - (centerX - prevPan) * scale);
      setPanY(prevPan => centerY - (centerY - prevPan) * scale);
      return newZoom;
    });
  }, []);

  // Smart export: recalculate grid to fit content tightly, then convert to string
  const exportToText = useCallback((format: ExportFormat = 'text') => {
    // Recalculate grid to fit objects tightly (like Next.js does)
    const fittedSize = calculateGridSize(objects, gridSize);
    const fittedGrid = renderObjectsToGrid(objects, fittedSize);
    const raw = gridToString(fittedGrid);

    // Trim trailing blank lines
    const trimmed = raw.replace(/\n+$/, '');

    switch (format) {
      case 'markdown':
        return '```\n' + trimmed + '\n```';
      case 'html': {
        const escaped = trimmed
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<pre style="font-family: 'JetBrains Mono', monospace; font-size: 14px; line-height: 1.5;">${escaped}</pre>`;
      }
      case 'github': {
        const lines = [
          '<details>',
          '<summary>Wireframe</summary>',
          '',
          '```',
          trimmed,
          '```',
          '',
          '</details>',
        ];
        return lines.join('\n');
      }
      case 'text':
      default:
        return trimmed;
    }
  }, [objects, gridSize]);

  return {
    objects,
    grid,
    gridSize,
    tool,
    setTool,
    selectedIds,
    pendingComponent,
    setPendingComponent,
    dragState,
    zoom,
    setZoom,
    panX,
    panY,
    editingObjectId,
    setEditingObjectId,
    marquee,
    layers,
    alignmentGuides,
    addObject,
    updateObject,
    deleteObject,
    deleteSelection,
    moveObject,
    moveSelection,
    resizeObject,
    clearAll,
    selectObject,
    clearSelection,
    handleCellMouseDown,
    handleCellMouseMove,
    handleCellMouseUp,
    handleKeyDown,
    panViewport,
    zoomViewport,
    exportToText,
    ensureSpace,
    loadObjects,
    undo,
    redo,
    canUndo,
    canRedo,
    copySelection,
    cutSelection,
    pasteClipboard,
    duplicateSelection,
    selectAll,
    createLayerFromSelection,
    moveSelectionToLayer,
    moveObjectToLayer,
    reorderObjectByDrop,
    renameLayer,
    reorderLayer,
    arrangeSelectionLayer,
    selectedObjects,
    objectsCount,
    cursor,
  };
}
