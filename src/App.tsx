import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCanvas, TOOLS } from './hooks/useCanvas';
import { useKeyboard } from './hooks/useKeyboard';
import { useShareUrl, encodeObjects } from './hooks/useShareUrl';
import { useSettings } from './hooks/useSettings';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import LayersPanel from './components/LayersPanel';
import StatusBar from './components/StatusBar';
import ActionButtons from './components/ActionButtons';
import ExportModal from './components/ExportModal';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import type { KeyboardShortcut, ComponentType } from './types';
import './App.css';

const DEFAULT_LAYER_ID = 'layer-1';

type ContextMenuItem = {
  id: string;
  label: string;
  shortcut: string;
  onClick: () => void;
};

function App() {
  const [inspectorTab, setInspectorTab] = useState<'layers' | 'properties'>('properties');

  const {
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
    panX,
    panY,
    handleCellMouseDown,
    handleCellMouseMove,
    handleCellMouseUp,
    handleKeyDown,
    deleteSelection,
    clearAll,
    selectedObjects,
    selectObject,
    objectsCount,
    cursor,
    updateObject,
    editingObjectId,
    setEditingObjectId,
    loadObjects,
    marquee,
    panViewport,
    layers,
    // Undo/Redo
    undo,
    redo,
    // Copy/Paste/Duplicate
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
  } = useCanvas();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; onSelection: boolean } | null>(null);

  const {
    visibleComponents,
    sidebarCollapsed,
    theme,
    toggleComponent,
    showAll,
    hideAll,
    resetDefaults,
    toggleSidebar,
    setTheme,
  } = useSettings();

  // Load objects from URL hash on mount
  useShareUrl(loadObjects);

  // Keyboard shortcuts
  const canGroupSelection = selectedIds.size > 1
    && selectedObjects.every(obj => (obj.layerId ?? DEFAULT_LAYER_ID) === DEFAULT_LAYER_ID);
  const canUngroupSelection = selectedIds.size > 0
    && selectedObjects.every(obj => (obj.layerId ?? DEFAULT_LAYER_ID) !== DEFAULT_LAYER_ID);

  const groupOrUngroupSelection = useCallback(() => {
    if (canGroupSelection) {
      createLayerFromSelection();
      return;
    }
    if (canUngroupSelection) {
      moveSelectionToLayer(DEFAULT_LAYER_ID);
    }
  }, [canGroupSelection, canUngroupSelection, createLayerFromSelection, moveSelectionToLayer]);

  const shortcuts: KeyboardShortcut[] = [
    { key: 'b', handler: () => setTool(TOOLS.BOX) },
    { key: 't', handler: () => setTool(TOOLS.TEXT) },
    { key: 'v', handler: () => setTool(TOOLS.SELECT) },
    { key: 'l', handler: () => setTool(TOOLS.LINE) },
    { key: 'a', handler: () => setTool(TOOLS.ARROW) },
    { key: 'c', handler: () => setTool(TOOLS.CONNECTOR) },
    { key: 'Delete', handler: () => deleteSelection() },
    { key: 'Backspace', handler: () => deleteSelection() },
    { key: 'ArrowUp', handler: () => handleKeyDown('ArrowUp') },
    { key: 'ArrowDown', handler: () => handleKeyDown('ArrowDown') },
    { key: 'ArrowLeft', handler: () => handleKeyDown('ArrowLeft') },
    { key: 'ArrowRight', handler: () => handleKeyDown('ArrowRight') },
    { key: 'Escape', handler: () => setTool(TOOLS.SELECT) },
    // Undo/Redo
    { key: 'z', ctrl: true, handler: () => undo() },
    { key: 'z', ctrl: true, shift: true, handler: () => redo() },
    { key: 'z', meta: true, handler: () => undo() },
    { key: 'z', meta: true, shift: true, handler: () => redo() },
    // Copy/Paste/Duplicate
    { key: 'c', ctrl: true, handler: () => copySelection() },
    { key: 'x', ctrl: true, handler: () => cutSelection() },
    { key: 'v', ctrl: true, handler: () => pasteClipboard() },
    { key: 'd', ctrl: true, handler: () => duplicateSelection() },
    { key: 'a', ctrl: true, handler: () => selectAll() },
    { key: 'g', ctrl: true, handler: () => groupOrUngroupSelection() },
    { key: 'g', ctrl: true, shift: true, handler: () => moveSelectionToLayer(DEFAULT_LAYER_ID) },
    { key: 'c', meta: true, handler: () => copySelection() },
    { key: 'x', meta: true, handler: () => cutSelection() },
    { key: 'v', meta: true, handler: () => pasteClipboard() },
    { key: 'd', meta: true, handler: () => duplicateSelection() },
    { key: 'a', meta: true, handler: () => selectAll() },
    { key: 'g', meta: true, handler: () => groupOrUngroupSelection() },
    { key: 'g', meta: true, shift: true, handler: () => moveSelectionToLayer(DEFAULT_LAYER_ID) },
    { key: ']', meta: true, handler: () => arrangeSelectionLayer('toFront') },
    { key: ']', handler: () => arrangeSelectionLayer('forward') },
    { key: '[', handler: () => arrangeSelectionLayer('backward') },
    { key: '[', meta: true, handler: () => arrangeSelectionLayer('toBack') },
    // Toggle sidebar
    { key: 'p', handler: () => toggleSidebar() },
  ];

  useKeyboard(shortcuts);

  const handleExport = useCallback(() => {
    setShowExportModal(true);
  }, []);

  const handleShare = useCallback(() => {
    const url = encodeObjects(objects);
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    });
  }, [objects]);

  const handleSetPendingComponent = useCallback((type: ComponentType | null) => {
    setPendingComponent(type);
  }, [setPendingComponent]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleWindowClick = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('mousedown', handleWindowClick);
    window.addEventListener('resize', handleWindowClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleWindowClick);
      window.removeEventListener('resize', handleWindowClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const selectedMenuItems = useMemo<ContextMenuItem[]>(() => {
    const groupItem: ContextMenuItem = canUngroupSelection
      ? { id: 'ungroup', label: 'Ungroup', shortcut: '⌘⇧G', onClick: () => moveSelectionToLayer(DEFAULT_LAYER_ID) }
      : { id: 'group', label: 'Group Selection', shortcut: '⌘G', onClick: () => createLayerFromSelection() };

    return [
      { id: 'copy', label: 'Copy', shortcut: '⌘C', onClick: copySelection },
      { id: 'cut', label: 'Cut', shortcut: '⌘X', onClick: cutSelection },
      { id: 'paste', label: 'Paste', shortcut: '⌘V', onClick: pasteClipboard },
      { id: 'delete', label: 'Delete', shortcut: '⌫', onClick: deleteSelection },
      { id: 'duplicate', label: 'Duplicate', shortcut: '⌘D', onClick: duplicateSelection },
      { id: 'to-front', label: 'Bring to front', shortcut: '⌘]', onClick: () => arrangeSelectionLayer('toFront') },
      { id: 'forward', label: 'Bring forward', shortcut: ']', onClick: () => arrangeSelectionLayer('forward') },
      { id: 'backward', label: 'Send Backward', shortcut: '[', onClick: () => arrangeSelectionLayer('backward') },
      { id: 'to-back', label: 'Send to back', shortcut: '⌘[', onClick: () => arrangeSelectionLayer('toBack') },
      groupItem,
    ];
  }, [
    canUngroupSelection,
    moveSelectionToLayer,
    createLayerFromSelection,
    copySelection,
    cutSelection,
    pasteClipboard,
    deleteSelection,
    duplicateSelection,
    arrangeSelectionLayer,
  ]);

  const canvasMenuItems = useMemo<ContextMenuItem[]>(() => ([
    { id: 'paste', label: 'Paste', shortcut: '⌘V', onClick: pasteClipboard },
    { id: 'select-all', label: 'Select all', shortcut: '⌘A', onClick: selectAll },
  ]), [pasteClipboard, selectAll]);

  const activeMenuItems = contextMenu?.onSelection ? selectedMenuItems : canvasMenuItems;
  const menuWidth = 260;
  const menuHeight = (activeMenuItems.length * 32) + 8;
  const menuLeft = contextMenu ? Math.min(contextMenu.x, window.innerWidth - menuWidth - 8) : 0;
  const menuTop = contextMenu ? Math.min(contextMenu.y, window.innerHeight - menuHeight - 8) : 0;

  return (
    <div className={`theme-${theme} flex h-screen w-screen flex-col bg-bg font-mono antialiased`}>
      {/* Hidden H1 for accessibility */}
      <h1 className="sr-only">Wiretext: Unicode wireframe design tool — draw with text</h1>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Tools */}
        <div className="flex h-full select-none">
          <Toolbar
            tool={tool}
            setTool={setTool}
            pendingComponent={pendingComponent}
            setPendingComponent={handleSetPendingComponent}
            visibleComponents={visibleComponents}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
            onShowAbout={() => setShowAboutModal(true)}
          />
        </div>

        {/* Center - Canvas */}
        <div className="relative flex-1 flex flex-col">
          {/* Action buttons overlay */}
          <ActionButtons
            onClear={clearAll}
            onExport={handleExport}
            onShare={handleShare}
            onSettings={() => setShowSettingsModal(true)}
          />

          {/* Share toast */}
          {shareToast && (
            <div className="absolute top-14 right-3 z-20 px-3 py-2 bg-green-600 text-white text-xs rounded shadow-lg animate-fade-in">
              ✓ Share URL copied to clipboard!
            </div>
          )}

          {/* Canvas */}
          <Canvas
            grid={grid}
            objects={objects}
            tool={tool}
            selectedIds={selectedIds}
            dragState={dragState}
            zoom={zoom}
            panX={panX}
            panY={panY}
            cursor={cursor}
            gridSize={gridSize}
            handleCellMouseDown={handleCellMouseDown}
            handleCellMouseMove={handleCellMouseMove}
            handleCellMouseUp={handleCellMouseUp}
            editingObjectId={editingObjectId}
            setEditingObjectId={setEditingObjectId}
            onUpdateObject={updateObject}
            marquee={marquee}
            panViewport={panViewport}
            onCanvasContextMenu={(x, y, onSelection) => setContextMenu({ x, y, onSelection })}
          />
          {contextMenu && (
            <div
              className="fixed z-40 min-w-[260px] select-none rounded-md border border-border bg-surface p-1 shadow-2xl"
              style={{ left: menuLeft, top: menuTop }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {activeMenuItems.map((item) => (
                <button
                  key={item.id}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs text-text hover:bg-surface-hover"
                  onClick={() => {
                    item.onClick();
                    closeContextMenu();
                  }}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-text-dim">{item.shortcut}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar - Inspector tabs */}
        <div className="flex w-64 select-none flex-col border-l border-border bg-surface">
          <div className="flex border-b border-border">
            <button
              onClick={() => setInspectorTab('layers')}
              className={`flex-1 px-3 py-2 text-xs transition-colors ${
                inspectorTab === 'layers'
                  ? 'bg-surface-hover text-text'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              Layer
            </button>
            <button
              onClick={() => setInspectorTab('properties')}
              className={`flex-1 px-3 py-2 text-xs transition-colors ${
                inspectorTab === 'properties'
                  ? 'bg-surface-hover text-text'
                  : 'text-text-dim hover:text-text'
              }`}
            >
              Properties
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {inspectorTab === 'properties' ? (
              <PropertiesPanel
                tool={tool}
                cursor={cursor}
                selectedObjects={selectedObjects}
                objectsCount={objectsCount}
                onUpdateObject={updateObject}
              />
            ) : (
              <LayersPanel
                layers={layers}
                objects={objects}
                selectedIds={selectedIds}
                onSelectObject={selectObject}
                onUpdateObject={updateObject}
                onMoveSelectionToLayer={moveSelectionToLayer}
                onMoveObjectToLayer={moveObjectToLayer}
                onReorderObjectByDrop={reorderObjectByDrop}
                onRenameLayer={renameLayer}
                onReorderLayer={reorderLayer}
                onCreateLayerFromSelection={createLayerFromSelection}
                onArrangeSelectionLayer={arrangeSelectionLayer}
              />
            )}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar
        cursor={cursor}
        tool={tool}
        zoom={zoom}
        objectsCount={objectsCount}
        selectedCount={selectedIds.size}
        pendingComponent={pendingComponent}
      />

      {/* Modals */}
      {showExportModal && (
        <ExportModal
          objects={objects}
          gridSize={gridSize}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          visibleComponents={visibleComponents}
          theme={theme}
          onToggleComponent={toggleComponent}
          onThemeChange={setTheme}
          onShowAll={showAll}
          onHideAll={hideAll}
          onResetDefaults={resetDefaults}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showAboutModal && (
        <AboutModal onClose={() => setShowAboutModal(false)} />
      )}
    </div>
  );
}

export default App;

