import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { Grid, Position, CanvasObject, DragState, ResizeHandle, Tool } from '../types';
import { getLineLength } from '../utils/boxDrawing';
import type { MarqueeState } from '../hooks/useCanvas';

// Helper to get line bounding box for selection display
function getLineBoundingBox(obj: CanvasObject): { col: number; row: number; width: number; height: number } {
  if ((obj.type !== 'line' && obj.type !== 'arrow')) {
    return { col: obj.position.col, row: obj.position.row, width: obj.width, height: obj.height };
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
  selectedIds: Set<string>;
  dragState: DragState;
  zoom: number;
  panX: number;
  panY: number;
  cursor: Position;
  gridSize: { cols: number; rows: number };
  handleCellMouseDown: (col: number, row: number, handle?: ResizeHandle | null) => void;
  handleCellMouseMove: (col: number, row: number) => void;
  handleCellMouseUp: () => void;
  editingObjectId?: string | null;
  setEditingObjectId?: (id: string | null) => void;
  onUpdateObject?: (id: string, updates: Partial<CanvasObject>) => void;
  marquee?: MarqueeState | null;
  panViewport?: (dx: number, dy: number) => void;
}

const HANDLE_SIZE = 7;

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
  panViewport,
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
    return { col: Math.max(0, col), row: Math.max(0, row) };
  }, [panX, panY, zoom, charWidth, lineHeight]);

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

  // Selected objects for rendering selection boxes
  const selectedObjects = useMemo(() => {
    return objects.filter(obj => selectedIds.has(obj.id));
  }, [objects, selectedIds]);

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

  // Line/Arrow drawing preview (line from start to cursor)
  const linePreview = useMemo(() => {
    if (!isDrawing || (drawingTool !== 'line' && drawingTool !== 'arrow')) return null;
    const { startCol, startRow } = dragState as { startCol: number; startRow: number };
    const startX = startCol * charWidth * zoom + panX + charWidth * zoom / 2;
    const startY = startRow * lineHeight * zoom + panY + lineHeight * zoom / 2;
    const endX = cursor.col * charWidth * zoom + panX + charWidth * zoom / 2;
    const endY = cursor.row * lineHeight * zoom + panY + lineHeight * zoom / 2;

    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    return {
      left: startX,
      top: startY,
      width: length,
      angle,
      isArrow: drawingTool === 'arrow',
    };
  }, [isDrawing, drawingTool, dragState, cursor, charWidth, lineHeight, zoom, panX, panY]);

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

  return (
    <div
      className="relative flex-1 overflow-hidden bg-bg"
      ref={containerRef}
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
          backgroundImage: 'radial-gradient(circle, var(--color-grid-dot, #131320) 1px, transparent 1px)',
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
          color: '#e0e0e8',
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

      {/* Selection overlays - different styles per object type */}
      {selectedObjects.map(obj => {
        const left = obj.position.col * charWidth * zoom + panX;
        const top = obj.position.row * lineHeight * zoom + panY;
        const width = obj.width * charWidth * zoom;
        const height = obj.height * lineHeight * zoom;

        // Box/Component: Full box with 8 resize handles
        if (obj.type === 'box' || obj.type === 'component') {
          return (
            <div
              key={obj.id}
              className="absolute rounded-sm pointer-events-none"
              style={{
                left,
                top,
                width,
                height,
                border: '1px solid var(--color-selection-border, rgba(108, 138, 255, 0.5))',
                background: 'var(--color-selection, rgba(108, 138, 255, 0.15))',
              }}
            >
              {/* 8 Resize handles */}
              {([
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
                    background: 'var(--color-accent, #6c8aff)',
                    border: '1px solid var(--color-bg, #0a0a0f)',
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
                  border: '1px dashed var(--color-selection-border, rgba(108, 138, 255, 0.3))',
                }}
              />
              {/* Visual line */}
              <div
                className="absolute pointer-events-none"
                style={{
                  left: startX,
                  top: startY,
                  width: length,
                  height: 2 * zoom,
                  background: 'var(--color-accent, #6c8aff)',
                  transformOrigin: '0 50%',
                  transform: `rotate(${angle}deg)`,
                  opacity: 0.6,
                }}
              />
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
                    borderTop: `${7 * zoom}px solid var(--color-accent, #6c8aff)`,
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
                  background: 'var(--color-accent, #6c8aff)',
                  border: '1px solid var(--color-bg, #0a0a0f)',
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
                  background: 'var(--color-accent, #6c8aff)',
                  border: '1px solid var(--color-bg, #0a0a0f)',
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
                background: 'var(--color-selection, rgba(108, 138, 255, 0.25))',
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
            borderColor: 'var(--color-selection-border, rgba(108, 138, 255, 0.5))',
            background: 'var(--color-selection, rgba(108, 138, 255, 0.15))',
          }}
        />
      )}

      {/* Line/Arrow drawing preview */}
      {linePreview && (
        <div className="absolute pointer-events-none">
          {/* Line */}
          <div
            style={{
              position: 'absolute',
              left: linePreview.left,
              top: linePreview.top,
              width: linePreview.width,
              height: 2 * zoom,
              background: 'var(--color-accent, #6c8aff)',
              transformOrigin: '0 50%',
              transform: `rotate(${linePreview.angle}deg)`,
            }}
          />
          {/* Arrow head */}
          {linePreview.isArrow && (
            <div
              style={{
                position: 'absolute',
                left: linePreview.left + Math.cos(linePreview.angle * Math.PI / 180) * linePreview.width,
                top: linePreview.top + Math.sin(linePreview.angle * Math.PI / 180) * linePreview.width,
                width: 0,
                height: 0,
                borderLeft: `${6 * zoom}px solid transparent`,
                borderRight: `${6 * zoom}px solid transparent`,
                borderTop: `${8 * zoom}px solid var(--color-accent, #6c8aff)`,
                transformOrigin: '50% 0%',
                transform: `translate(-50%, -50%) rotate(${linePreview.angle + 90}deg)`,
              }}
            />
          )}
          {/* Start point handle */}
          <div
            style={{
              position: 'absolute',
              left: linePreview.left - 3.5,
              top: linePreview.top - 3.5,
              width: 7,
              height: 7,
              background: 'var(--color-accent, #6c8aff)',
              border: '1px solid var(--color-bg, #0a0a0f)',
              borderRadius: '50%',
            }}
          />
          {/* End point handle */}
          <div
            style={{
              position: 'absolute',
              left: linePreview.left + Math.cos(linePreview.angle * Math.PI / 180) * linePreview.width - 3.5,
              top: linePreview.top + Math.sin(linePreview.angle * Math.PI / 180) * linePreview.width - 3.5,
              width: 7,
              height: 7,
              background: 'var(--color-accent, #6c8aff)',
              border: '1px solid var(--color-bg, #0a0a0f)',
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
