import type { CardInPlay, Card } from '@/types/card.types';
import type { PlayerState, TurnState } from '@/types/game.types';

export const INITIAL_LIFE = 20;
export const INITIAL_HAND_SIZE = 5;
export const MAX_DEFENSE_CARDS = 5;
export const MAX_SUPPORT_CARDS = 3;

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
    return { allowed: true };
  }

  if (card.coste > player.goldCount) {
    return {
      allowed: false,
      reason: `Necesitas ${card.coste} de oro (tienes ${player.goldCount})`,
    };
  }

  if (card.tipo === 'aliado' && player.defenseField.length >= MAX_DEFENSE_CARDS) {
    return { allowed: false, reason: `La línea de defensa está llena (máximo ${MAX_DEFENSE_CARDS})` };
  }

  if (card.tipo === 'totem' && player.supportField.length >= MAX_SUPPORT_CARDS) {
    return { allowed: false, reason: `La línea de apoyo está llena (máximo ${MAX_SUPPORT_CARDS})` };
  }

  if (card.tipo === 'arma' && player.defenseField.filter(c => c.tipo === 'aliado').length === 0) {
    return { allowed: false, reason: 'Necesitas un aliado en la línea de defensa para equipar un arma' };
  }

  return { allowed: true };
}

/**
 * Pure function: can an ally attack this turn?
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
    return { allowed: false, reason: 'Este aliado ya atacó este turno' };
  }
  if (card.tapped) {
    return { allowed: false, reason: 'Este aliado está agotado' };
  }
  return { allowed: true };
}

/**
 * Pure function: resolve combat between two allies.
 * Force comparison: higher force wins; ties destroy both.
 */
export function resolveCombat(
  attacker: CardInPlay,
  defender: CardInPlay,
  attackerWeaponBonus = 0,
  defenderWeaponBonus = 0
): { attackerSurvives: boolean; defenderSurvives: boolean } {
  const atkForce = attacker.fuerza + attackerWeaponBonus;
  const defForce = defender.fuerza + defenderWeaponBonus;
  return {
    attackerSurvives: atkForce > defForce,
    defenderSurvives: defForce > atkForce,
  };
}

export function calculateDirectDamage(attacker: CardInPlay, weaponBonus = 0): number {
  return attacker.fuerza + weaponBonus;
}

/**
 * Check if the game is over (any player's life ≤ 0).
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
