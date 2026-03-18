import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type {
  Grid,
  Position,
  CanvasObject,
  DragState,
  ResizeHandle,
  Tool,
  AlignmentGuide,
  GroupResizeHandle,
} from '../types';
import { compareObjectsByStackOrder, getLineLength, hitTest } from '../utils/boxDrawing';
import type { MarqueeState } from '../hooks/useCanvas';

// Helper to get line bounding box for selection display
function getLineBoundingBox(obj: CanvasObject): { col: number; row: number; width: number; height: number } {
  if ((obj.type !== 'line' && obj.type !== 'arrow')) {
    return { col: obj.position.col, row: obj.position.row, width: obj.width, height: obj.height };
  }
  if (obj.type === 'line' && obj.isConnector && obj.connectorPath && obj.connectorPath.length > 0) {
    let minCol = Number.POSITIVE_INFINITY;
    let minRow = Number.POSITIVE_INFINITY;
    let maxCol = Number.NEGATIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    for (const point of obj.connectorPath) {
      minCol = Math.min(minCol, point.col);
      minRow = Math.min(minRow, point.row);
      maxCol = Math.max(maxCol, point.col);
      maxRow = Math.max(maxRow, point.row);
    }
    return {
      col: minCol,
      row: minRow,
      width: maxCol - minCol + 1,
      height: maxRow - minRow + 1,
    };
  }

  // Calculate end position from rotation if specified, otherwise use endPosition
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
    return { col: obj.position.col, row: obj.position.row, width: 1, height: 1 };
  }

  const startCol = Math.min(obj.position.col, endCol);
  const startRow = Math.min(obj.position.row, endRow);
  return {
    col: startCol,
    row: startRow,
    width: Math.max(obj.position.col, endCol) - startCol + 1,
    height: Math.max(obj.position.row, endRow) - startRow + 1
  };
}

interface CanvasProps {
  grid: Grid;
  objects: CanvasObject[];
  tool: Tool;
  selectedIds: Set<string>;
  dragState: DragState;
  zoom: number;
  panX: number;
  panY: number;
  cursor: Position;
  gridSize: { cols: number; rows: number };
  handleCellMouseDown: (
    col: number,
    row: number,
    handle?: ResizeHandle | null,
    groupHandle?: GroupResizeHandle | null
  ) => void;
  handleCellMouseMove: (col: number, row: number) => void;
  handleCellMouseUp: () => void;
  editingObjectId?: string | null;
  setEditingObjectId?: (id: string | null) => void;
  onUpdateObject?: (id: string, updates: Partial<CanvasObject>) => void;
  marquee?: MarqueeState | null;
  alignmentGuides?: AlignmentGuide[];
  panViewport?: (dx: number, dy: number) => void;
  onCanvasContextMenu?: (x: number, y: number, onSelection: boolean) => void;
  showSelectionControls?: boolean;
}

const HANDLE_SIZE = 7;
const GROUP_HANDLE_SIZE = HANDLE_SIZE + 3;
const INTERSECTION_HANDLE_SIZE = HANDLE_SIZE + 4;

// Hook to measure character dimensions
function useCharMetrics(zoom: number) {
  const [metrics, setMetrics] = useState({ charWidth: 10, lineHeight: 20 });
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (measureRef.current) {
      const rect = measureRef.current.getBoundingClientRect();
      setMetrics({
        charWidth: rect.width,
        lineHeight: rect.height
      });
    }
  }, [zoom]);

  return { metrics, measureRef };
}

