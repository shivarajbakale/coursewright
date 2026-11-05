import { useEffect, useRef } from 'react';
import { Box } from '@mantine/core';

import type { useResizableWidth } from '@/hooks/use-resizable-width';

import classes from './resize-handle.module.css';

interface HandleProps {
  label: string;
  /** Which edge of the pane the handle sits on: dragging away from the pane makes it wider. */
  edge: 'start' | 'end';
  state: ReturnType<typeof useResizableWidth>;
}

/**
 * The drag handle on a pane's edge. A pointer drags it, the arrow keys move it
 * by 16px (Shift: 64px), Home and End go to the limits, and a double-click
 * restores the default width. It is a focusable `separator`, so screen readers
 * hear the current width.
 */
export function ResizeHandle({ label, edge, state }: HandleProps) {
  const sign = edge === 'start' ? -1 : 1;
  // The latest state, for window listeners that outlive the render they were attached in.
  const live = useRef(state);
  live.current = state;
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []); // unmounting mid-drag still restores the page

  /**
   * The drag lives on the window, not the handle: the pointer leaves the 9px
   * handle at once, and pointer capture is not delivered reliably everywhere.
   * The release can land on a link or a card, so the one click that follows
   * a drag is swallowed.
   */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = live.current.width;
    let moved = false;
    live.current.setDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - x0) > 2) moved = true;
      live.current.setWidth(w0 + sign * (ev.clientX - x0));
    };
    const swallowClick = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', end);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      live.current.setDragging(false);
      stop.current = null;
      if (moved) {
        window.addEventListener('click', swallowClick, { capture: true, once: true });
        // If no click follows (released over nothing clickable), drop the guard.
        setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', end);
    stop.current = end;
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 64 : 16;
    // Arrow toward the pane's free side grows it.
    const grow = edge === 'start' ? 'ArrowLeft' : 'ArrowRight';
    const shrink = edge === 'start' ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === grow) state.setWidth(state.width + step);
    else if (e.key === shrink) state.setWidth(state.width - step);
    else if (e.key === 'Home') state.setWidth(state.min);
    else if (e.key === 'End') state.setWidth(state.max);
    else return;
    e.preventDefault();
  };

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={state.width}
      aria-valuemin={state.min}
      aria-valuemax={state.max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={state.reset}
      data-resize-handle
      data-dragging={state.dragging || undefined}
      pos="absolute"
      top={0}
      bottom={0}
      w={9}
      // Centred on the pane's border, so the hairline stays where it was.
      style={{
        [edge === 'start' ? 'left' : 'right']: -5,
        cursor: 'col-resize',
        zIndex: 3,
        touchAction: 'none',
      }}
      className={classes.handle}
    />
  );
}
