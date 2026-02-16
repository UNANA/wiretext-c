import { useState, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  renderObjectsToGrid,
  createDefaultObject,
  hitTest,
  getResizeHandle,
  getLineLength,
  gridToString,
  isResizable,
  getBoundingBox,
  calculateGridSize,
  generateId,
} from '../utils/boxDrawing';
import type { Grid, Tool, Position, CanvasObject, ComponentType, DragState, ResizeHandle, GridSize } from '../types';

export const TOOLS = {
  SELECT: 'select' as Tool,
  BOX: 'box' as Tool,
  TEXT: 'text' as Tool,
  LINE: 'line' as Tool,
  ARROW: 'arrow' as Tool,
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
  pasteClipboard: () => void;
  duplicateSelection: () => void;

  // Getters
  selectedObjects: CanvasObject[];
  objectsCount: number;
  cursor: Position;
}

// Initial grid size - matches Next.js (120x60)
const INITIAL_COLS = 120;
const INITIAL_ROWS = 60;
const EXPAND_MARGIN = 20;
const MAX_SIZE = 2000;
const MAX_HISTORY = 100;

export function useCanvas(): UseCanvasReturn {
  const [objects, setObjects] = useState<CanvasObject[]>([]);
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

  // Undo/Redo history
  const [past, setPast] = useState<CanvasObject[][]>([]);
  const [future, setFuture] = useState<CanvasObject[][]>([]);

  // Clipboard
  const [clipboard, setClipboard] = useState<CanvasObject[]>([]);

  // Push current state to history before mutation
  const pushHistory = useCallback(() => {
    setObjects(current => {
      setPast(prev => [...prev.slice(-(MAX_HISTORY - 1)), current]);
      setFuture([]);
      return current;
    });
  }, []);

  // Ensure space for new objects - expand grid if needed
  const ensureSpace = useCallback((col: number, row: number) => {
    setGridSize(current => {
      let newCols = current.cols;
      let newRows = current.rows;

      if (col + EXPAND_MARGIN > current.cols) {
        newCols = Math.min(col + EXPAND_MARGIN * 2, MAX_SIZE);
      }
      if (row + EXPAND_MARGIN > current.rows) {
        newRows = Math.min(row + EXPAND_MARGIN * 2, MAX_SIZE);
      }

      if (newCols !== current.cols || newRows !== current.rows) {
        return { cols: newCols, rows: newRows };
      }
      return current;
    });
  }, []);

  // Render grid from objects
  const grid = useMemo(() => {
    return renderObjectsToGrid(objects, gridSize);
  }, [objects, gridSize]);

  const selectedObjects = useMemo(() => {
    return objects.filter(obj => selectedIds.has(obj.id));
  }, [objects, selectedIds]);

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
    };
    pushHistory();
    setObjects(prev => [...prev, newObj]);
    return newObj;
  }, [objects.length, ensureSpace, pushHistory]);

  const updateObject = useCallback((id: string, updates: Partial<CanvasObject>) => {
    setObjects(prev => {
      const obj = prev.find(o => o.id === id);
      if (!obj) return prev;

      // Auto-calculate width/height for text objects based on content
      if (obj.type === 'text' && updates.content !== undefined) {
        const lines = updates.content.split('\n');
        updates = {
          ...updates,
          width: Math.max(...lines.map(l => l.length), 1),
          height: lines.length || 1
        };
      }

      // Check if we need to expand grid for new position/size
      if (updates.position || updates.width || updates.height) {
        const newCol = updates.position?.col ?? obj.position.col;
        const newRow = updates.position?.row ?? obj.position.row;
        const newWidth = updates.width ?? obj.width;
        const newHeight = updates.height ?? obj.height;
        ensureSpace(newCol + newWidth, newRow + newHeight);
      }

      return prev.map(o => o.id === id ? { ...o, ...updates } : o);
    });
  }, [ensureSpace]);

  const deleteObject = useCallback((id: string) => {
    pushHistory();
    setObjects(prev => prev.filter(obj => obj.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [pushHistory]);

  const deleteSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory();
    setObjects(prev => prev.filter(obj => !selectedIds.has(obj.id)));
    setSelectedIds(new Set());
  }, [selectedIds, pushHistory]);

  const moveObject = useCallback((id: string, dCol: number, dRow: number) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id !== id) return obj;
      const newCol = Math.max(0, obj.position.col + dCol);
      const newRow = Math.max(0, obj.position.row + dRow);

      ensureSpace(newCol + obj.width, newRow + obj.height);

      if (obj.endPosition) {
        return {
          ...obj,
          position: { col: newCol, row: newRow },
          endPosition: {
            col: obj.endPosition.col + dCol,
            row: obj.endPosition.row + dRow
          }
        };
      }
      return { ...obj, position: { col: newCol, row: newRow } };
    }));
  }, [ensureSpace]);

  const moveSelection = useCallback((dCol: number, dRow: number) => {
    if (selectedIds.size === 0) return;
    setObjects(prev => prev.map(obj => {
      if (!selectedIds.has(obj.id)) return obj;
      const newCol = Math.max(0, obj.position.col + dCol);
      const newRow = Math.max(0, obj.position.row + dRow);

      ensureSpace(newCol + obj.width, newRow + obj.height);

      if (obj.endPosition) {
        return {
          ...obj,
          position: { col: newCol, row: newRow },
          endPosition: {
            col: obj.endPosition.col + dCol,
            row: obj.endPosition.row + dRow
          }
        };
      }
      return { ...obj, position: { col: newCol, row: newRow } };
    }));
  }, [selectedIds, ensureSpace]);

  const resizeObject = useCallback((id: string, width: number, height: number) => {
    setObjects(prev => prev.map(obj => {
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
    }));
  }, [ensureSpace]);

  const clearAll = useCallback(() => {
    pushHistory();
    setObjects([]);
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

    setObjects(prev => [...prev, ...newObjects]);
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

    setObjects(prev => [...prev, ...duplicated]);
    setSelectedIds(newIds);
  }, [selectedIds, objects, pushHistory]);

  // --- Load objects (for share URL) ---
  const loadObjects = useCallback((objs: CanvasObject[]) => {
    setObjects(objs);
    setSelectedIds(new Set());
    setPast([]);
    setFuture([]);
    // Auto-expand grid to fit loaded objects
    const fitted = calculateGridSize(objs, { cols: INITIAL_COLS, rows: INITIAL_ROWS });
    setGridSize(fitted);
  }, []);

  const handleCellMouseDown = useCallback((col: number, row: number, resizeHandle?: ResizeHandle | null) => {
    setCursor({ col, row });

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
      setObjects(prev => [...prev, newObj]);
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
          selectObject(hit.id);
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

    // Start drawing box/line/arrow
    if (tool === TOOLS.BOX || tool === TOOLS.LINE || tool === TOOLS.ARROW) {
      setDragState({ type: 'drawing', startCol: col, startRow: row, tool });
      return;
    }

    // Place text immediately and enter edit mode
    if (tool === TOOLS.TEXT) {
      ensureSpace(col + 20, row + 5);
      pushHistory();
      const newObj = createDefaultObject('text', col, row, { zIndex: objects.length, content: '' });
      flushSync(() => {
        setObjects(prev => [...prev, newObj]);
        setSelectedIds(new Set([newObj.id]));
      });
      setEditingObjectId(newObj.id);
      setTool(TOOLS.SELECT);
      return;
    }
  }, [tool, objects, selectedIds, pendingComponent, selectObject, clearSelection, objects.length, ensureSpace, pushHistory]);

  const handleCellMouseMove = useCallback((col: number, row: number) => {
    setCursor({ col, row });

    // Update marquee
    if (marquee) {
      setMarquee(prev => prev ? { ...prev, endCol: col, endRow: row } : null);
      return;
    }

    if (dragState.type === 'moving' && dragState.objectId) {
      const newCol = Math.max(0, col - dragState.offsetCol);
      const newRow = Math.max(0, row - dragState.offsetRow);

      setObjects(prev => prev.map(obj => {
        if (obj.id !== dragState.objectId) return obj;
        const dCol = newCol - obj.position.col;
        const dRow = newRow - obj.position.row;

        ensureSpace(newCol + obj.width, newRow + obj.height);

        if (obj.endPosition) {
          return {
            ...obj,
            position: { col: newCol, row: newRow },
            endPosition: {
              col: obj.endPosition.col + dCol,
              row: obj.endPosition.row + dRow
            }
          };
        }
        return { ...obj, position: { col: newCol, row: newRow } };
      }));
    } else if (dragState.type === 'resizing' && dragState.objectId) {
      setObjects(prev => prev.map(obj => {
        if (obj.id !== dragState.objectId) return obj;

        // Skip text objects
        if (obj.type === 'text') return obj;

        // Handle line/arrow resizing - support all corner handles (nw, ne, sw, se)
        if (obj.type === 'line' || obj.type === 'arrow') {
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

        ensureSpace(newCol + newWidth, newRow + newHeight);
        return { ...obj, position: { col: newCol, row: newRow }, width: newWidth, height: newHeight };
      }));
    }
  }, [dragState, ensureSpace, marquee]);

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
        setObjects(prev => [...prev, newObj]);
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      } else if (tool === TOOLS.LINE && isValidLine) {
        ensureSpace(Math.max(startCol, endCol) + EXPAND_MARGIN, Math.max(startRow, endRow) + EXPAND_MARGIN);
        pushHistory();
        const newObj = createDefaultObject('line', startCol, startRow, { zIndex: objects.length });
        newObj.endPosition = { col: endCol, row: endRow };
        newObj.width = Math.abs(endCol - startCol) + 1;
        newObj.height = Math.abs(endRow - startRow) + 1;
        setObjects(prev => [...prev, newObj]);
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      } else if (tool === TOOLS.ARROW && isValidLine) {
        ensureSpace(Math.max(startCol, endCol) + EXPAND_MARGIN, Math.max(startRow, endRow) + EXPAND_MARGIN);
        pushHistory();
        const newObj = createDefaultObject('arrow', startCol, startRow, { zIndex: objects.length });
        newObj.endPosition = { col: endCol, row: endRow };
        newObj.width = Math.abs(endCol - startCol) + 1;
        newObj.height = Math.abs(endRow - startRow) + 1;
        setObjects(prev => [...prev, newObj]);
        setSelectedIds(new Set([newObj.id]));
        setTool(TOOLS.SELECT);
      }
    }

    setDragState({ type: 'none' });
  }, [dragState, cursor, tool, objects, ensureSpace, pushHistory, marquee]);

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
    pasteClipboard,
    duplicateSelection,
    selectedObjects,
    objectsCount,
    cursor,
  };
}
