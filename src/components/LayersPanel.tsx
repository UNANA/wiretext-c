import React, { useMemo, useRef, useState } from 'react';
import type { CanvasObject } from '../types';
import {
  getLayerDropDepth,
  getLayerDropEdgePlacement,
  getLayerPanelDragPayload,
  setLayerPanelDragPayload,
  type LayerDropPlacement,
} from '../utils/layerDragDrop';
import { flattenObjectTree } from '../utils/objectHierarchy';
import { DEFAULT_LAYER_ID, findLayerAncestorId, isLayerObject } from '../utils/layerMigration';
import { getObjectTitle } from '../utils/objectLabel';

interface LayersPanelProps {
  // Layer nodes (type === 'layer') in tree order — derived view from useCanvas.
  layers: CanvasObject[];
  objects: CanvasObject[];
  selectedIds: Set<string>;
  onSelectObject: (id: string, addToSelection?: boolean) => void;
  onSelectObjects: (ids: string[], addToSelection?: boolean) => void;
  onUpdateObject: (id: string, updates: Partial<CanvasObject>) => void;
  onMoveObjectToLayer: (objectId: string, layerId: string) => void;
  onReorderObjectByDrop: (dragObjectId: string, targetObjectId: string, placement?: LayerDropPlacement) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onReorderLayer: (dragLayerId: string, targetLayerId: string, placement?: LayerDropPlacement) => void;
  onMoveNodeToRootEnd: (nodeId: string) => void;
  onSetLayerParent: (layerId: string, parentId?: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onCreateLayerFromSelection: () => void;
  onArrangeSelectionLayer: (mode: 'toFront' | 'forward' | 'backward' | 'toBack') => void;
}

function getObjectIcon(obj: CanvasObject): string {
  if (obj.type === 'text') return 'T';
  if (obj.type === 'component') return '▪';
  if (obj.type === 'line' && obj.isConnector) return '⇄';
  if (obj.type === 'line') return '╱';
  if (obj.type === 'arrow') return '→';
  if (obj.type === 'pencil') return '█';
  return '□';
}

const LayersPanel: React.FC<LayersPanelProps> = ({
  layers,
  objects,
  selectedIds,
  onSelectObject,
  onSelectObjects,
  onUpdateObject,
  onMoveObjectToLayer,
  onReorderObjectByDrop,
  onRenameLayer,
  onReorderLayer,
  onMoveNodeToRootEnd,
  onSetLayerParent,
  onDeleteLayer,
  onDeleteObject,
  onCreateLayerFromSelection,
  onArrangeSelectionLayer,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftLayerName, setDraftLayerName] = useState('');
  const [dragging, setDragging] = useState<{ kind: 'layer' | 'object'; id: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = useState<LayerDropPlacement>('inside');
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [draftAnnotation, setDraftAnnotation] = useState('');
  const lastSelectedObjectId = useRef<string | null>(null);
  const draggingRef = useRef<{ kind: 'layer' | 'object'; id: string } | null>(null);

  const finishDrag = () => {
    draggingRef.current = null;
    setDragging(null);
    setDropTargetId(null);
  };

  const startDrag = (event: React.DragEvent, node: CanvasObject) => {
    const kind = isLayerObject(node) ? 'layer' : 'object';
    setLayerPanelDragPayload(event.dataTransfer, { type: kind, id: node.id });
    draggingRef.current = { kind, id: node.id };
    setDragging({ kind, id: node.id });
  };

  // The whole tree flattened depth-first with sibling zIndex order — this is
  // exactly the canvas paint order, so panel order === stacking order.
  const rows = useMemo(
    () => flattenObjectTree([...objects].sort((a, b) => a.zIndex - b.zIndex)),
    [objects],
  );

  // Objects directly belonging to each layer (nearest layer ancestor),
  // shown as the per-layer count badge.
  const objectCountByLayer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const obj of objects) {
      if (isLayerObject(obj)) continue;
      const layerId = findLayerAncestorId(objects, obj.id) ?? DEFAULT_LAYER_ID;
      counts.set(layerId, (counts.get(layerId) ?? 0) + 1);
    }
    return counts;
  }, [objects]);

  const visibleObjectIds = useMemo(
    () => rows.filter(row => !isLayerObject(row.object)).map(row => row.object.id),
    [rows],
  );
  const layerOrderIds = useMemo(() => layers.map(layer => layer.id), [layers]);
  const nonLayerCount = visibleObjectIds.length;

  const handleObjectSelection = (event: React.MouseEvent, objectId: string) => {
    if (event.shiftKey && lastSelectedObjectId.current) {
      const anchorIndex = visibleObjectIds.indexOf(lastSelectedObjectId.current);
      const targetIndex = visibleObjectIds.indexOf(objectId);
      if (anchorIndex >= 0 && targetIndex >= 0) {
        const start = Math.min(anchorIndex, targetIndex);
        const end = Math.max(anchorIndex, targetIndex);
        onSelectObjects(visibleObjectIds.slice(start, end + 1), event.ctrlKey || event.metaKey);
        lastSelectedObjectId.current = objectId;
        return;
      }
    }
    onSelectObject(objectId, event.ctrlKey || event.metaKey || event.shiftKey);
    lastSelectedObjectId.current = objectId;
  };

  const firstSelected = objects.find((obj) => selectedIds.has(obj.id));
  const activeLayerId = (firstSelected && findLayerAncestorId(objects, firstSelected.id))
    ?? layerOrderIds[0]
    ?? '';

  const startRename = (layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setDraftLayerName(currentName);
  };

  const commitRename = (layerId: string) => {
    onRenameLayer(layerId, draftLayerName);
    setEditingLayerId(null);
    setDraftLayerName('');
  };

  const startObjectRename = (obj: CanvasObject) => {
    setEditingObjectId(obj.id);
    setDraftAnnotation(obj.annotation || getObjectTitle(obj));
  };

  const commitObjectRename = (obj: CanvasObject) => {
    const trimmed = draftAnnotation.trim();
    onUpdateObject(obj.id, { annotation: trimmed || undefined });
    setEditingObjectId(null);
    setDraftAnnotation('');
  };

  const previousSiblingLayerId = (layer: CanvasObject): string | undefined => {
    const siblings = layers
      .filter(other => (other.parentId ?? null) === (layer.parentId ?? null))
      .sort((a, b) => a.zIndex - b.zIndex);
    const index = siblings.findIndex(other => other.id === layer.id);
    return index > 0 ? siblings[index - 1].id : undefined;
  };

  const getDropAnchor = (node: CanvasObject, depth: number, desiredDepth: number) => {
    if (desiredDepth > depth) return { node, placement: 'inside' as const };
    const rowIndex = rows.findIndex(row => row.object.id === node.id);
    for (let index = rowIndex; index >= 0; index -= 1) {
      if (rows[index].depth === desiredDepth) return { node: rows[index].object };
    }
    return { node };
  };

  const handleRowDragOver = (event: React.DragEvent, node: CanvasObject, depth: number) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    const current = draggingRef.current;
    if (!current || current.id === node.id) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const desiredDepth = getLayerDropDepth(event.clientX, rect.left, depth + 1);
    const anchor = getDropAnchor(node, depth, desiredDepth);
    setDropTargetId(anchor.node.id);
    setDropPlacement(anchor.placement ?? getLayerDropEdgePlacement(event.clientY, rect.top, rect.height));
  };

  const handleRowDrop = (event: React.DragEvent, node: CanvasObject) => {
    event.preventDefault();
    event.stopPropagation();
    const payload = getLayerPanelDragPayload(event.dataTransfer);
    if (!payload || payload.id === node.id) {
      finishDrag();
      return;
    }
    const target = objects.find(object => object.id === dropTargetId) ?? node;
    if (payload.type === 'object') {
      if (isLayerObject(target) && dropPlacement === 'inside') onMoveObjectToLayer(payload.id, target.id);
      else onReorderObjectByDrop(payload.id, target.id, dropPlacement);
    } else {
      onReorderLayer(payload.id, target.id, dropPlacement);
    }
    finishDrag();
  };

  const dropIndicatorClasses = (nodeId: string) => `
    ${dropTargetId === nodeId && dropPlacement === 'inside' ? 'ring-1 ring-accent' : ''}
    ${dropTargetId === nodeId && dropPlacement === 'before' ? 'border-t border-accent' : ''}
    ${dropTargetId === nodeId && dropPlacement === 'after' ? 'border-b border-accent' : ''}`;

  const renderLayerRow = (layer: CanvasObject, depth: number) => {
    const name = layer.label || 'Layer';
    return (
      <button
        key={layer.id}
        draggable={editingLayerId !== layer.id}
        onDragStart={(e) => startDrag(e, layer)}
        onDragOver={(e) => handleRowDragOver(e, layer, depth)}
        onDrop={(e) => handleRowDrop(e, layer)}
        onDragEnd={finishDrag}
        className={`flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors ${activeLayerId === layer.id ? 'bg-accent/20 text-text' : 'text-text-dim hover:bg-surface'
          } ${dropIndicatorClasses(layer.id)}`}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
      >
        {dragging && (
          <span className="text-[10px] opacity-70">
            ⋮
          </span>
        )}
        <span className="text-[10px]">◈</span>
        {editingLayerId === layer.id ? (
          <input
            autoFocus
            value={draftLayerName}
            onChange={(e) => setDraftLayerName(e.target.value)}
            onBlur={() => commitRename(layer.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(layer.id);
              if (e.key === 'Escape') {
                setEditingLayerId(null);
                setDraftLayerName('');
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-bg border border-border rounded px-1 py-0 text-xs text-text outline-none"
          />
        ) : (
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startRename(layer.id, name);
            }}
          >
            {name}
          </span>
        )}
        <span className="text-[10px] opacity-70">{objectCountByLayer.get(layer.id) ?? 0}</span>
        <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
            <span
              role="button"
              tabIndex={0}
              title="Outdent layer"
              className="px-0.5 hover:text-text"
              onClick={() => onSetLayerParent(
                layer.id,
                objects.find(item => item.id === layer.parentId)?.parentId,
              )}
            >←</span>
            <span
              role="button"
              tabIndex={0}
              title="Indent under previous layer"
              className="px-0.5 hover:text-text"
              onClick={() => {
                const previousId = previousSiblingLayerId(layer);
                if (previousId) onSetLayerParent(layer.id, previousId);
              }}
            >→</span>
            <span
              role="button"
              tabIndex={0}
              title={
                (objectCountByLayer.get(layer.id) ?? 0) > 0
                  ? 'Delete layer (its objects move up to the parent layer)'
                  : 'Delete empty layer'
              }
              className="px-0.5 hover:text-red-400"
              onClick={() => onDeleteLayer(layer.id)}
            >✕</span>
        </span>
      </button>
    );
  };

  const renderObjectRow = (obj: CanvasObject, depth: number) => {
    const ownLayerId = findLayerAncestorId(objects, obj.id) ?? DEFAULT_LAYER_ID;
    const layerIndex = layerOrderIds.indexOf(ownLayerId);
    const previousLayerId = layerIndex > 0 ? layerOrderIds[layerIndex - 1] : undefined;
    const nextLayerId = layerIndex >= 0 && layerIndex < layerOrderIds.length - 1
      ? layerOrderIds[layerIndex + 1]
      : undefined;
    return (
      <button
        key={obj.id}
        draggable={editingObjectId !== obj.id}
        onDragStart={(e) => startDrag(e, obj)}
        onDragOver={(e) => handleRowDragOver(e, obj, depth)}
        onDrop={(e) => handleRowDrop(e, obj)}
        onDragEnd={finishDrag}
        onClick={(event) => handleObjectSelection(event, obj.id)}
        className={`flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-xs ${selectedIds.has(obj.id) ? 'bg-accent/30 text-text' : 'text-text-dim hover:bg-surface'
          } ${dropIndicatorClasses(obj.id)}`}
        style={{ paddingLeft: `${16 + depth * 14}px` }}
        title={getObjectTitle(obj)}
      >
        <span className="text-[10px] opacity-70">⋮⋮</span>
        <span className="w-3 text-[10px]">{getObjectIcon(obj)}</span>
        {editingObjectId === obj.id ? (
          <textarea
            autoFocus
            rows={Math.min(Math.max(draftAnnotation.split('\n').length, 1), 4)}
            value={draftAnnotation}
            onChange={(e) => setDraftAnnotation(e.target.value)}
            onBlur={() => commitObjectRename(obj)}
            onKeyDown={(e) => {
              // Enter inserts a newline (annotations may span
              // multiple lines); Escape cancels. Commit happens on
              // blur, matching the text-object edit popup.
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditingObjectId(null);
                setDraftAnnotation('');
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 resize-none bg-bg border border-border rounded px-1 py-0 text-xs text-text outline-none"
          />
        ) : (
          <span
            className="truncate"
            title={obj.annotation}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startObjectRename(obj);
            }}
          >
            {getObjectTitle(obj)}
          </span>
        )}
        <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          <span
            role="button"
            tabIndex={0}
            title="Move to layer above"
            className={`px-0.5 ${previousLayerId ? 'hover:text-text' : 'opacity-30'}`}
            onClick={() => {
              if (previousLayerId) onMoveObjectToLayer(obj.id, previousLayerId);
            }}
          >↑</span>
          <span
            role="button"
            tabIndex={0}
            title="Move to layer below"
            className={`px-0.5 ${nextLayerId ? 'hover:text-text' : 'opacity-30'}`}
            onClick={() => {
              if (nextLayerId) onMoveObjectToLayer(obj.id, nextLayerId);
            }}
          >↓</span>
          <span
            role="button"
            tabIndex={0}
            title="Delete object"
            className="px-0.5 hover:text-red-400"
            onClick={() => onDeleteObject(obj.id)}
          >✕</span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full flex-col bg-surface select-none">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-text-dim">
        <span>Layers</span>
        <span>{selectedIds.size}/{nonLayerCount}</span>
      </div>

      <div className="border-b border-border px-2 py-1">
        <div className="grid grid-cols-5 gap-1 text-xs">
          <button title="Send to back" onClick={() => onArrangeSelectionLayer('toBack')} className="rounded bg-surface px-1 py-0.5 text-text-dim hover:text-text">⏮</button>
          <button title="Backward" onClick={() => onArrangeSelectionLayer('backward')} className="rounded bg-surface px-1 py-0.5 text-text-dim hover:text-text">◀</button>
          <button title="Forward" onClick={() => onArrangeSelectionLayer('forward')} className="rounded bg-surface px-1 py-0.5 text-text-dim hover:text-text">▶</button>
          <button title="Bring to front" onClick={() => onArrangeSelectionLayer('toFront')} className="rounded bg-surface px-1 py-0.5 text-text-dim hover:text-text">⏭</button>
          <button title="Group as new layer" onClick={onCreateLayerFromSelection} className="rounded bg-surface px-1 py-0.5 text-text-dim hover:text-text">＋</button>
        </div>
      </div>

      <div
        className={`flex-1 overflow-y-auto py-1 ${dropTargetId === '__root-end__' ? 'border-b-2 border-accent' : ''}`}
        onDragOver={(event) => {
          if (!draggingRef.current) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTargetId('__root-end__');
        }}
        onDrop={(event) => {
          event.preventDefault();
          const payload = getLayerPanelDragPayload(event.dataTransfer);
          if (payload) onMoveNodeToRootEnd(payload.id);
          finishDrag();
        }}
      >
        {rows.map(({ object: node, depth }) => (
          isLayerObject(node) ? renderLayerRow(node, depth) : renderObjectRow(node, depth)
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;
