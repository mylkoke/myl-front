import type { Card, CardInPlay } from './card.types';

export type ZoneId =
  | 'hand'
  | 'field'
  | 'deck'
  | 'graveyard'
  | 'gold'
  | 'talisman'
  | 'weapon';

export type TurnPhase =
  | 'draw'
  | 'main'
  | 'combat'
  | 'end';

export type PlayerId = 'player' | 'opponent';

export interface Zone {
  id: ZoneId;
  cards: CardInPlay[];
  maxCards?: number;
  label: string;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  deck: Card[];
  hand: CardInPlay[];
  field: CardInPlay[];
  graveyard: CardInPlay[];
  gold: CardInPlay[];
  talisman: CardInPlay | null;
  weapon: CardInPlay | null;
  life: number;
  goldCount: number;
  drawnThisTurn: boolean;
}

export interface TurnState {
  currentPlayer: PlayerId;
  phase: TurnPhase;
  turnNumber: number;
  cardsPlayedThisTurn: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  turn: TurnState;
  selectedCard: CardInPlay | null;
  isGameOver: boolean;
  winner: PlayerId | null;
  gameLog: GameLogEntry[];
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  message: string;
  type: 'action' | 'system' | 'combat' | 'error';
}

export interface DragPayload {
  card: CardInPlay;
  sourceZone: ZoneId;
  sourcePlayer: PlayerId;
}
