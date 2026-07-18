import React, { useMemo, useRef, useState } from 'react';
import type { CanvasLayer, CanvasObject } from '../types';
import { compareObjectsByStackOrder } from '../utils/boxDrawing';
import {
  findPreviousSiblingId,
  getLayerDropPlacement,
  getLayerPanelDragPayload,
  setLayerPanelDragPayload,
  type LayerDropPlacement,
} from '../utils/layerDragDrop';

interface LayersPanelProps {
  layers: CanvasLayer[];
  objects: CanvasObject[];
  selectedIds: Set<string>;
  onSelectObject: (id: string, addToSelection?: boolean) => void;
  onSelectObjects: (ids: string[], addToSelection?: boolean) => void;
  onUpdateObject: (id: string, updates: Partial<CanvasObject>) => void;
  onMoveSelectionToLayer: (layerId: string) => void;
  onMoveObjectToLayer: (objectId: string, layerId: string) => void;
  onReorderObjectByDrop: (dragObjectId: string, targetObjectId: string) => void;
  onRenameLayer: (layerId: string, name: string) => void;
  onReorderLayer: (dragLayerId: string, targetLayerId: string, placement?: LayerDropPlacement) => void;
  onSetLayerParent: (layerId: string, parentId?: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onCreateLayerFromSelection: () => void;
  onArrangeSelectionLayer: (mode: 'toFront' | 'forward' | 'backward' | 'toBack') => void;
}

function getObjectTitle(obj: CanvasObject): string {
  if (obj.type === 'line' && obj.isConnector) return obj.annotation || obj.label || 'connector';
  if (obj.type === 'component') return obj.annotation || obj.label || obj.componentType || 'component';
  if (obj.type === 'text') return obj.content?.split('\n')[0] || 'text';
  return obj.annotation || obj.label || obj.type;
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
  onMoveSelectionToLayer,
  onMoveObjectToLayer,
  onReorderObjectByDrop,
  onRenameLayer,
  onReorderLayer,
  onSetLayerParent,
  onDeleteLayer,
  onCreateLayerFromSelection,
  onArrangeSelectionLayer,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftLayerName, setDraftLayerName] = useState('');
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const [dropTargetLayerId, setDropTargetLayerId] = useState<string | null>(null);
  const [dropPlacement, setDropPlacement] = useState<LayerDropPlacement>('inside');
  const [dropTargetObjectId, setDropTargetObjectId] = useState<string | null>(null);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [draftAnnotation, setDraftAnnotation] = useState('');
  const lastSelectedObjectId = useRef<string | null>(null);
  const draggingLayerIdRef = useRef<string | null>(null);
  const draggingObjectIdRef = useRef<string | null>(null);

  const finishDrag = () => {
    draggingLayerIdRef.current = null;
    draggingObjectIdRef.current = null;
    setDraggingLayerId(null);
    setDraggingObjectId(null);
    setDropTargetLayerId(null);
    setDropTargetObjectId(null);
  };

  const startLayerDrag = (event: React.DragEvent, layerId: string) => {
    setLayerPanelDragPayload(event.dataTransfer, { type: 'layer', id: layerId });
    draggingLayerIdRef.current = layerId;
    draggingObjectIdRef.current = null;
    setDraggingLayerId(layerId);
    setDraggingObjectId(null);
  };

  const startObjectDrag = (event: React.DragEvent, objectId: string) => {
    setLayerPanelDragPayload(event.dataTransfer, { type: 'object', id: objectId });
    draggingObjectIdRef.current = objectId;
    draggingLayerIdRef.current = null;
    setDraggingObjectId(objectId);
    setDraggingLayerId(null);
  };
  const layersWithObjects = useMemo(() => {
    const byLayer = new Map<string, CanvasObject[]>();
    for (const obj of objects) {
      const layerId = obj.layerId ?? 'layer-1';
      const current = byLayer.get(layerId) ?? [];
      current.push(obj);
      byLayer.set(layerId, current);
    }

    const ordered = [...layers].sort((a, b) => a.order - b.order);
    const byParent = new Map<string | undefined, CanvasLayer[]>();
    for (const layer of ordered) {
      const parentId = layer.parentId && layers.some(candidate => candidate.id === layer.parentId)
        ? layer.parentId
        : undefined;
      byParent.set(parentId, [...(byParent.get(parentId) ?? []), layer]);
    }
    const flattened: Array<CanvasLayer & { depth: number }> = [];
    const appendChildren = (parentId: string | undefined, depth: number) => {
      for (const layer of byParent.get(parentId) ?? []) {
        flattened.push({ ...layer, depth });
        appendChildren(layer.id, depth + 1);
      }
    };
    appendChildren(undefined, 0);

    return flattened.map((layer) => ({
        ...layer,
        objects: [...(byLayer.get(layer.id) ?? [])].sort(compareObjectsByStackOrder),
      }));
  }, [layers, objects]);
  const visibleObjectIds = useMemo(
    () => layersWithObjects.flatMap(layer => layer.objects.map(obj => obj.id)),
    [layersWithObjects]
  );

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

  const activeLayerId = objects.find((obj) => selectedIds.has(obj.id))?.layerId ?? layersWithObjects[0]?.id ?? '';

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

