import React from 'react';

interface ActionButtonsProps {
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onImport: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onClear,
  onSave,
  onLoad,
  onImport,
  onExport,
  onShare,
  onSettings,
}) => {
  return (
    <div className="absolute top-3 right-3 flex gap-2 z-10">
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onClear}
      >
        Clear All
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onSave}
        title="Save project (Ctrl+S)"
      >
        Save
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onLoad}
        title="Load project, replacing the current canvas (Ctrl+O)"
      >
        Load
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onImport}
        title="Import project, adding to the current canvas (Ctrl+Shift+O)"
      >
        Import
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onExport}
      >
        Export
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onShare}
      >
        Share
      </button>
      <button
        className="rounded border border-border bg-surface px-3 py-1.5 text-text-dim text-xs transition-colors hover:bg-surface-hover hover:text-text"
        onClick={onSettings}
        title="Settings"
      >
        ⚙
      </button>
    </div>
  );
};

export default ActionButtons;
