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
  /** Active "swap control" targeting ('intercambio_control'): rival non-gold cards. */
  swap: { sourceInstanceId: string; playerId: PlayerId } | null;
  /** Active "equip from zone" targeting ('desde_cementerio' con armas): own allies. */
  equip: { weaponInstanceId: string; zone: 'graveyard' | 'exile'; playerId: PlayerId } | null;
  /** Active "destroy any non-gold card" targeting ('destruye_no_oro'): any card in a line. */
  destroyAny: { sourceInstanceId: string; playerId: PlayerId } | null;
  /** Active "exile any card" targeting ('destierro_combate_pago', Lord Cochrane): any card in a line. */
  exileAny: { sourceInstanceId: string; playerId: PlayerId } | null;
  /** Active declarative "destruir" targeting (constructor): destroy a card in a line. */
  declDestroy: { sourceInstanceId: string; playerId: PlayerId; code: string } | null;
  startWeaken: (sourceInstanceId: string, playerId: PlayerId) => void;
  startDestroy: (sourceInstanceId: string, playerId: PlayerId) => void;
  startSwap: (sourceInstanceId: string, playerId: PlayerId) => void;
  startEquip: (weaponInstanceId: string, zone: 'graveyard' | 'exile', playerId: PlayerId) => void;
  startDestroyAny: (sourceInstanceId: string, playerId: PlayerId) => void;
  startExileAny: (sourceInstanceId: string, playerId: PlayerId) => void;
  startDeclDestroy: (sourceInstanceId: string, playerId: PlayerId, code: string) => void;
  cancel: () => void;
}

const NONE = { weaken: null, destroy: null, swap: null, equip: null, destroyAny: null, exileAny: null, declDestroy: null };

export const useTargetingStore = create<TargetingState>((set) => ({
  ...NONE,
  startWeaken: (sourceInstanceId, playerId) =>
    set({ ...NONE, weaken: { sourceInstanceId, playerId } }),
  startDestroy: (sourceInstanceId, playerId) =>
    set({ ...NONE, destroy: { sourceInstanceId, playerId } }),
  startSwap: (sourceInstanceId, playerId) =>
    set({ ...NONE, swap: { sourceInstanceId, playerId } }),
  startEquip: (weaponInstanceId, zone, playerId) =>
    set({ ...NONE, equip: { weaponInstanceId, zone, playerId } }),
  startDestroyAny: (sourceInstanceId, playerId) =>
    set({ ...NONE, destroyAny: { sourceInstanceId, playerId } }),
  startExileAny: (sourceInstanceId, playerId) =>
    set({ ...NONE, exileAny: { sourceInstanceId, playerId } }),
  startDeclDestroy: (sourceInstanceId, playerId, code) =>
    set({ ...NONE, declDestroy: { sourceInstanceId, playerId, code } }),
  cancel: () => set({ ...NONE }),
}));
