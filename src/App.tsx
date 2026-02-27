import { useCallback } from 'react';
import { useCanvas, TOOLS } from './hooks/useCanvas';
import { useKeyboard } from './hooks/useKeyboard';
import { useShareUrl, encodeObjects } from './hooks/useShareUrl';
import { useSettings } from './hooks/useSettings';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import StatusBar from './components/StatusBar';
import ActionButtons from './components/ActionButtons';
import ExportModal from './components/ExportModal';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import type { KeyboardShortcut, ComponentType } from './types';
import { useState } from 'react';
import './App.css';

function App() {
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
    objectsCount,
    cursor,
    updateObject,
    editingObjectId,
    setEditingObjectId,
    loadObjects,
    marquee,
    panViewport,
    // Undo/Redo
    undo,
    redo,
    // Copy/Paste/Duplicate
    copySelection,
    pasteClipboard,
    duplicateSelection,
  } = useCanvas();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const {
    visibleComponents,
    sidebarCollapsed,
    toggleComponent,
    showAll,
    hideAll,
    resetDefaults,
    toggleSidebar,
  } = useSettings();

  // Load objects from URL hash on mount
  useShareUrl(loadObjects);

  // Keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    { key: 'b', handler: () => setTool(TOOLS.BOX) },
    { key: 't', handler: () => setTool(TOOLS.TEXT) },
    { key: 'v', handler: () => setTool(TOOLS.SELECT) },
    { key: 'l', handler: () => setTool(TOOLS.LINE) },
    { key: 'a', handler: () => setTool(TOOLS.ARROW) },
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
    { key: 'v', ctrl: true, handler: () => pasteClipboard() },
    { key: 'd', ctrl: true, handler: () => duplicateSelection() },
    { key: 'c', meta: true, handler: () => copySelection() },
    { key: 'v', meta: true, handler: () => pasteClipboard() },
    { key: 'd', meta: true, handler: () => duplicateSelection() },
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

  return (
    <div className="flex h-screen w-screen flex-col bg-bg font-mono antialiased">
      {/* Hidden H1 for accessibility */}
      <h1 className="sr-only">Wiretext: Unicode wireframe design tool — draw with text</h1>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Tools */}
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
          />
        </div>

        {/* Right sidebar - Properties */}
        <PropertiesPanel
          tool={tool}
          cursor={cursor}
          selectedObjects={selectedObjects}
          objects={objects}
          objectsCount={objectsCount}
          onUpdateObject={updateObject}
        />
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
          onToggleComponent={toggleComponent}
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