const Canvas: React.FC<CanvasProps> = ({
  grid,
  objects,
  tool,
  selectedIds,
  dragState,
  zoom,
  panX,
  panY,
  cursor,
  gridSize,
  handleCellMouseDown,
  handleCellMouseMove,
  handleCellMouseUp,
  editingObjectId,
  setEditingObjectId,
  onUpdateObject,
  marquee,
  alignmentGuides = [],
  panViewport,
  onCanvasContextMenu,
  showSelectionControls = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);

  // Measure actual character dimensions
  const { metrics, measureRef } = useCharMetrics(zoom);
  const { charWidth, lineHeight } = metrics;

  // Convert screen coordinates to grid coordinates
  const screenToGrid = useCallback((screenX: number, screenY: number): Position => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { col: 0, row: 0 };
    const x = (screenX - rect.left - panX) / zoom;
    const y = (screenY - rect.top - panY) / zoom;
    const col = Math.floor(x / charWidth);
    const row = Math.floor(y / lineHeight);
    return {
      col: Math.min(gridSize.cols - 1, Math.max(0, col)),
      row: Math.min(gridSize.rows - 1, Math.max(0, row)),
    };
  }, [panX, panY, zoom, charWidth, lineHeight, gridSize.cols, gridSize.rows]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
      return;
    }

    if (e.button === 0) {
      const pos = screenToGrid(e.clientX, e.clientY);
      setIsDragging(true);
      handleCellMouseDown(pos.col, pos.row, null);
    }
  }, [screenToGrid, handleCellMouseDown]);

  // Double-click to edit text
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = screenToGrid(e.clientX, e.clientY);
    // Find text object at position
    const hitObject = objects.find(obj =>
      obj.type === 'text' &&
      pos.col >= obj.position.col &&
      pos.col < obj.position.col + obj.width &&
      pos.row >= obj.position.row &&
      pos.row < obj.position.row + obj.height
    );
    if (hitObject && setEditingObjectId) {
      setEditingObjectId(hitObject.id);
    }
  }, [screenToGrid, objects, setEditingObjectId]);

  const handleMouseMove = useCallback((e: { clientX: number; clientY: number }) => {
    // Handle panning via middle-click or Shift+click drag
    if (isPanning && lastPanPos.current) {
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      panViewport?.(dx, dy);
      return;
    }

    if (!isDragging) return;
    const pos = screenToGrid(e.clientX, e.clientY);
    handleCellMouseMove(pos.col, pos.row);
  }, [isDragging, isPanning, screenToGrid, handleCellMouseMove, panViewport]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    lastPanPos.current = null;
    handleCellMouseUp();
  }, [handleCellMouseUp]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = screenToGrid(e.clientX, e.clientY);
    const hit = hitTest(objects, pos.col, pos.row);
    const onSelection = (!!hit && selectedIds.has(hit.id)) || selectedIds.size > 0;
    onCanvasContextMenu?.(e.clientX, e.clientY, onSelection);
  }, [screenToGrid, objects, selectedIds, onCanvasContextMenu]);

  // Attach to window so drag continues when cursor leaves canvas
  useEffect(() => {
    if (isDragging || isPanning) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [isDragging, isPanning, handleMouseUp, handleMouseMove]);

  // Scroll wheel to pan the canvas
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Shift+scroll = horizontal pan
      if (e.shiftKey) {
        panViewport?.(-e.deltaY, 0);
      } else {
        panViewport?.(-e.deltaX, -e.deltaY);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [panViewport]);

  // Grid background size in pixels
  const gridWidth = gridSize.cols * charWidth;
  const gridHeight = gridSize.rows * lineHeight;

  // Selected objects for rendering selection boxes (sorted by z-index so overlays stack correctly)
  const selectedObjects = useMemo(() => {
    return objects
      .filter(obj => selectedIds.has(obj.id))
      .sort(compareObjectsByStackOrder);
  }, [objects, selectedIds]);

  const groupResizeModel = useMemo(() => {
    const resizable = selectedObjects.filter(obj => obj.type === 'box' || obj.type === 'component');
    if (resizable.length < 2) return null;
    const groupCenterCol = Math.round((
      Math.min(...resizable.map(obj => obj.position.col))
      + Math.max(...resizable.map(obj => obj.position.col + obj.width - 1))
    ) / 2);
    const groupCenterRow = Math.round((
      Math.min(...resizable.map(obj => obj.position.row))
      + Math.max(...resizable.map(obj => obj.position.row + obj.height - 1))
    ) / 2);

    const verticalSegments: Array<{
      line: number;
      visualLine: number;
      start: number;
      end: number;
      leftObjectIds: string[];
      rightObjectIds: string[];
    }> = [];
    const horizontalSegments: Array<{
      line: number;
      visualLine: number;
      start: number;
      end: number;
      topObjectIds: string[];
      bottomObjectIds: string[];
    }> = [];

    for (let i = 0; i < resizable.length; i++) {
      for (let j = i + 1; j < resizable.length; j++) {
        const a = resizable[i];
        const b = resizable[j];

        const aRightLine = a.position.col + a.width;
        const bLeftLine = b.position.col;
        const bRightLine = b.position.col + b.width;
        const aLeftLine = a.position.col;
        const overlapRowsStart = Math.max(a.position.row, b.position.row);
        const overlapRowsEnd = Math.min(
          a.position.row + a.height - 1,
          b.position.row + b.height - 1
        );
        if (overlapRowsStart <= overlapRowsEnd) {
          if (aRightLine === bLeftLine) {
            verticalSegments.push({
              line: aRightLine,
              visualLine: aRightLine,
              start: overlapRowsStart,
              end: overlapRowsEnd,
              leftObjectIds: [a.id],
              rightObjectIds: [b.id],
            });
          } else if (bRightLine === aLeftLine) {
            verticalSegments.push({
              line: bRightLine,
              visualLine: bRightLine,
              start: overlapRowsStart,
              end: overlapRowsEnd,
              leftObjectIds: [b.id],
              rightObjectIds: [a.id],
            });
          } else if (aRightLine < bLeftLine) {
            const visual = (aRightLine + bLeftLine) / 2;
            verticalSegments.push({
              line: Math.round(visual),
              visualLine: visual,
              start: overlapRowsStart,
              end: overlapRowsEnd,
              leftObjectIds: [a.id],
              rightObjectIds: [b.id],
            });
          } else if (bRightLine < aLeftLine) {
            const visual = (bRightLine + aLeftLine) / 2;
            verticalSegments.push({
              line: Math.round(visual),
              visualLine: visual,
              start: overlapRowsStart,
              end: overlapRowsEnd,
              leftObjectIds: [b.id],
              rightObjectIds: [a.id],
            });
          }
        }

        const aBottomLine = a.position.row + a.height;
        const bTopLine = b.position.row;
        const bBottomLine = b.position.row + b.height;
        const aTopLine = a.position.row;
        const overlapColsStart = Math.max(a.position.col, b.position.col);
        const overlapColsEnd = Math.min(
          a.position.col + a.width - 1,
          b.position.col + b.width - 1
        );
        if (overlapColsStart <= overlapColsEnd) {
          if (aBottomLine === bTopLine) {
            horizontalSegments.push({
              line: aBottomLine,
              visualLine: aBottomLine,
              start: overlapColsStart,
              end: overlapColsEnd,
              topObjectIds: [a.id],
              bottomObjectIds: [b.id],
            });
          } else if (bBottomLine === aTopLine) {
            horizontalSegments.push({
              line: bBottomLine,
              visualLine: bBottomLine,
              start: overlapColsStart,
              end: overlapColsEnd,
              topObjectIds: [b.id],
              bottomObjectIds: [a.id],
            });
          } else if (aBottomLine < bTopLine) {
            const visual = (aBottomLine + bTopLine) / 2;
            horizontalSegments.push({
              line: Math.floor((aBottomLine + bTopLine) / 2),
              visualLine: visual,
              start: overlapColsStart,
              end: overlapColsEnd,
              topObjectIds: [a.id],
              bottomObjectIds: [b.id],
            });
          } else if (bBottomLine < aTopLine) {
            const visual = (bBottomLine + aTopLine) / 2;
            horizontalSegments.push({
              line: Math.floor((bBottomLine + aTopLine) / 2),
              visualLine: visual,
              start: overlapColsStart,
              end: overlapColsEnd,
              topObjectIds: [b.id],
              bottomObjectIds: [a.id],
            });
          }
        }
      }
    }

    const mergeVerticalSegments = (segments: typeof verticalSegments) => {
      const grouped = new Map<number, typeof verticalSegments>();
      for (const segment of segments) {
        const bucket = grouped.get(segment.line) ?? [];
        bucket.push(segment);
        grouped.set(segment.line, bucket);
      }

      const merged: typeof verticalSegments = [];
      grouped.forEach((bucket, line) => {
        const sorted = [...bucket].sort((a, b) => a.start - b.start);
        let current = {
          ...sorted[0],
          leftObjectIds: [...sorted[0].leftObjectIds],
          rightObjectIds: [...sorted[0].rightObjectIds],
          visualLineValues: [sorted[0].visualLine],
        };
        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          if (next.start <= current.end + 1) {
            current.end = Math.max(current.end, next.end);
            current.leftObjectIds = [...new Set([...current.leftObjectIds, ...next.leftObjectIds])];
            current.rightObjectIds = [...new Set([...current.rightObjectIds, ...next.rightObjectIds])];
            current.visualLineValues.push(next.visualLine);
          } else {
            merged.push({
              line: current.line,
              visualLine: current.visualLineValues.reduce((a, b) => a + b, 0) / current.visualLineValues.length,
              start: current.start,
              end: current.end,
              leftObjectIds: current.leftObjectIds,
              rightObjectIds: current.rightObjectIds,
            });
            current = {
              ...next,
              leftObjectIds: [...next.leftObjectIds],
              rightObjectIds: [...next.rightObjectIds],
              visualLineValues: [next.visualLine],
            };
          }
        }
        merged.push({
          line: current.line,
          visualLine: current.visualLineValues.reduce((a, b) => a + b, 0) / current.visualLineValues.length,
          start: current.start,
          end: current.end,
          leftObjectIds: current.leftObjectIds,
          rightObjectIds: current.rightObjectIds,
        });
      });
      return merged;
    };

    const mergeHorizontalSegments = (segments: typeof horizontalSegments) => {
      const grouped = new Map<number, typeof horizontalSegments>();
      for (const segment of segments) {
        const bucket = grouped.get(segment.line) ?? [];
        bucket.push(segment);
        grouped.set(segment.line, bucket);
      }

      const merged: typeof horizontalSegments = [];
      grouped.forEach((bucket, line) => {
        const sorted = [...bucket].sort((a, b) => a.start - b.start);
        let current = {
          ...sorted[0],
          topObjectIds: [...sorted[0].topObjectIds],
          bottomObjectIds: [...sorted[0].bottomObjectIds],
          visualLineValues: [sorted[0].visualLine],
        };
        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          if (next.start <= current.end + 1) {
            current.end = Math.max(current.end, next.end);
            current.topObjectIds = [...new Set([...current.topObjectIds, ...next.topObjectIds])];
            current.bottomObjectIds = [...new Set([...current.bottomObjectIds, ...next.bottomObjectIds])];
            current.visualLineValues.push(next.visualLine);
          } else {
            merged.push({
              line: current.line,
              visualLine: current.visualLineValues.reduce((a, b) => a + b, 0) / current.visualLineValues.length,
              start: current.start,
              end: current.end,
              topObjectIds: current.topObjectIds,
              bottomObjectIds: current.bottomObjectIds,
            });
            current = {
              ...next,
              topObjectIds: [...next.topObjectIds],
              bottomObjectIds: [...next.bottomObjectIds],
              visualLineValues: [next.visualLine],
            };
          }
        }
        merged.push({
          line: current.line,
          visualLine: current.visualLineValues.reduce((a, b) => a + b, 0) / current.visualLineValues.length,
          start: current.start,
          end: current.end,
          topObjectIds: current.topObjectIds,
          bottomObjectIds: current.bottomObjectIds,
        });
      });
      return merged;
    };

    const mergedVertical = mergeVerticalSegments(verticalSegments);
    const mergedHorizontal = mergeHorizontalSegments(horizontalSegments);

    if (mergedVertical.length === 0 && mergedHorizontal.length === 0 && resizable.length === 2) {
      const [a, b] = resizable;
      const aCenterX = a.position.col + a.width / 2;
      const bCenterX = b.position.col + b.width / 2;
      const aCenterY = a.position.row + a.height / 2;
      const bCenterY = b.position.row + b.height / 2;
      const horizontalSplit = Math.abs(aCenterX - bCenterX) >= Math.abs(aCenterY - bCenterY);

      if (horizontalSplit) {
        const leftObj = aCenterX <= bCenterX ? a : b;
        const rightObj = leftObj.id === a.id ? b : a;
        const leftBoundary = leftObj.position.col + leftObj.width;
        const rightBoundary = rightObj.position.col;
        const splitCol = Math.round((leftBoundary + rightBoundary) / 2);
        const spanStart = Math.min(leftObj.position.row, rightObj.position.row);
        const spanEnd = Math.max(
          leftObj.position.row + leftObj.height - 1,
          rightObj.position.row + rightObj.height - 1
        );
        mergedVertical.push({
          line: splitCol,
          visualLine: (leftBoundary + rightBoundary) / 2,
          start: spanStart,
          end: spanEnd,
          leftObjectIds: [leftObj.id],
          rightObjectIds: [rightObj.id],
        });
      } else {
        const topObj = aCenterY <= bCenterY ? a : b;
        const bottomObj = topObj.id === a.id ? b : a;
        const topBoundary = topObj.position.row + topObj.height;
        const bottomBoundary = bottomObj.position.row;
        const splitRow = Math.floor((topBoundary + bottomBoundary) / 2);
        const spanStart = Math.min(topObj.position.col, bottomObj.position.col);
        const spanEnd = Math.max(
          topObj.position.col + topObj.width - 1,
          bottomObj.position.col + bottomObj.width - 1
        );
        mergedHorizontal.push({
          line: splitRow,
          visualLine: (topBoundary + bottomBoundary) / 2,
          start: spanStart,
          end: spanEnd,
          topObjectIds: [topObj.id],
          bottomObjectIds: [bottomObj.id],
        });
      }
    }

    if (mergedVertical.length === 0 && resizable.length >= 2) {
      const sorted = [...resizable].sort(
        (a, b) => (a.position.col + a.width / 2) - (b.position.col + b.width / 2)
      );
      const splitIndex = Math.floor(sorted.length / 2);
      const leftGroup = sorted.slice(0, splitIndex);
      const rightGroup = sorted.slice(splitIndex);
      if (leftGroup.length > 0 && rightGroup.length > 0) {
        const leftBoundary = Math.max(...leftGroup.map(obj => obj.position.col + obj.width));
        const rightBoundary = Math.min(...rightGroup.map(obj => obj.position.col));
        const visual = leftBoundary <= rightBoundary ? (leftBoundary + rightBoundary) / 2 : leftBoundary;
        const spanStart = Math.min(...resizable.map(obj => obj.position.row));
        const spanEnd = Math.max(...resizable.map(obj => obj.position.row + obj.height - 1));
        mergedVertical.push({
          line: Math.round(visual),
          visualLine: visual,
          start: spanStart,
          end: spanEnd,
          leftObjectIds: leftGroup.map(obj => obj.id),
          rightObjectIds: rightGroup.map(obj => obj.id),
        });
      }
    }

    if (mergedHorizontal.length === 0 && resizable.length >= 2) {
      const sorted = [...resizable].sort(
        (a, b) => (a.position.row + a.height / 2) - (b.position.row + b.height / 2)
      );
      const splitIndex = Math.floor(sorted.length / 2);
      const topGroup = sorted.slice(0, splitIndex);
      const bottomGroup = sorted.slice(splitIndex);
      if (topGroup.length > 0 && bottomGroup.length > 0) {
        const topBoundary = Math.max(...topGroup.map(obj => obj.position.row + obj.height));
        const bottomBoundary = Math.min(...bottomGroup.map(obj => obj.position.row));
        const visual = topBoundary <= bottomBoundary ? (topBoundary + bottomBoundary) / 2 : topBoundary;
        const spanStart = Math.min(...resizable.map(obj => obj.position.col));
        const spanEnd = Math.max(...resizable.map(obj => obj.position.col + obj.width - 1));
        mergedHorizontal.push({
          line: Math.floor(visual),
          visualLine: visual,
          start: spanStart,
          end: spanEnd,
          topObjectIds: topGroup.map(obj => obj.id),
          bottomObjectIds: bottomGroup.map(obj => obj.id),
        });
      }
    }

    const intersections: Array<{
      col: number;
      row: number;
      visualCol: number;
      visualRow: number;
      verticalLine: number;
      horizontalLine: number;
      leftObjectIds: string[];
      rightObjectIds: string[];
      topObjectIds: string[];
      bottomObjectIds: string[];
    }> = [];
    for (const v of mergedVertical) {
      for (const h of mergedHorizontal) {
        if (v.line >= h.start && v.line <= h.end && h.line >= v.start && h.line <= v.end) {
          intersections.push({
            col: v.line,
            row: h.line,
            visualCol: v.visualLine,
            visualRow: h.visualLine,
            verticalLine: v.line,
            horizontalLine: h.line,
            leftObjectIds: v.leftObjectIds,
            rightObjectIds: v.rightObjectIds,
            topObjectIds: h.topObjectIds,
            bottomObjectIds: h.bottomObjectIds,
          });
        }
      }
    }

    let centerMultiHandle: null | {
      col: number;
      row: number;
      verticalLine: number;
      horizontalLine: number;
      leftObjectIds: string[];
      rightObjectIds: string[];
      topObjectIds: string[];
      bottomObjectIds: string[];
    } = null;

    if (resizable.length >= 3 && mergedVertical.length > 0 && mergedHorizontal.length > 0) {
      const nearestVertical = [...mergedVertical].sort(
        (a, b) => Math.abs(a.line - groupCenterCol) - Math.abs(b.line - groupCenterCol)
      )[0];
      const nearestHorizontal = [...mergedHorizontal].sort(
        (a, b) => Math.abs(a.line - groupCenterRow) - Math.abs(b.line - groupCenterRow)
      )[0];

      centerMultiHandle = {
        // Anchor the center handle to the active split-line intersection so it moves with drags.
        col: nearestVertical.line,
        row: nearestHorizontal.line,
        visualCol: nearestVertical.visualLine,
        visualRow: nearestHorizontal.visualLine,
        verticalLine: nearestVertical.line,
        horizontalLine: nearestHorizontal.line,
        leftObjectIds: nearestVertical.leftObjectIds,
        rightObjectIds: nearestVertical.rightObjectIds,
        topObjectIds: nearestHorizontal.topObjectIds,
        bottomObjectIds: nearestHorizontal.bottomObjectIds,
      };
    }

    const minCol = Math.min(...resizable.map(obj => obj.position.col));
    const minRow = Math.min(...resizable.map(obj => obj.position.row));
    const maxCol = Math.max(...resizable.map(obj => obj.position.col + obj.width - 1));
    const maxRow = Math.max(...resizable.map(obj => obj.position.row + obj.height - 1));

    return {
      bounds: { minCol, minRow, maxCol, maxRow },
      vertical: mergedVertical,
      horizontal: mergedHorizontal,
      intersections,
      centerMultiHandle,
      selectedIds: new Set(resizable.map(obj => obj.id)),
      resizable,
    };
  }, [selectedObjects]);

  const connectorAnchors = useMemo(() => {
    if (tool !== 'connector') return [];
    return objects
      .filter(obj => obj.type === 'component' || obj.type === 'box')
      .flatMap(obj => {
        const col = obj.position.col;
        const row = obj.position.row;
        const { width, height } = obj;
        const midCol = col + Math.floor(width / 2);
        const midRow = row + Math.floor(height / 2);
        return [
          { key: `${obj.id}-nw`, col, row },
          { key: `${obj.id}-n`, col: midCol, row },
          { key: `${obj.id}-ne`, col: col + width - 1, row },
          { key: `${obj.id}-e`, col: col + width - 1, row: midRow },
          { key: `${obj.id}-se`, col: col + width - 1, row: row + height - 1 },
          { key: `${obj.id}-s`, col: midCol, row: row + height - 1 },
          { key: `${obj.id}-sw`, col, row: row + height - 1 },
          { key: `${obj.id}-w`, col, row: midRow },
        ];
      });
  }, [tool, objects]);

  // Drawing preview
  const isDrawing = dragState.type === 'drawing';
  const drawingTool = isDrawing ? (dragState as { tool: Tool }).tool : null;

  // Box drawing preview (rectangle)
  const boxPreviewStyle = useMemo(() => {
    if (!isDrawing || drawingTool !== 'box') return null;
    const { startCol, startRow } = dragState as { startCol: number; startRow: number };
    const col = Math.min(startCol, cursor.col);
    const row = Math.min(startRow, cursor.row);
    const width = Math.abs(cursor.col - startCol) + 1;
    const height = Math.abs(cursor.row - startRow) + 1;

    return {
      left: col * charWidth * zoom + panX,
      top: row * lineHeight * zoom + panY,
      width: width * charWidth * zoom,
      height: height * lineHeight * zoom,
    };
  }, [isDrawing, drawingTool, dragState, cursor, charWidth, lineHeight, zoom, panX, panY]);

  const routeConnectorPreviewPath = useCallback((start: Position, end: Position): Position[] => {
    if (start.col === end.col && start.row === end.row) return [start, end];

    const pointKey = (col: number, row: number) => `${col},${row}`;
    const obstacleCells = new Set<string>();
    const blockerObjects = objects.filter(obj => obj.type === 'box' || obj.type === 'component' || obj.type === 'text');

    for (const obj of blockerObjects) {
      const bbox = getLineBoundingBox(obj);
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

    obstacleCells.delete(pointKey(start.col, start.row));
    obstacleCells.delete(pointKey(end.col, end.row));

    const extraPad = 25;
    const minCol = Math.max(0, Math.min(start.col, end.col) - extraPad);
    const minRow = Math.max(0, Math.min(start.row, end.row) - extraPad);
    const maxCol = Math.max(start.col, end.col) + extraPad;
    const maxRow = Math.max(start.row, end.row) + extraPad;

    const queue: Position[] = [start];
    const visited = new Set<string>([pointKey(start.col, start.row)]);
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
        if (visited.has(nextKey) || obstacleCells.has(nextKey)) continue;
        visited.add(nextKey);
        parent.set(nextKey, pointKey(current.col, current.row));
        if (nextCol === end.col && nextRow === end.row) {
          found = true;
          break;
        }
        queue.push({ col: nextCol, row: nextRow });
      }
    }

    if (!found) {
      if (start.col === end.col || start.row === end.row) return [start, end];
      return [start, { col: end.col, row: start.row }, end];
    }

    const fullPath: Position[] = [];
    let cursorKey = pointKey(end.col, end.row);
    fullPath.push(end);
    while (cursorKey !== pointKey(start.col, start.row)) {
      const prevKey = parent.get(cursorKey);
      if (!prevKey) break;
      const [prevColStr, prevRowStr] = prevKey.split(',');
      fullPath.push({ col: parseInt(prevColStr, 10), row: parseInt(prevRowStr, 10) });
      cursorKey = prevKey;
    }
    fullPath.reverse();

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
    return turns;
  }, [objects]);

  // Line/Arrow/Connector drawing preview
  const linePreview = useMemo(() => {
    if (!isDrawing || (drawingTool !== 'line' && drawingTool !== 'arrow' && drawingTool !== 'connector')) return null;
    const { startCol, startRow } = dragState as { startCol: number; startRow: number };
    const toScreen = (col: number, row: number) => ({
      x: col * charWidth * zoom + panX + charWidth * zoom / 2,
      y: row * lineHeight * zoom + panY + lineHeight * zoom / 2,
    });

    const createSegment = (fromX: number, fromY: number, toX: number, toY: number) => {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return { left: fromX, top: fromY, width: length, angle };
    };

    if (drawingTool === 'connector') {
      const path = routeConnectorPreviewPath(
        { col: startCol, row: startRow },
        { col: cursor.col, row: cursor.row }
      );
      const points = path.map(p => toScreen(p.col, p.row));
      const segments = points.slice(0, -1).map((point, index) =>
        createSegment(point.x, point.y, points[index + 1].x, points[index + 1].y)
      ).filter(segment => segment.width > 0);
      const startPoint = points[0];
      const endPoint = points[points.length - 1];
      return {
        segments,
        isArrow: false,
        startX: startPoint.x,
        startY: startPoint.y,
        endX: endPoint.x,
        endY: endPoint.y,
      };
    }

    const { x: startX, y: startY } = toScreen(startCol, startRow);
    const { x: endX, y: endY } = toScreen(cursor.col, cursor.row);
    const main = createSegment(startX, startY, endX, endY);

    return {
      segments: [main],
      isArrow: drawingTool === 'arrow',
      startX,
      startY,
      endX,
      endY,
    };
  }, [isDrawing, drawingTool, dragState, cursor, charWidth, lineHeight, zoom, panX, panY, routeConnectorPreviewPath]);

  // Handle resize handle mouse down
  const handleResizeHandleDown = useCallback((e: React.MouseEvent, obj: CanvasObject, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    let handleCol = obj.position.col;
    let handleRow = obj.position.row;
    const midCol = Math.floor(obj.width / 2);
    const midRow = Math.floor(obj.height / 2);

    switch (handle) {
      case 'nw': handleCol = obj.position.col; handleRow = obj.position.row; break;
      case 'n': handleCol = obj.position.col + midCol; handleRow = obj.position.row; break;
      case 'ne': handleCol = obj.position.col + obj.width - 1; handleRow = obj.position.row; break;
      case 'e': handleCol = obj.position.col + obj.width - 1; handleRow = obj.position.row + midRow; break;
      case 'se': handleCol = obj.position.col + obj.width - 1; handleRow = obj.position.row + obj.height - 1; break;
      case 's': handleCol = obj.position.col + midCol; handleRow = obj.position.row + obj.height - 1; break;
      case 'sw': handleCol = obj.position.col; handleRow = obj.position.row + obj.height - 1; break;
      case 'w': handleCol = obj.position.col; handleRow = obj.position.row + midRow; break;
    }

    handleCellMouseDown(handleCol, handleRow, handle);
  }, [handleCellMouseDown]);

  const getHandleCursor = (handle: ResizeHandle): string => {
    switch (handle) {
      case 'nw': return 'nw-resize';
      case 'n': return 'n-resize';
      case 'ne': return 'ne-resize';
      case 'e': return 'e-resize';
      case 'se': return 'se-resize';
      case 's': return 's-resize';
      case 'sw': return 'sw-resize';
      case 'w': return 'w-resize';
      default: return 'default';
    }
  };

  // Handle line/arrow start/end point dragging
  const handleLineHandleDown = useCallback((e: React.MouseEvent, obj: CanvasObject, point: 'start' | 'end') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);

    if (point === 'start') {
      // Dragging start point - resize from start (move start, keep end fixed)
      handleCellMouseDown(obj.position.col, obj.position.row, 'nw' as ResizeHandle);
    } else {
      // Dragging end point
      let endCol = obj.endPosition?.col ?? obj.position.col;
      let endRow = obj.endPosition?.row ?? obj.position.row;
      if (obj.rotation !== undefined) {
        const length = getLineLength(obj);
        const rad = (obj.rotation * Math.PI) / 180;
        endCol = obj.position.col + Math.round(Math.cos(rad) * length);
        endRow = obj.position.row + Math.round(Math.sin(rad) * length);
      }
      handleCellMouseDown(endCol, endRow, 'se' as ResizeHandle); // Use 'se' as end point handle
    }
  }, [handleCellMouseDown]);

  const handleGroupResizeDown = useCallback((
    e: React.MouseEvent,
    col: number,
    row: number,
    groupHandle: GroupResizeHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const resizableSelected = selectedObjects.filter(
      obj => obj.type === 'box' || obj.type === 'component'
    );

    let nextHandle: GroupResizeHandle = { ...groupHandle };

    if (groupHandle.verticalLine !== undefined) {
      const line = groupHandle.verticalLine;
      const rowFiltered = resizableSelected.filter(obj => (
        row >= obj.position.row && row <= obj.position.row + obj.height - 1
      ));
      let leftIds = rowFiltered
        .filter(obj => obj.position.col + obj.width / 2 < line)
        .map(obj => obj.id);
      let rightIds = rowFiltered
        .filter(obj => obj.position.col + obj.width / 2 >= line)
        .map(obj => obj.id);
      if (leftIds.length === 0 || rightIds.length === 0) {
        leftIds = resizableSelected
          .filter(obj => obj.position.col + obj.width / 2 < line)
          .map(obj => obj.id);
        rightIds = resizableSelected
          .filter(obj => obj.position.col + obj.width / 2 >= line)
          .map(obj => obj.id);
      }
      if (leftIds.length > 0 && rightIds.length > 0) {
        nextHandle = { ...nextHandle, leftObjectIds: leftIds, rightObjectIds: rightIds };
      }
    }

    if (groupHandle.horizontalLine !== undefined) {
      const line = groupHandle.horizontalLine;
      const colFiltered = resizableSelected.filter(obj => (
        col >= obj.position.col && col <= obj.position.col + obj.width - 1
      ));
      let topIds = colFiltered
        .filter(obj => obj.position.row + obj.height / 2 < line)
        .map(obj => obj.id);
      let bottomIds = colFiltered
        .filter(obj => obj.position.row + obj.height / 2 >= line)
        .map(obj => obj.id);
      if (topIds.length === 0 || bottomIds.length === 0) {
        topIds = resizableSelected
          .filter(obj => obj.position.row + obj.height / 2 < line)
          .map(obj => obj.id);
        bottomIds = resizableSelected
          .filter(obj => obj.position.row + obj.height / 2 >= line)
          .map(obj => obj.id);
      }
      if (topIds.length > 0 && bottomIds.length > 0) {
        nextHandle = { ...nextHandle, topObjectIds: topIds, bottomObjectIds: bottomIds };
      }
    }

    handleCellMouseDown(col, row, null, nextHandle);
  }, [handleCellMouseDown, selectedObjects]);

  return (
    <div
      className="relative flex-1 overflow-hidden bg-bg"
      ref={containerRef}
      onContextMenu={handleContextMenu}
    >
      {/* Hidden measurement element */}
      <span
        ref={measureRef}
        className="absolute invisible font-mono"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: `${14 * zoom}px`,
          lineHeight: '1.5',
        }}
      >
        X
      </span>

      {/* Grid dot pattern background */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: panX,
          top: panY,
          width: gridWidth * zoom,
          height: gridHeight * zoom,
          backgroundImage: 'radial-gradient(circle, rgb(var(--color-grid-dot, 19 19 32)) 1px, transparent 1px)',
          backgroundSize: `${charWidth * zoom}px ${lineHeight * zoom}px`,
        }}
      />

      {/* Grid content */}
      <pre
        className="absolute m-0 p-0 font-mono pointer-events-none select-none"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: `${14 * zoom}px`,
          lineHeight: '1.5',
          left: panX,
          top: panY,
          color: 'rgb(var(--color-text, 224 224 232))',
        }}
      >
        {grid.map((row, rowIdx) => (
          <div key={rowIdx}>
            {row.join('')}
          </div>
        )).slice(0, gridSize.rows)}
      </pre>

      {/* Empty state instruction */}
      {objects.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
          <div className="text-text-dim text-sm font-mono bg-surface/80 px-4 py-2 rounded-lg border border-border backdrop-blur-sm shadow-sm">
            Press <strong className="text-text font-bold">B</strong> to draw a box, or <strong className="text-text font-bold">T</strong> to add text
          </div>
        </div>
      )}

      {/* Connector anchor dots (visible while connector tool active) */}
      {connectorAnchors.map(anchor => (
        <div
          key={anchor.key}
          className="absolute pointer-events-none"
          style={{
            left: anchor.col * charWidth * zoom + panX + (charWidth * zoom) / 2 - HANDLE_SIZE / 2,
            top: anchor.row * lineHeight * zoom + panY + (lineHeight * zoom) / 2 - HANDLE_SIZE / 2,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            borderRadius: '50%',
            background: '#facc15',
            border: '1px solid #0a0a0f',
            opacity: 1,
            zIndex: 20,
          }}
        />
      ))}

      {/* Selection overlays - different styles per object type */}
      {showSelectionControls && groupResizeModel && (
        <>
          <div
            className="absolute rounded-sm pointer-events-none"
            style={{
              left: groupResizeModel.bounds.minCol * charWidth * zoom + panX,
              top: groupResizeModel.bounds.minRow * lineHeight * zoom + panY,
              width: (groupResizeModel.bounds.maxCol - groupResizeModel.bounds.minCol + 1) * charWidth * zoom,
              height: (groupResizeModel.bounds.maxRow - groupResizeModel.bounds.minRow + 1) * lineHeight * zoom,
              border: '1px solid rgb(var(--color-selection-border, 108 138 255) / 0.65)',
              boxShadow: '0 0 0 1px rgb(var(--color-selection, 108 138 255) / 0.12) inset',
            }}
          />

          {groupResizeModel.vertical.map((segment, idx) => {
            const computedLeftIds = groupResizeModel.resizable
              .filter(obj => (
                obj.position.col + obj.width === segment.line
                && obj.position.row <= segment.end
                && (obj.position.row + obj.height - 1) >= segment.start
              ))
              .map(obj => obj.id);
            const computedRightIds = groupResizeModel.resizable
              .filter(obj => (
                obj.position.col === segment.line
                && obj.position.row <= segment.end
                && (obj.position.row + obj.height - 1) >= segment.start
              ))
              .map(obj => obj.id);
            const leftIds = segment.leftObjectIds ?? computedLeftIds;
            const rightIds = segment.rightObjectIds ?? computedRightIds;
            const splitX = segment.visualLine * charWidth * zoom + panX;
            const top = segment.start * lineHeight * zoom + panY;
            const height = (segment.end - segment.start + 1) * lineHeight * zoom;
            const segmentMidY = top + height / 2;
            const midRow = Math.round((segment.start + segment.end) / 2);
            return (
              <div key={`v-${segment.line}-${idx}`}>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: splitX - 0.5,
                    top,
                    width: 1,
                    height,
                    background: 'rgb(var(--color-selection-border, 108 138 255) / 0.7)',
                  }}
                />
                <div
                  className="absolute pointer-events-auto hover:bg-white"
                  style={{
                    left: splitX - GROUP_HANDLE_SIZE / 2,
                    top: segmentMidY - GROUP_HANDLE_SIZE / 2,
                    width: GROUP_HANDLE_SIZE,
                    height: GROUP_HANDLE_SIZE,
                    background: 'rgb(var(--color-accent, 108 138 255))',
                    border: '1px solid rgb(var(--color-bg, 10 10 15))',
                    borderRadius: '9999px',
                    boxShadow: '0 0 0 1px rgb(var(--color-selection, 108 138 255) / 0.15)',
                    cursor: 'col-resize',
                    zIndex: 60,
                    touchAction: 'none',
                  }}
                  onMouseDownCapture={(e) => handleGroupResizeDown(e, segment.line, midRow, {
                    axis: 'vertical',
                    verticalLine: segment.line,
                    leftObjectIds: leftIds,
                    rightObjectIds: rightIds,
                  })}
                />
              </div>
            );
          })}

          {groupResizeModel.horizontal.map((segment, idx) => {
            const computedTopIds = groupResizeModel.resizable
              .filter(obj => (
                obj.position.row + obj.height === segment.line
                && obj.position.col <= segment.end
                && (obj.position.col + obj.width - 1) >= segment.start
              ))
              .map(obj => obj.id);
            const computedBottomIds = groupResizeModel.resizable
              .filter(obj => (
                obj.position.row === segment.line
                && obj.position.col <= segment.end
                && (obj.position.col + obj.width - 1) >= segment.start
              ))
              .map(obj => obj.id);
            const topIds = segment.topObjectIds ?? computedTopIds;
            const bottomIds = segment.bottomObjectIds ?? computedBottomIds;
            const left = segment.start * charWidth * zoom + panX;
            const width = (segment.end - segment.start + 1) * charWidth * zoom;
            const splitY = segment.visualLine * lineHeight * zoom + panY;
            const segmentMidX = left + width / 2;
            const midCol = Math.round((segment.start + segment.end) / 2);
            return (
              <div key={`h-${segment.line}-${idx}`}>
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left,
                    top: splitY - 0.5,
                    width,
                    height: 1,
                    background: 'rgb(var(--color-selection-border, 108 138 255) / 0.7)',
                  }}
                />
                <div
                  className="absolute pointer-events-auto hover:bg-white"
                  style={{
                    left: segmentMidX - GROUP_HANDLE_SIZE / 2,
                    top: splitY - GROUP_HANDLE_SIZE / 2,
                    width: GROUP_HANDLE_SIZE,
                    height: GROUP_HANDLE_SIZE,
                    background: 'rgb(var(--color-accent, 108 138 255))',
                    border: '1px solid rgb(var(--color-bg, 10 10 15))',
                    borderRadius: '9999px',
                    boxShadow: '0 0 0 1px rgb(var(--color-selection, 108 138 255) / 0.15)',
                    cursor: 'row-resize',
                    zIndex: 60,
                    touchAction: 'none',
                  }}
                  onMouseDownCapture={(e) => handleGroupResizeDown(e, midCol, segment.line, {
                    axis: 'horizontal',
                    horizontalLine: segment.line,
                    topObjectIds: topIds,
                    bottomObjectIds: bottomIds,
                  })}
                />
              </div>
            );
          })}

          {groupResizeModel.intersections.map((point, idx) => (
            <div
              key={`x-${point.verticalLine}-${point.horizontalLine}-${idx}`}
              className="absolute pointer-events-auto hover:bg-white"
              style={{
                left: point.visualCol * charWidth * zoom + panX - INTERSECTION_HANDLE_SIZE / 2,
                top: point.visualRow * lineHeight * zoom + panY - INTERSECTION_HANDLE_SIZE / 2,
                width: INTERSECTION_HANDLE_SIZE,
                height: INTERSECTION_HANDLE_SIZE,
                background: 'rgb(var(--color-accent, 108 138 255))',
                border: '1px solid rgb(var(--color-bg, 10 10 15))',
                borderRadius: '50%',
                boxShadow: '0 0 0 1px rgb(var(--color-selection, 108 138 255) / 0.15)',
                cursor: 'nwse-resize',
                zIndex: 60,
                touchAction: 'none',
              }}
              onMouseDownCapture={(e) => handleGroupResizeDown(e, point.col, point.row, {
                axis: 'intersection',
                verticalLine: point.verticalLine,
                horizontalLine: point.horizontalLine,
                leftObjectIds: point.leftObjectIds,
                rightObjectIds: point.rightObjectIds,
                topObjectIds: point.topObjectIds,
                bottomObjectIds: point.bottomObjectIds,
              })}
            />
          ))}

          {groupResizeModel.centerMultiHandle && (() => {
            const centerHandle = groupResizeModel.centerMultiHandle;
            return (
              <div
                className="absolute pointer-events-auto hover:bg-white"
                style={{
                  left: centerHandle.visualCol * charWidth * zoom + panX - GROUP_HANDLE_SIZE / 2,
                  top: centerHandle.visualRow * lineHeight * zoom + panY - GROUP_HANDLE_SIZE / 2,
                  width: GROUP_HANDLE_SIZE,
                  height: GROUP_HANDLE_SIZE,
                  background: 'rgb(var(--color-accent, 108 138 255))',
                  border: '1px solid rgb(var(--color-bg, 10 10 15))',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 1px rgb(var(--color-selection, 108 138 255) / 0.2)',
                  cursor: 'move',
                  zIndex: 65,
                  touchAction: 'none',
                }}
                onMouseDownCapture={(e) => handleGroupResizeDown(
                  e,
                  centerHandle.col,
                  centerHandle.row,
                  {
                    axis: 'intersection',
                    verticalLine: centerHandle.verticalLine,
                    horizontalLine: centerHandle.horizontalLine,
                    leftObjectIds: centerHandle.leftObjectIds,
                    rightObjectIds: centerHandle.rightObjectIds,
                    topObjectIds: centerHandle.topObjectIds,
                    bottomObjectIds: centerHandle.bottomObjectIds,
                  }
                )}
                title="Multi-resize (both axes)"
              />
            );
          })()}
        </>
      )}

      {showSelectionControls && selectedObjects.map(obj => {
        const left = obj.position.col * charWidth * zoom + panX;
        const top = obj.position.row * lineHeight * zoom + panY;
        const width = obj.width * charWidth * zoom;
        const height = obj.height * lineHeight * zoom;

        // Box/Component: Full box with 8 resize handles
        if (obj.type === 'box' || obj.type === 'component') {
          const useGroupHandles = !!groupResizeModel && groupResizeModel.selectedIds.has(obj.id);
          return (
            <div
              key={obj.id}
              className="absolute rounded-sm pointer-events-none"
              style={{
                left,
                top,
                width,
                height,
                border: '1px solid rgb(var(--color-selection-border, 108 138 255) / 0.5)',
                background: 'rgb(var(--color-selection, 108 138 255) / 0.15)',
              }}
            >
              {!useGroupHandles && ([
                { key: 'nw' as ResizeHandle, left: 4, top: 4 },
                { key: 'ne' as ResizeHandle, left: width - 4 - 7, top: 4 },
                { key: 'sw' as ResizeHandle, left: 4, top: height - 4 - 7 },
                { key: 'se' as ResizeHandle, left: width - 4 - 7, top: height - 4 - 7 },
                { key: 'n' as ResizeHandle, left: width / 2 - 3.5, top: 4 },
                { key: 's' as ResizeHandle, left: width / 2 - 3.5, top: height - 4 - 7 },
                { key: 'w' as ResizeHandle, left: 4, top: height / 2 - 3.5 },
                { key: 'e' as ResizeHandle, left: width - 4 - 7, top: height / 2 - 3.5 },
              ]).map(handle => (
                <div
                  key={handle.key}
                  className="absolute pointer-events-auto hover:bg-white"
                  style={{
                    left: handle.left,
                    top: handle.top,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    background: 'rgb(var(--color-accent, 108 138 255))',
                    border: '1px solid rgb(var(--color-bg, 10 10 15))',
                    borderRadius: '50%',
                    cursor: getHandleCursor(handle.key),
                  }}
                  onMouseDown={(e) => handleResizeHandleDown(e, obj, handle.key)}
                />
              ))}
            </div>
          );
        }

        // Line/Arrow: Visual line preview + handles
        if (obj.type === 'line' || obj.type === 'arrow') {
          const bbox = getLineBoundingBox(obj);
          const boxLeft = bbox.col * charWidth * zoom + panX;
          const boxTop = bbox.row * lineHeight * zoom + panY;
          const boxWidth = bbox.width * charWidth * zoom;
          const boxHeight = bbox.height * lineHeight * zoom;

          // Calculate end position
          let endCol = obj.endPosition?.col;
          let endRow = obj.endPosition?.row;
          if (obj.rotation !== undefined) {
            const length = getLineLength(obj);
            const rad = (obj.rotation * Math.PI) / 180;
            endCol = obj.position.col + Math.round(Math.cos(rad) * length);
            endRow = obj.position.row + Math.round(Math.sin(rad) * length);
          }

          const startX = obj.position.col * charWidth * zoom + panX + charWidth * zoom / 2;
          const startY = obj.position.row * lineHeight * zoom + panY + lineHeight * zoom / 2;
          const endX = (endCol ?? obj.position.col) * charWidth * zoom + panX + charWidth * zoom / 2;
          const endY = (endRow ?? obj.position.row) * lineHeight * zoom + panY + lineHeight * zoom / 2;

          const dx = endX - startX;
          const dy = endY - startY;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          const connectorSegments = (obj.isConnector && obj.connectorPath && obj.connectorPath.length >= 2)
            ? obj.connectorPath.slice(0, -1).map((point, idx) => {
              const next = obj.connectorPath![idx + 1];
              const x1 = point.col * charWidth * zoom + panX + charWidth * zoom / 2;
              const y1 = point.row * lineHeight * zoom + panY + lineHeight * zoom / 2;
              const x2 = next.col * charWidth * zoom + panX + charWidth * zoom / 2;
              const y2 = next.row * lineHeight * zoom + panY + lineHeight * zoom / 2;
              const segDx = x2 - x1;
              const segDy = y2 - y1;
              return {
                left: x1,
                top: y1,
                width: Math.sqrt(segDx * segDx + segDy * segDy),
                angle: Math.atan2(segDy, segDx) * 180 / Math.PI,
              };
            }).filter(seg => seg.width > 0)
            : [];

          const startLeft = obj.position.col * charWidth * zoom + panX - 3.5;
          const startTop = obj.position.row * lineHeight * zoom + panY - 3.5;
          const endLeft = (endCol ?? obj.position.col) * charWidth * zoom + panX - 3.5;
          const endTop = (endRow ?? obj.position.row) * lineHeight * zoom + panY - 3.5;

          return (
            <div key={obj.id}>
              {/* Dashed bounding box */}
              <div
                className="absolute rounded-sm pointer-events-none"
                style={{
                  left: boxLeft,
                  top: boxTop,
                  width: boxWidth,
                  height: boxHeight,
                  border: '1px dashed rgb(var(--color-selection-border, 108 138 255) / 0.3)',
                }}
              />
              {/* Visual line/connector */}
              {obj.isConnector ? (
                <>
                  {connectorSegments.map((segment, idx) => (
                    <div
                      key={idx}
                      className="absolute pointer-events-none"
                      style={{
                        left: segment.left,
                        top: segment.top,
                        width: segment.width,
                        height: 2 * zoom,
                        background: 'rgb(var(--color-accent, 108 138 255))',
                        transformOrigin: '0 50%',
                        transform: `rotate(${segment.angle}deg)`,
                        opacity: 0.6,
                      }}
                    />
                  ))}
                </>
              ) : (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: startX,
                    top: startY,
                    width: length,
                    height: 2 * zoom,
                    background: 'rgb(var(--color-accent, 108 138 255))',
                    transformOrigin: '0 50%',
                    transform: `rotate(${angle}deg)`,
                    opacity: 0.6,
                  }}
                />
              )}
              {/* Arrow head for arrows */}
              {obj.type === 'arrow' && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: endX,
                    top: endY,
                    width: 0,
                    height: 0,
                    borderLeft: `${5 * zoom}px solid transparent`,
                    borderRight: `${5 * zoom}px solid transparent`,
                    borderTop: `${7 * zoom}px solid rgb(var(--color-accent, 108 138 255))`,
                    transformOrigin: '50% 0%',
                    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
                    opacity: 0.6,
                  }}
                />
              )}
              {/* Start point handle */}
              <div
                className="absolute pointer-events-auto hover:bg-white"
                style={{
                  left: startLeft,
                  top: startTop,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  background: 'rgb(var(--color-accent, 108 138 255))',
                  border: '1px solid rgb(var(--color-bg, 10 10 15))',
                  borderRadius: '50%',
                  cursor: 'move',
                }}
                onMouseDown={(e) => handleLineHandleDown(e, obj, 'start')}
              />
              {/* End point handle */}
              <div
                className="absolute pointer-events-auto hover:bg-white"
                style={{
                  left: endLeft,
                  top: endTop,
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  background: 'rgb(var(--color-accent, 108 138 255))',
                  border: '1px solid rgb(var(--color-bg, 10 10 15))',
                  borderRadius: '50%',
                  cursor: 'move',
                }}
                onMouseDown={(e) => handleLineHandleDown(e, obj, 'end')}
              />
            </div>
          );
        }

        // Text: Minimal highlight, no resize handles
        if (obj.type === 'text') {
          return (
            <div
              key={obj.id}
              className="absolute pointer-events-none"
              style={{
                left,
                top,
                width,
                height,
                background: 'rgb(var(--color-selection, 108 138 255) / 0.25)',
                borderRadius: '2px',
              }}
            />
          );
        }

        if (obj.type === 'pencil') {
          return (
            <div
              key={obj.id}
              className="absolute pointer-events-none"
              style={{
                left,
                top,
                width,
                height,
                border: '1px dashed rgb(var(--color-selection-border, 108 138 255) / 0.5)',
                background: 'rgb(var(--color-selection, 108 138 255) / 0.1)',
                borderRadius: '2px',
              }}
            />
          );
        }

        return null;
      })}

      {/* Box drawing preview */}
      {boxPreviewStyle && (
        <div
          className="absolute border border-dashed pointer-events-none"
          style={{
            left: boxPreviewStyle.left,
            top: boxPreviewStyle.top,
            width: boxPreviewStyle.width,
            height: boxPreviewStyle.height,
            borderColor: 'rgb(var(--color-selection-border, 108 138 255) / 0.5)',
            background: 'rgb(var(--color-selection, 108 138 255) / 0.15)',
          }}
        />
      )}

      {/* Line/Arrow/Connector drawing preview */}
      {linePreview && (
        <div className="absolute pointer-events-none">
          {/* Connector/Line segments */}
          {linePreview.segments.map((segment, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: segment.left,
                top: segment.top,
                width: segment.width,
                height: 2 * zoom,
                background: 'rgb(var(--color-accent, 108 138 255))',
                transformOrigin: '0 50%',
                transform: `rotate(${segment.angle}deg)`,
              }}
            />
          ))}
          {/* Arrow head */}
          {linePreview.isArrow && linePreview.segments.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: linePreview.endX,
                top: linePreview.endY,
                width: 0,
                height: 0,
                borderLeft: `${6 * zoom}px solid transparent`,
                borderRight: `${6 * zoom}px solid transparent`,
                borderTop: `${8 * zoom}px solid rgb(var(--color-accent, 108 138 255))`,
                transformOrigin: '50% 0%',
                transform: `translate(-50%, -50%) rotate(${linePreview.segments[linePreview.segments.length - 1].angle + 90}deg)`,
              }}
            />
          )}
          {/* Start point handle */}
          <div
            style={{
              position: 'absolute',
              left: linePreview.startX - 3.5,
              top: linePreview.startY - 3.5,
              width: 7,
              height: 7,
              background: 'rgb(var(--color-accent, 108 138 255))',
              border: '1px solid rgb(var(--color-bg, 10 10 15))',
              borderRadius: '50%',
            }}
          />
          {/* End point handle */}
          <div
            style={{
              position: 'absolute',
              left: linePreview.endX - 3.5,
              top: linePreview.endY - 3.5,
              width: 7,
              height: 7,
              background: 'rgb(var(--color-accent, 108 138 255))',
              border: '1px solid rgb(var(--color-bg, 10 10 15))',
              borderRadius: '50%',
            }}
          />
        </div>
      )}

      {/* Text editing mini modal popup */}
      {editingObjectId && (() => {
        const editingObj = objects.find(obj => obj.id === editingObjectId);
        if (!editingObj || editingObj.type !== 'text') return null;
        const textLeft = editingObj.position.col * charWidth * zoom + panX;
        const textTop = editingObj.position.row * lineHeight * zoom + panY;
        const textWidth = Math.max(editingObj.width * charWidth * zoom, 100);

        return (
          <TextEditPopup
            value={editingObj.content || ''}
            onChange={(value) => onUpdateObject?.(editingObj.id, { content: value })}
            onClose={() => setEditingObjectId?.(null)}
            textLeft={textLeft}
            textTop={textTop}
            textWidth={textWidth}
            zoom={zoom}
          />
        );
      })()}

      {/* Marquee selection rectangle */}
      {marquee && (() => {
        const minCol = Math.min(marquee.startCol, marquee.endCol);
        const maxCol = Math.max(marquee.startCol, marquee.endCol);
        const minRow = Math.min(marquee.startRow, marquee.endRow);
        const maxRow = Math.max(marquee.startRow, marquee.endRow);
        const mLeft = minCol * charWidth * zoom + panX;
        const mTop = minRow * lineHeight * zoom + panY;
        const mWidth = (maxCol - minCol + 1) * charWidth * zoom;
        const mHeight = (maxRow - minRow + 1) * lineHeight * zoom;
        return (
          <div
            className="absolute pointer-events-none"
            style={{
              left: mLeft,
              top: mTop,
              width: mWidth,
              height: mHeight,
              border: '1px dashed rgba(108, 138, 255, 0.7)',
              background: 'rgba(108, 138, 255, 0.1)',
              borderRadius: '2px',
            }}
          />
        );
      })()}

      {/* Smart alignment guides while moving/resizing */}
      {objects.length > 1 && alignmentGuides.map((guide, idx) => {
        if (guide.orientation === 'vertical') {
          return (
            <div
              key={`guide-v-${idx}`}
              className="absolute pointer-events-none"
              style={{
                left: guide.at * charWidth * zoom + panX + (charWidth * zoom) / 2,
                top: panY,
                width: 1,
                height: gridHeight * zoom,
                background: 'rgb(var(--color-accent, 108 138 255))',
                opacity: 0.9,
                zIndex: 25,
              }}
            />
          );
        }
        return (
          <div
            key={`guide-h-${idx}`}
            className="absolute pointer-events-none"
            style={{
              left: panX,
              top: guide.at * lineHeight * zoom + panY + (lineHeight * zoom) / 2,
              width: gridWidth * zoom,
              height: 1,
              background: 'rgb(var(--color-accent, 108 138 255))',
              opacity: 0.9,
              zIndex: 25,
            }}
          />
        );
      })}

      {/* Interaction overlay - disabled when editing text */}
      {!editingObjectId && (
        <div
          className="absolute inset-0"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'crosshair' : 'crosshair' }}
        />
      )}
    </div>
  );
};