  return (
    <div className="flex h-full flex-col bg-surface select-none">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-text-dim">
        <span>Layers</span>
        <span>{selectedIds.size}/{objects.length}</span>
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

      <div className="flex-1 overflow-y-auto py-1">
        {layersWithObjects.map((layer) => (
          <div
            key={layer.id}
            className="mb-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if ((draggingLayerIdRef.current && draggingLayerIdRef.current !== layer.id) || draggingObjectIdRef.current) {
                setDropTargetLayerId(layer.id);
                setDropPlacement('inside');
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              const payload = getLayerPanelDragPayload(e.dataTransfer);
              if (payload?.type === 'object') {
                onMoveObjectToLayer(payload.id, layer.id);
              } else if (payload?.type === 'layer') {
                onReorderLayer(payload.id, layer.id, dropPlacement);
              }
              finishDrag();
            }}
          >
            <button
              draggable={editingLayerId !== layer.id}
              onDragStart={(e) => startLayerDrag(e, layer.id)}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if ((draggingLayerIdRef.current && draggingLayerIdRef.current !== layer.id) || draggingObjectIdRef.current) {
                  setDropTargetLayerId(layer.id);
                  if (draggingLayerIdRef.current) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setDropPlacement(getLayerDropPlacement(e.clientY, rect.top, rect.height));
                  } else {
                    setDropPlacement('inside');
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const payload = getLayerPanelDragPayload(e.dataTransfer);
                if (payload?.type === 'object') {
                  onMoveObjectToLayer(payload.id, layer.id);
                } else if (payload?.type === 'layer') {
                  onReorderLayer(payload.id, layer.id, dropPlacement);
                }
                finishDrag();
              }}
              onDragEnd={finishDrag}
              onClick={() => onMoveSelectionToLayer(layer.id)}
              className={`flex w-full items-center gap-1.5 px-3 py-1 text-left text-xs transition-colors ${activeLayerId === layer.id ? 'bg-accent/20 text-text' : 'text-text-dim hover:bg-surface'
                } ${dropTargetLayerId === layer.id && dropPlacement === 'inside' ? 'ring-1 ring-accent' : ''}
                ${dropTargetLayerId === layer.id && dropPlacement === 'before' ? 'border-t border-accent' : ''}
                ${dropTargetLayerId === layer.id && dropPlacement === 'after' ? 'border-b border-accent' : ''}`}
              style={{ paddingLeft: `${12 + layer.depth * 14}px` }}
            >
              {(draggingLayerId || draggingObjectId) && (
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
                    startRename(layer.id, layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}
              <span className="text-[10px] opacity-70">{layer.objectCount}</span>
              {layer.id !== 'layer-1' && (
                <span className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Outdent layer"
                    className="px-0.5 hover:text-text"
                    onClick={() => onSetLayerParent(layer.id, layers.find(item => item.id === layer.parentId)?.parentId)}
                  >←</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Indent under previous layer"
                    className="px-0.5 hover:text-text"
                    onClick={() => {
                      const previousSiblingId = findPreviousSiblingId(layersWithObjects, layer.id);
                      if (previousSiblingId) onSetLayerParent(layer.id, previousSiblingId);
                    }}
                  >→</span>
                  <span
                    role="button"
                    tabIndex={0}
                    title={
                      layer.objectCount > 0
                        ? 'Delete layer (its objects move up to the parent layer)'
                        : 'Delete empty layer'
                    }
                    className="px-0.5 hover:text-red-400"
                    onClick={() => onDeleteLayer(layer.id)}
                  >✕</span>
                </span>
              )}
            </button>
            <div className="space-y-0.5" style={{ paddingLeft: `${16 + layer.depth * 14}px` }}>
              {layer.objects.map((obj) => (
                <button
                  key={obj.id}
                  draggable={editingObjectId !== obj.id}
                  onDragStart={(e) => startObjectDrag(e, obj.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (draggingObjectIdRef.current && draggingObjectIdRef.current !== obj.id) {
                      setDropTargetObjectId(obj.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = getLayerPanelDragPayload(e.dataTransfer);
                    if (payload?.type === 'object' && payload.id !== obj.id) {
                      onReorderObjectByDrop(payload.id, obj.id);
                    } else if (payload?.type === 'layer') {
                      // Dropping a dragged layer onto an object row (which
                      // takes up most of the panel's vertical space) should
                      // still act as a drop onto the layer that owns this
                      // object, matching the layer header's own onDrop —
                      // otherwise the drop is silently swallowed here since
                      // this handler stops propagation.
                      onReorderLayer(payload.id, layer.id, dropPlacement);
                    }
                    finishDrag();
                  }}
                  onDragEnd={finishDrag}
                  onClick={(event) => handleObjectSelection(event, obj.id)}
                  className={`flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-xs ${selectedIds.has(obj.id) ? 'bg-accent/30 text-text' : 'text-text-dim hover:bg-surface'
                    } ${dropTargetObjectId === obj.id ? 'ring-1 ring-accent' : ''}`}
                  title={getObjectTitle(obj)}
                >
                  <span className="text-[10px] opacity-70">⋮⋮</span>
                  <span className="w-3 text-[10px]">{getObjectIcon(obj)}</span>
                  {editingObjectId === obj.id ? (
                    <input
                      autoFocus
                      value={draftAnnotation}
                      onChange={(e) => setDraftAnnotation(e.target.value)}
                      onBlur={() => commitObjectRename(obj)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitObjectRename(obj);
                        if (e.key === 'Escape') {
                          setEditingObjectId(null);
                          setDraftAnnotation('');
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-bg border border-border rounded px-1 py-0 text-xs text-text outline-none"
                    />
                  ) : (
                    <span
                      className="truncate"
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startObjectRename(obj);
                      }}
                    >
                      {getObjectTitle(obj)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LayersPanel;
