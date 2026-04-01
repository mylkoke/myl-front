import type { Card, CardInPlay } from './card.types';

export type ZoneId =
  | 'hand'
  | 'field'
  | 'deck'
  | 'graveyard'
  | 'gold'
  | 'talisman';

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
  /** Mazo Castillo */
  deck: Card[];
  hand: CardInPlay[];
  /** Solo cartas de tipo 'aliado' y 'tierra' van al campo */
  field: CardInPlay[];
  graveyard: CardInPlay[];
  gold: CardInPlay[];
  talisman: CardInPlay | null;
  /**
   * Armas equipadas a aliados.
   * Clave = instanceId del aliado, valor = carta de arma equipada.
   */
  equippedWeapons: Record<string, CardInPlay>;
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
  /** Controla si el tablero está en animación de rotación */
  isBoardRotating: boolean;
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
  /** instanceId del aliado al que se está equipando (para armas) */
  targetAllyInstanceId?: string;
}
