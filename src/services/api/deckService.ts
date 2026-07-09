import type { Card } from '@/types/card.types';
import { apiFetch } from './http';
import { toCard, type ServerCard } from './catalogService';

export interface DeckEntry {
  cardId: string;
  qty: number;
}

export interface DeckSummary {
  id: string;
  name: string;
  entries: DeckEntry[];
}

interface ServerDeck {
  _id: string;
  name: string;
  entries: { card_id: string; qty: number }[];
}

function toDeck(raw: ServerDeck): DeckSummary {
  return {
    id: raw._id,
    name: raw.name,
    entries: raw.entries.map((e) => ({ cardId: e.card_id, qty: e.qty })),
  };
}

export const apiDeckService = {
  async listMine(): Promise<DeckSummary[]> {
    return (await apiFetch<ServerDeck[]>('/api/decks')).map(toDeck);
  },

  async getDeck(id: string): Promise<{ deck: DeckSummary; cards: Card[] }> {
    const data = await apiFetch<{ deck: ServerDeck; cards: ServerCard[] }>(
      `/api/decks/${id}`,
    );
    return { deck: toDeck(data.deck), cards: data.cards.map(toCard) };
  },

  async setEntries(id: string, entries: DeckEntry[]): Promise<DeckSummary> {
    return toDeck(
      await apiFetch<ServerDeck>(`/api/decks/${id}/entries`, {
        method: 'PUT',
        body: { entries: entries.map((e) => ({ card_id: e.cardId, qty: e.qty })) },
      }),
    );
  },

  /** Expanded (qty copies) card list of the active deck, ready for a game. */
  async getActiveDeckCards(): Promise<Card[]> {
    return (await apiFetch<ServerCard[]>('/api/decks/active/cards')).map(toCard);
  },
};
