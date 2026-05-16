import React, { useState, useRef, useEffect } from 'react';
import type { Position, Tool, ComponentType } from '../types';
import { COMPONENT_DEFS } from '../types';

interface StatusBarProps {
  cursor: Position;
  tool: Tool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  zoomMode: 'scroll' | 'zoom';
  onZoomModeChange: (mode: 'scroll' | 'zoom') => void;
  objectsCount: number;
  selectedCount: number;
  pendingComponent: ComponentType | null;
}

const StatusBar: React.FC<StatusBarProps> = ({
  cursor,
  tool,
  zoom,
  onZoomChange,
  zoomMode,
  onZoomModeChange,
  objectsCount,
  selectedCount,
  pendingComponent
}) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPopoverOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isPopoverOpen]);

  const toolLabels: Record<Tool, string> = {
    select: 'SELECT',
    pan: 'PAN',
    box: 'BOX',
    text: 'TEXT',
    line: 'LINE',
    arrow: 'ARROW',
    connector: 'CONNECTOR',
    pencil: 'PENCIL',
    eraser: 'ERASER',
  };

  const componentName = pendingComponent
    ? COMPONENT_DEFS.find(c => c.type === pendingComponent)?.name
    : null;

  return (
    <div className="relative flex h-7 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-text-dim text-xs">
      <a
        href="https://github.com/mualat/wiretext"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center text-text-dim hover:text-text transition-colors"
        aria-label="View on GitHub"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      </a>
      <span className="w-16 font-mono">
        {cursor.col},{cursor.row}
      </span>
      <span className="text-accent font-medium">
        {toolLabels[tool]}
      </span>

      <div className="relative flex items-center">
        <button
          ref={buttonRef}
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-surface-hover ${
            isPopoverOpen ? 'bg-surface-hover text-text' : ''
          }`}
        >
          <span>{Math.round(zoom * 100)}%</span>
          <svg className={`w-3 h-3 transition-transform ${isPopoverOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {isPopoverOpen && (
          <div
            ref={popoverRef}
            className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-border bg-surface p-3 shadow-2xl animate-fade-in z-50"
          >
            <div className="space-y-4">
              {/* Zoom Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-text-dim">Zoom</span>
                  <span className="font-mono text-text">{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.25"
                  max="4"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex justify-between mt-1 text-[10px] text-text-dim font-mono">
                  <span>25%</span>
                  <span>400%</span>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Zoom Mode Toggle */}
              <div>
                <span className="block text-[10px] uppercase tracking-wider font-bold text-text-dim mb-2">Wheel Behavior</span>
                <div className="flex p-0.5 bg-bg rounded-md border border-border">
                  <button
                    onClick={() => onZoomModeChange('scroll')}
                    className={`flex-1 py-1 text-[10px] rounded transition-all ${
                      zoomMode === 'scroll'
                        ? 'bg-surface text-text shadow-sm'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Scroll
                  </button>
                  <button
                    onClick={() => onZoomModeChange('zoom')}
                    className={`flex-1 py-1 text-[10px] rounded transition-all ${
                      zoomMode === 'zoom'
                        ? 'bg-surface text-text shadow-sm'
                        : 'text-text-dim hover:text-text'
                    }`}
                  >
                    Zoom
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onZoomChange(1);
                    setIsPopoverOpen(false);
                  }}
                  className="py-1.5 px-2 text-[10px] rounded border border-border hover:bg-surface-hover text-text transition-colors"
                >
                  Reset (100%)
                </button>
                <button
                  onClick={() => {
                    // Logic for fit to screen could go here if implemented in useCanvas
                    onZoomChange(1);
                    setIsPopoverOpen(false);
                  }}
                  className="py-1.5 px-2 text-[10px] rounded border border-border hover:bg-surface-hover text-text transition-colors opacity-50 cursor-not-allowed"
                >
                  Fit Screen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <span>
        {objectsCount} {objectsCount === 1 ? 'object' : 'objects'}
      </span>
      {selectedCount > 0 && (
        <span className="text-accent">
          {selectedCount} selected
        </span>
      )}
      {pendingComponent && (
        <span className="text-accent">
          Place {componentName}
        </span>
      )}
      <span className="ml-auto">
        by{' '}
        <a
          className="text-text-dim underline hover:text-text"
          href="https://mualat.com"
          rel="noopener noreferrer"
          target="_blank"
        >
          Mualat
        </a>,{' '}inspired by <a
          className="text-text-dim underline hover:text-text"
          href="https://wiretext.app"
          rel="noopener noreferrer"
          target="_blank"
        >
          Wiretext.app
        </a>
      </span>
    </div>
  );
};

export default StatusBar;
