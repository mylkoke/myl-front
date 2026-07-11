import type { GameState } from '@/types/game.types';
import { useGameStore } from '@/store/gameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { apiGameSyncService } from '@/services/api/gameSyncService';

/** Serializable snapshot of the current game state (no store actions). */
export function snapshotGameState(): GameState {
  const s = useGameStore.getState();
  return {
    players: s.players,
    turn: s.turn,
    combat: s.combat,
    selectedCard: null,
    isGameOver: s.isGameOver,
    winner: s.winner,
    gameLog: s.gameLog.slice(0, 30),
    isBoardRotating: false,
    pendingDiscard: s.pendingDiscard,
    responseWindow: s.responseWindow,
  };
}

/** Push the local state after a mutating action (online mode only). */
export function pushCurrentState() {
  const { mode, gameId, version, setPendingVersion } = useOnlineStore.getState();
  if (mode !== 'online' || !gameId) return;
  setPendingVersion(version + 1);
  apiGameSyncService.pushState(gameId, snapshotGameState(), version);
}
