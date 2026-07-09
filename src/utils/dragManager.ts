import { useEffect } from 'react';
import type { DragPayload } from '@/types/game.types';
import { useDragStore } from '@/store/dragStore';

/**
 * Pointer-events drag & drop: a single codepath for mouse AND touch
 * (HTML5 drag events don't exist on touch devices).
 *
 * - Draggable cards call `startPointerDrag` on pointerdown.
 * - Zones self-register with `useDropZone(id, config)` and render a
 *   `data-drop-zone` attribute; the active target is resolved with
 *   `document.elementFromPoint` while the pointer moves.
 */

interface DropZoneConfig {
  accepts: (payload: DragPayload) => boolean;
  onDrop: (payload: DragPayload) => void;
}

const registry = new Map<string, DropZoneConfig>();

const DRAG_THRESHOLD_PX = 8;

function zoneIdAtPoint(x: number, y: number): string | null {
  // The ghost has pointer-events: none, so it never blocks the hit test.
  const el = document.elementFromPoint(x, y);
  const zoneEl = el?.closest<HTMLElement>('[data-drop-zone]');
  return zoneEl?.dataset.dropZone ?? null;
}

/** Accepting zone under the pointer, or null. */
function acceptingZoneAt(x: number, y: number, payload: DragPayload): string | null {
  const id = zoneIdAtPoint(x, y);
  if (!id) return null;
  const cfg = registry.get(id);
  return cfg && cfg.accepts(payload) ? id : null;
}

/** Swallow the synthetic click that follows a completed drag. */
function suppressNextClick() {
  const handler = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    window.removeEventListener('click', handler, true);
  };
  window.addEventListener('click', handler, true);
  setTimeout(() => window.removeEventListener('click', handler, true), 300);
}

/**
 * pointerdown handler for draggable cards. Waits for a small movement
 * threshold before starting the drag, so taps/clicks keep working.
 */
export function startPointerDrag(e: React.PointerEvent, payload: DragPayload) {
  // Primary button / single touch only.
  if (e.button !== 0) return;
  const startX = e.clientX;
  const startY = e.clientY;
  const target = e.currentTarget as HTMLElement;
  let dragging = false;

  const store = useDragStore.getState();

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      try {
        target.setPointerCapture(ev.pointerId);
      } catch { /* pointer already released */ }
      store.start(payload, ev.clientX, ev.clientY);
    }
    ev.preventDefault();
    store.move(ev.clientX, ev.clientY, acceptingZoneAt(ev.clientX, ev.clientY, payload));
  };

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };

  const onUp = (ev: PointerEvent) => {
    cleanup();
    if (!dragging) return;
    const zoneId = acceptingZoneAt(ev.clientX, ev.clientY, payload);
    store.end();
    suppressNextClick();
    if (zoneId) registry.get(zoneId)?.onDrop(payload);
  };

  const onCancel = () => {
    cleanup();
    if (dragging) store.end();
  };

  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
}

/**
 * Registers a drop zone. Returns `isOver` (an accepted drag hovers this
 * zone) and `isEligible` (a drag is active and this zone accepts it).
 * Spread `zoneProps` on the zone element.
 */
export function useDropZone(
  id: string | null,
  config: DropZoneConfig & { disabled?: boolean },
) {
  const { accepts, onDrop, disabled = false } = config;

  useEffect(() => {
    if (!id || disabled) return;
    registry.set(id, { accepts, onDrop });
    return () => {
      registry.delete(id);
    };
    // Consumers pass inline functions; re-registering on each render of
    // deps change is fine (registry lookups happen on pointer events).
  }, [id, disabled, accepts, onDrop]);

  const isOver = useDragStore((s) => !!id && s.hoverZoneId === id);
  const isEligible = useDragStore(
    (s) => !!id && !disabled && s.payload !== null && accepts(s.payload),
  );

  return {
    isOver,
    isEligible,
    zoneProps: { 'data-drop-zone': id ?? undefined },
  };
}
