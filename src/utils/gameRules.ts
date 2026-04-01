import type { CardInPlay, Card } from '@/types/card.types';
import type { PlayerState, TurnState } from '@/types/game.types';

export const INITIAL_LIFE = 20;
export const INITIAL_HAND_SIZE = 5;
export const MAX_FIELD_CARDS = 5;
export const MAX_GOLD_PER_TURN = 1;

/**
 * Pure function: can a card be played given player's current state?
 */
export function canPlayCard(
  card: Card,
  player: PlayerState,
  turn: TurnState
): { allowed: boolean; reason?: string } {
  if (turn.currentPlayer !== player.id) {
    return { allowed: false, reason: 'No es tu turno' };
  }

  if (turn.phase !== 'main') {
    return { allowed: false, reason: 'Solo puedes jugar cartas en la fase principal' };
  }

  if (card.tipo === 'oro') {
    if (turn.cardsPlayedThisTurn >= MAX_GOLD_PER_TURN && player.goldCount === 0) {
      return { allowed: false, reason: 'Ya jugaste un oro este turno' };
    }
    return { allowed: true };
  }

  if (card.coste > player.goldCount) {
    return {
      allowed: false,
      reason: `Necesitas ${card.coste} de oro (tienes ${player.goldCount})`,
    };
  }

  if (card.tipo === 'criatura' && player.field.length >= MAX_FIELD_CARDS) {
    return { allowed: false, reason: `El campo está lleno (máximo ${MAX_FIELD_CARDS})` };
  }

  return { allowed: true };
}

/**
 * Pure function: resolve combat between two creatures
 */
export function resolveCombat(
  attacker: CardInPlay,
  defender: CardInPlay
): { attackerSurvives: boolean; defenderSurvives: boolean } {
  return {
    attackerSurvives: attacker.fuerza > defender.fuerza,
    defenderSurvives: defender.fuerza >= attacker.fuerza,
  };
}

/**
 * Calculate damage dealt to life when attacking player directly
 */
export function calculateDirectDamage(attacker: CardInPlay): number {
  return attacker.fuerza;
}

/**
 * Pure function: can a creature attack this turn?
 */
export function canAttack(
  card: CardInPlay,
  turn: TurnState,
  ownerId: string
): { allowed: boolean; reason?: string } {
  if (turn.currentPlayer !== ownerId) {
    return { allowed: false, reason: 'Solo puedes atacar en tu turno' };
  }

  if (turn.phase !== 'combat') {
    return { allowed: false, reason: 'Solo puedes atacar en la fase de combate' };
  }

  if (card.attackedThisTurn) {
    return { allowed: false, reason: 'Esta criatura ya atacó este turno' };
  }

  if (card.tapped) {
    return { allowed: false, reason: 'Esta criatura está agotada' };
  }

  return { allowed: true };
}

/**
 * Checks if the game is over (life <= 0 or empty deck at draw)
 */
export function checkGameOver(players: Record<string, PlayerState>): {
  isOver: boolean;
  winnerId?: string;
} {
  for (const [id, player] of Object.entries(players)) {
    if (player.life <= 0) {
      const winnerId = Object.keys(players).find(k => k !== id);
      return { isOver: true, winnerId };
    }
  }
  return { isOver: false };
}
