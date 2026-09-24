import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';

type PanelSide = 'left' | 'right';

const LEFT_MIN = 160;
const LEFT_MAX = 400;
const RIGHT_MIN = 220;
const RIGHT_MAX = 560;
const COLLAPSED_LEFT_WIDTH = 40;
const HANDLE_WIDTH = 6;
const CANVAS_MIN = 320;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function usePanelWidths(leftCollapsed: boolean) {
  const [widths, setWidths] = useState({ left: 176, right: 256 });
  const stopDraggingRef = useRef<(() => void) | null>(null);

  const resizeTo = useCallback((side: PanelSide, desiredWidth: number) => {
    setWidths(current => {
      const available = window.innerWidth - CANVAS_MIN - HANDLE_WIDTH * (leftCollapsed ? 1 : 2);
      const otherWidth = side === 'left' ? current.right : leftCollapsed ? COLLAPSED_LEFT_WIDTH : current.left;
      const min = side === 'left' ? LEFT_MIN : RIGHT_MIN;
      const max = side === 'left' ? LEFT_MAX : RIGHT_MAX;
      const nextWidth = clamp(desiredWidth, min, Math.max(min, Math.min(max, available - otherWidth)));
      return current[side] === nextWidth ? current : { ...current, [side]: nextWidth };
    });
  }, [leftCollapsed]);

  const startDragging = useCallback((side: PanelSide, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    stopDraggingRef.current?.();

    const pointerId = event.pointerId;
    event.currentTarget.setPointerCapture(pointerId);
    const startX = event.clientX;
    const startWidth = widths[side];
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const stopDragging = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('blur', stopDragging);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      stopDraggingRef.current = null;
    };
    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = moveEvent.clientX - startX;
      resizeTo(side, startWidth + (side === 'left' ? delta : -delta));
    };
    const onPointerEnd = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId === pointerId) stopDragging();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    window.addEventListener('blur', stopDragging);
    stopDraggingRef.current = stopDragging;
  }, [resizeTo, widths]);

  useEffect(() => {
    const constrainToViewport = () => {
      resizeTo('left', widths.left);
      resizeTo('right', widths.right);
    };
    window.addEventListener('resize', constrainToViewport);
    return () => window.removeEventListener('resize', constrainToViewport);
  }, [resizeTo, widths]);

  useEffect(() => () => stopDraggingRef.current?.(), []);

  return { widths, resizeTo, startDragging };
}
