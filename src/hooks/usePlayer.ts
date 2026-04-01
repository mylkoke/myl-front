import { useGameStore } from '@/store/gameStore';
import type { PlayerId } from '@/types/game.types';

/**
 * Custom hook to read a specific player's state.
 * Avoids subscribing to the entire store when only player data is needed.
 */
export function usePlayer(id: PlayerId) {
  return useGameStore((s) => s.players[id]);
}

export function useCurrentPlayer() {
  const currentPlayerId = useGameStore((s) => s.turn.currentPlayer);
  const player = useGameStore((s) => s.players[currentPlayerId]);
  return { player, currentPlayerId };
}

export function useTurn() {
  return useGameStore((s) => s.turn);
}

export function useGameStatus() {
  const isGameOver = useGameStore((s) => s.isGameOver);
  const winner = useGameStore((s) => s.winner);
  const gameLog = useGameStore((s) => s.gameLog);
  return { isGameOver, winner, gameLog };
}
