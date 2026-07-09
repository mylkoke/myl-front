import type { Card, CardInPlay } from '@/types/card.types';

let instanceCounter = 0;

/**
 * Factory pattern: creates a CardInPlay instance from a base Card.
 * Generates a unique instanceId to distinguish multiple copies of the same card.
 */
export function createCardInPlay(card: Card): CardInPlay {
  instanceCounter += 1;
  return {
    ...card,
    instanceId: `${card.id}-${instanceCounter}-${Date.now()}`,
    tapped: false,
    attackedThisTurn: false,
    summonedThisTurn: false,
  };
}

export function createCardsInPlay(cards: Card[]): CardInPlay[] {
  return cards.map(createCardInPlay);
}

/**
 * Resets instance counter (useful for testing or new game sessions)
 */
export function resetCardFactory(): void {
  instanceCounter = 0;
}
