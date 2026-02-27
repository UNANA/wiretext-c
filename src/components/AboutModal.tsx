import React, { useEffect } from 'react';

interface AboutModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: 'V', action: 'Select tool' },
  { keys: 'B', action: 'Box tool' },
  { keys: 'T', action: 'Text tool' },
  { keys: 'L', action: 'Line tool' },
  { keys: 'A', action: 'Arrow tool' },
  { keys: 'P', action: 'Toggle sidebar' },
  { keys: 'Delete / Backspace', action: 'Delete selection' },
  { keys: 'Arrow keys', action: 'Nudge selected objects' },
  { keys: 'Ctrl/Cmd + C', action: 'Copy selection' },
  { keys: 'Ctrl/Cmd + V', action: 'Paste clipboard' },
  { keys: 'Ctrl/Cmd + D', action: 'Duplicate selection' },
  { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
  { keys: 'Ctrl/Cmd + Shift + Z', action: 'Redo' },
  { keys: 'Esc', action: 'Return to Select tool' },
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="About WireText"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-text">About WireText</h2>
            <p className="mt-0.5 text-2xs text-text-dim">
              Unicode wireframe design tool
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-1 text-lg leading-none text-text-dim hover:text-text"
            type="button"
            aria-label="Close About dialog"
          >
            ×
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          <p className="text-xs text-text-dim">
            Build low-fidelity wireframes quickly with ASCII/Unicode drawing tools.
            Create boxes, text, connectors, and common UI components directly on a
            grid canvas.
          </p>

          <div>
            <div className="mb-2 text-2xs uppercase tracking-wider text-text-dim">
              Keyboard Shortcuts
            </div>
            <div className="space-y-1">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between rounded border border-border bg-bg px-2.5 py-1.5 text-xs"
                >
                  <span className="text-text">{shortcut.action}</span>
                  <span className="font-mono text-text-dim">{shortcut.keys}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-accent bg-accent px-3 py-1.5 text-xs text-bg transition-colors hover:opacity-90"
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
