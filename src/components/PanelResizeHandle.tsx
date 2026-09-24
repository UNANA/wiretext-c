import type { KeyboardEvent, PointerEvent } from 'react';

interface PanelResizeHandleProps {
  side: 'left' | 'right';
  width: number;
  onPointerDown: (side: 'left' | 'right', event: PointerEvent<HTMLDivElement>) => void;
  onResize: (side: 'left' | 'right', width: number) => void;
}

export default function PanelResizeHandle({ side, width, onPointerDown, onResize }: PanelResizeHandleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopPropagation();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    onResize(side, width + (side === 'left' ? direction : -direction) * 16);
  };

  return (
    <div
      role="separator"
      aria-label={`Resize ${side} panel`}
      aria-orientation="vertical"
      aria-valuemin={side === 'left' ? 160 : 220}
      aria-valuemax={side === 'left' ? 400 : 560}
      aria-valuenow={width}
      tabIndex={0}
      title={`Drag to resize ${side} panel`}
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none bg-border/50 outline-none hover:bg-accent/40 focus-visible:bg-accent/40"
      onPointerDown={(event) => onPointerDown(side, event)}
      onKeyDown={handleKeyDown}
    >
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-accent group-focus-visible:bg-accent" />
    </div>
  );
}
