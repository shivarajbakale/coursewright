import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import { ResizeHandle } from '@/components/resize-handle';
import { useResizableWidth } from '@/hooks/use-resizable-width';

function Pane({ edge = 'start' as 'start' | 'end' }) {
  const state = useResizableWidth({ storageKey: 'test.width', initial: 420, min: 340, max: 760 });
  return (
    <div style={{ position: 'relative', width: state.width }} data-testid="pane">
      <ResizeHandle label="Resize pane" edge={edge} state={state} />
    </div>
  );
}

const renderPane = (edge?: 'start' | 'end') =>
  render(
    <MantineProvider>
      <Pane edge={edge} />
    </MantineProvider>
  );

describe('ResizeHandle', () => {
  beforeEach(() => {
    // This test environment has no Web Storage; the hook must work with a plain one.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
    Object.defineProperty(window, 'innerWidth', { value: 2000, configurable: true });
  });

  it('drags from the window, clamps, remembers, and swallows the click after a drag', () => {
    renderPane('start');
    const handle = screen.getByRole('separator', { name: 'Resize pane' });
    // jsdom has no PointerEvent: a MouseEvent under the pointer event's name carries clientX.
    const pointer = (target: EventTarget, type: string, clientX = 0) =>
      act(() => void target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX })));
    pointer(handle, 'pointerdown', 1000);
    pointer(window, 'pointermove', 900); // left edge: moving left widens
    expect(handle).toHaveAttribute('aria-valuenow', '520');
    pointer(window, 'pointermove', 0);
    expect(handle).toHaveAttribute('aria-valuenow', '760'); // clamped to max
    pointer(window, 'pointerup');
    expect(localStorage.getItem('test.width')).toBe('760');
    expect(document.body.style.cursor).toBe('');

    let clicked = false;
    document.body.addEventListener('click', () => (clicked = true), { once: true });
    fireEvent.click(document.body);
    expect(clicked).toBe(false); // the release must not activate what is under the pointer
  });

  it('moves with the keyboard and resets on double-click', () => {
    renderPane('end');
    const handle = screen.getByRole('separator', { name: 'Resize pane' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' }); // right edge: right widens
    expect(handle).toHaveAttribute('aria-valuenow', '436');
    fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
    expect(handle).toHaveAttribute('aria-valuenow', '372');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', '340');
    fireEvent.doubleClick(handle);
    expect(handle).toHaveAttribute('aria-valuenow', '420');
  });

  it('starts from a remembered width, clamped to this window', () => {
    localStorage.setItem('test.width', '9000');
    renderPane();
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '760');
  });
});
