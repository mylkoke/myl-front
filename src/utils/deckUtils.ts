import type { Card } from '@/types/card.types';

/**
 * Fisher-Yates shuffle algorithm — pure function, no mutation of original array
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Draw N cards from the top of a deck.
 * Returns { drawn, remaining } without mutating the input.
 */
export function drawCards(
  deck: Card[],
  count: number
): { drawn: Card[]; remaining: Card[] } {
  const drawn = deck.slice(0, count);
  const remaining = deck.slice(count);
  return { drawn, remaining };
}

export function isDeckEmpty(deck: Card[]): boolean {
  return deck.length === 0;
}
