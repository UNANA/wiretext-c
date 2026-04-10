import React from 'react';
import type { Position, Tool, ComponentType } from '../types';
import { COMPONENT_DEFS } from '../types';

interface StatusBarProps {
  cursor: Position;
  tool: Tool;
  zoom: number;
  objectsCount: number;
  selectedCount: number;
  pendingComponent: ComponentType | null;
}

const StatusBar: React.FC<StatusBarProps> = ({
  cursor,
  tool,
  zoom,
  objectsCount,
  selectedCount,
  pendingComponent
}) => {
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
    <div className="flex h-7 shrink-0 items-center gap-4 border-t border-border bg-surface px-3 text-text-dim text-xs">
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
      <span>
        {Math.round(zoom * 100)}%
      </span>
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
