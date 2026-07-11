import { create } from 'zustand';
import type { PlayerId } from '@/types/game.types';

/**
 * Targeting mode for abilities that pick a card on the board (e.g.
 * 'debilitar_aliado'). UI-only state: it is NOT part of GameState and never
 * syncs online — the resulting action does.
 */
interface TargetingState {
  /** Active "weaken ally" targeting: source card + its controller. */
  weaken: { sourceInstanceId: string; playerId: PlayerId } | null;
  /** Active "destroy ally" targeting ('botar3_destruye'). */
  destroy: { sourceInstanceId: string; playerId: PlayerId } | null;
  startWeaken: (sourceInstanceId: string, playerId: PlayerId) => void;
  startDestroy: (sourceInstanceId: string, playerId: PlayerId) => void;
  cancel: () => void;
}

export const useTargetingStore = create<TargetingState>((set) => ({
  weaken: null,
  destroy: null,
  startWeaken: (sourceInstanceId, playerId) =>
    set({ weaken: { sourceInstanceId, playerId }, destroy: null }),
  startDestroy: (sourceInstanceId, playerId) =>
    set({ destroy: { sourceInstanceId, playerId }, weaken: null }),
  cancel: () => set({ weaken: null, destroy: null }),
}));
