import React from 'react';

interface ActionButtonsProps {
  onClear: () => void;
  onExport: () => void;
  onShare: () => void;
  onSettings: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onClear, onExport, onShare, onSettings }) => {
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
