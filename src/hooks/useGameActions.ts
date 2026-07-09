import { useGameStore } from '@/store/gameStore';
import { useOnlineStore } from '@/store/onlineStore';
import { pushCurrentState } from '@/utils/onlineSync';
import type { PlayerId } from '@/types/game.types';

/**
 * Single interception point for game actions. In online mode:
 * - mutating actions are gated by seat (the defender acts during combat)
 * - after each local (optimistic) mutation the state is pushed to the room
 */
export function useGameActions() {
  const playCard      = useGameStore((s) => s.playCard);
  const equipWeapon   = useGameStore((s) => s.equipWeapon);
  const declareAttack = useGameStore((s) => s.declareAttack);
  const defendWith    = useGameStore((s) => s.defendWith);
  const passCombat    = useGameStore((s) => s.passCombat);
  const playCombatTalisman = useGameStore((s) => s.playCombatTalisman);
  const selectCard    = useGameStore((s) => s.selectCard);
  const tapCard       = useGameStore((s) => s.tapCard);
  const advancePhase  = useGameStore((s) => s.advancePhase);
  const endTurn       = useGameStore((s) => s.endTurn);
  const summonCaudilloFromDeck = useGameStore((s) => s.summonCaudilloFromDeck);
  const activateGoldTalisman = useGameStore((s) => s.activateGoldTalisman);
  const regroupGold    = useGameStore((s) => s.regroupGold);
  const regroupAllies  = useGameStore((s) => s.regroupAllies);
  const resetGame      = useGameStore((s) => s.resetGame);
  const addLog        = useGameStore((s) => s.addLog);

  /**
   * May the local user act right now?
   * - During `awaiting_defense`, only the defender may act (forDefense).
   * - During `talisman_war`, only the active player may act (forCombat).
   * - Otherwise, only the seat whose turn it is.
   */
  const canActOnline = ({ forDefense = false, forCombat = false } = {}): boolean => {
    const { mode, mySeat } = useOnlineStore.getState();
    if (mode !== 'online') return true;
    const { turn, combat } = useGameStore.getState();
    if (combat?.status === 'awaiting_defense') {
      const defenderId: PlayerId = combat.attackerId === 'player' ? 'opponent' : 'player';
      return forDefense && mySeat === defenderId;
    }
    if (combat?.status === 'talisman_war') {
      return forCombat && mySeat === combat.activePlayer;
    }
    return !forDefense && !forCombat && mySeat === turn.currentPlayer;
  };

  const guarded = <A extends unknown[]>(
    fn: (...args: A) => void,
    { forDefense = false, forCombat = false }: { forDefense?: boolean; forCombat?: boolean } = {},
  ) =>
    (...args: A) => {
      if (!canActOnline({ forDefense, forCombat })) {
        addLog('No es tu turno.', 'error');
        return;
      }
      fn(...args);
      pushCurrentState();
    };

  return {
    playCard:      guarded(playCard),
    equipWeapon:   guarded(equipWeapon),
    declareAttack: guarded(declareAttack),
    defendWith:    guarded(defendWith, { forDefense: true }),
    passCombat:    guarded(passCombat, { forCombat: true }),
    playCombatTalisman: guarded(playCombatTalisman, { forCombat: true }),
    tapCard:       guarded(tapCard),
    advancePhase:  guarded(advancePhase),
    endPlayerTurn: guarded(() => endTurn()),
    summonCaudilloFromDeck: guarded(summonCaudilloFromDeck),
    // 'oro_talismanes' es activable también en el turno del oponente: en online
    // solo se exige ser el dueño del asiento (no que sea tu turno).
    activateGoldTalisman: (goldInstanceId: string, playerId: PlayerId) => {
      const { mode, mySeat } = useOnlineStore.getState();
      if (mode === 'online' && mySeat !== playerId) {
        addLog('Solo puedes pagar tus propios oros.', 'error');
        return;
      }
      activateGoldTalisman(goldInstanceId, playerId);
      pushCurrentState();
    },
    regroupGold:   guarded(regroupGold),
    regroupAllies: guarded(regroupAllies),
    selectCard,
    resetGame,
    addLog,
  };
}