// Mini modal popup for text editing
interface TextEditPopupProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  textLeft: number;
  textTop: number;
  textWidth: number;
  zoom: number;
}

const TextEditPopup: React.FC<TextEditPopupProps> = ({
  value,
  onChange,
  onClose,
  textLeft,
  textTop,
  textWidth,
  zoom,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialValueRef = useRef(value);
  const initialRowsRef = useRef(Math.max(value.split('\n').length, 1));

  // Focus textarea on mount - single attempt
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 10);
    return () => clearTimeout(timer);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Use initial rows for stable popup position, not current value rows
  const rows = Math.min(initialRowsRef.current + 2, 8);

  // Fixed popup position based on initial text position (not content)
  const popupWidth = Math.max(200, textWidth + 40);
  const popupLeft = textLeft - (popupWidth - textWidth) / 2;
  const popupTop = textTop - 80; // Fixed offset above text

  // Handle change with comparison to avoid unnecessary updates
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div
      className="absolute z-50 bg-surface border border-border rounded-lg shadow-lg p-3"
      onMouseDown={(e) => e.stopPropagation()} // Prevent canvas click
      onClick={(e) => e.stopPropagation()}
      style={{
        left: Math.max(10, popupLeft),
        top: Math.max(10, popupTop),
        minWidth: `${popupWidth}px`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs text-text-dim uppercase tracking-wider">Edit Text</span>
        <button
          onClick={onClose}
          className="text-text-dim hover:text-text text-xs px-1 rounded hover:bg-surface-hover"
        >
          ✕
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={rows}
        className="w-full bg-bg border border-border rounded px-2 py-1 text-xs text-text font-mono focus:border-accent outline-none resize-none"
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          minHeight: '60px',
        }}
        placeholder="Type text..."
      />
      <div className="flex justify-between items-center mt-2">
        <span className="text-2xs text-text-dim">Press Esc to close</span>
        <button
          onClick={onClose}
          className="text-2xs bg-accent text-bg px-3 py-1 rounded hover:bg-accent/80 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default Canvas;
