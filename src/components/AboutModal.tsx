import React, { useEffect } from 'react';

interface AboutModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'V', action: 'Select' },
  { keys: 'H', action: 'Pan (drag to move view)' },
  { keys: 'B', action: 'Box' },
  { keys: 'T', action: 'Text' },
  { keys: 'L', action: 'Line' },
  { keys: 'A', action: 'Arrow' },
  { keys: 'C', action: 'Connector' },
  { keys: 'N', action: 'Pencil' },
  { keys: 'E', action: 'Eraser' },
  { keys: 'P', action: 'Toggle sidebar' },
  { keys: 'Esc', action: 'Return to Select tool' },
  { keys: '↑ ↓ ← →', action: 'Nudge selected objects' },
  { keys: 'Delete / ⌫', action: 'Delete selection' },
  { keys: '⌘X', action: 'Cut' },
  { keys: '⌘V', action: 'Paste' },
  { keys: '⌘A', action: 'Select all' },
  { keys: '⌘G', action: 'Group / Ungroup' },
  { keys: '⌘Z', action: 'Undo' },
  { keys: '⇧⌘Z', action: 'Redo' },
  { keys: '⌘C', action: 'Copy' },
  { keys: '⌘D', action: 'Duplicate' },
  { keys: '⌘S', action: 'Save project' },
  { keys: '⌘O', action: 'Load project' },
  { keys: '[ / ]', action: 'Reorder' },
  { keys: '⌘[', action: 'Send to back' },
  { keys: '⌘]', action: 'Bring to front' },
  { keys: '⌘E', action: 'Export' },
];

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="About WireText"
    >
      <div className="w-full max-w-lg overflow-hidden rounded border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4">
          <div className="pr-4">
            <h2 className="text-2xl leading-none text-text">
              <span className="mr-2 text-text-dim">⌜</span>
              Wiretext
              <span className="ml-2 text-text-dim">⌝</span>
            </h2>
            <p className="mt-2 text-xs text-text-dim">Unicode wireframe design tool</p>
          </div>
          <button
            onClick={onClose}
            className="px-1 text-base leading-none text-text-dim transition-colors hover:text-text"
            type="button"
            aria-label="Close About dialog"
          >
            ×
          </button>
        </div>

        <div className="border-y border-border px-5 py-4">
          <p className="text-xs leading-6 text-text-dim">
            Build low-fidelity wireframes quickly with ASCII/Unicode drawing tools.
            Create boxes, text, connectors, and common UI components directly on a
            grid canvas.
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 text-2xs uppercase tracking-wider text-text-dim">
            Keyboard Shortcuts
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {SHORTCUTS.map((shortcut) => (
              <div key={`${shortcut.keys}-${shortcut.action}`} className="flex items-center gap-2 text-xs text-text-dim">
                <span className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-bg px-1.5 py-0.5 text-2xs text-text">
                  {shortcut.keys}
                </span>
                <span>{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-2xs text-text-dim">
          <span>v1.0.4</span>
          <span aria-hidden>└────────┘</span>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
