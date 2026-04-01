import { useGameStore } from '@/store/gameStore';
import type { PlayerId } from '@/types/game.types';

export function useGameActions() {
  const playCard      = useGameStore((s) => s.playCard);
  const equipWeapon   = useGameStore((s) => s.equipWeapon);
  const attackWithAlly = useGameStore((s) => s.attackWithAlly);
  const selectCard    = useGameStore((s) => s.selectCard);
  const tapCard       = useGameStore((s) => s.tapCard);
  const drawCard      = useGameStore((s) => s.drawCard);
  const advancePhase  = useGameStore((s) => s.advancePhase);
  const endTurn       = useGameStore((s) => s.endTurn);
  const resetGame     = useGameStore((s) => s.resetGame);
  const addLog        = useGameStore((s) => s.addLog);

  return {
    playCard,
    equipWeapon,
    attackWithAlly,
    selectCard,
    tapCard,
    drawForPlayer: (id: PlayerId) => drawCard(id),
    advancePhase,
    endPlayerTurn: () => endTurn(),
    resetGame,
    addLog,
  };
}
