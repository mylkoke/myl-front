import { create } from 'zustand';
import type { DragPayload } from '@/types/game.types';

/**
 * State of the pointer-based drag (mouse + touch, one codepath).
 * The ghost card and the drop-zone highlights subscribe to this store.
 */
interface DragState {
  payload: DragPayload | null;
  x: number;
  y: number;
  hoverZoneId: string | null;
  start: (payload: DragPayload, x: number, y: number) => void;
  move: (x: number, y: number, hoverZoneId: string | null) => void;
  end: () => void;
}

export const useDragStore = create<DragState>()((set) => ({
  payload: null,
  x: 0,
  y: 0,
  hoverZoneId: null,
  start: (payload, x, y) => set({ payload, x, y, hoverZoneId: null }),
  move: (x, y, hoverZoneId) => set({ x, y, hoverZoneId }),
  end: () => set({ payload: null, hoverZoneId: null }),
}));
