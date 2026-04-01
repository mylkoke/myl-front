import { useGameStore } from '@/store/gameStore';
import type { PlayerId } from '@/types/game.types';

/**
 * Custom hook exposing only game actions (no state).
 * Follows single-responsibility: separates reading from writing.
 */
export function useGameActions() {
  const playCard = useGameStore((s) => s.playCard);
  const moveCard = useGameStore((s) => s.moveCard);
  const selectCard = useGameStore((s) => s.selectCard);
  const tapCard = useGameStore((s) => s.tapCard);
  const drawCard = useGameStore((s) => s.drawCard);
  const advancePhase = useGameStore((s) => s.advancePhase);
  const endTurn = useGameStore((s) => s.endTurn);
  const resetGame = useGameStore((s) => s.resetGame);
  const addLog = useGameStore((s) => s.addLog);
  const equipWeapon = useGameStore((s) => s.equipWeapon);
  const unequipWeapon = useGameStore((s) => s.unequipWeapon);

  return {
    playCard,
    moveCard,
    selectCard,
    tapCard,
    drawForPlayer: (id: PlayerId) => drawCard(id),
    advancePhase,
    endPlayerTurn: () => endTurn(),
    resetGame,
    addLog,
    equipWeapon,
    unequipWeapon,
  };
}
