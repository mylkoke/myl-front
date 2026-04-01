import type { Card, CardInPlay } from './card.types';

export type ZoneId =
  | 'hand'
  | 'defense'      // Línea de Defensa (aliados en posición defensiva)
  | 'attack'       // Línea de Ataque (aliados que atacaron este turno)
  | 'support'      // Línea de Apoyo (tótems y tierras)
  | 'deck'         // M — Mazo Castillo
  | 'graveyard'    // + — Cementerio
  | 'goldPaid'     // P — Zona de oro pagado
  | 'removed'      // R — Cartas removidas
  | 'gold'         // O — Zona de oros disponibles
  | 'exile';       // D — Destierro

export type TurnPhase =
  | 'agrupacion'  // Enderezar todas las cartas (automático)
  | 'vigilia'     // Robar 1, jugar 1 oro, jugar cartas
  | 'batalla'     // Declarar ataques y bloqueos
  | 'final';      // Fase final — efectos de fin de turno

export type PlayerId = 'player' | 'opponent';

export interface PlayerState {
  id: PlayerId;
  name: string;

  // ── Zonas de carta ─────────────────────────────────────────────────────
  deck: Card[];                // M — Mazo Castillo
  hand: CardInPlay[];

  /** Línea de Defensa: aliados recién jugados y que no atacaron */
  defenseField: CardInPlay[];
  /** Línea de Ataque: aliados que atacaron este turno (quedan sitiados) */
  attackField: CardInPlay[];
  /** Línea de Apoyo: tótems y tierras permanentes */
  supportField: CardInPlay[];

  /** O — Oros disponibles (cartas de tipo oro jugadas) */
  gold: CardInPlay[];
  /** P — Oros que ya fueron pagados/gastados este turno */
  goldPaid: CardInPlay[];
  /** + — Cementerio */
  graveyard: CardInPlay[];
  /** R — Cartas removidas del juego */
  removed: CardInPlay[];
  /** D — Destierro */
  exile: CardInPlay[];

  /** Armas equipadas: key = instanceId del aliado, value = arma */
  equippedWeapons: Record<string, CardInPlay>;

  // ── Estado del jugador ─────────────────────────────────────────────────
  life: number;
  goldCount: number;
  drawnThisTurn: boolean;
}

export interface TurnState {
  currentPlayer: PlayerId;
  phase: TurnPhase;
  turnNumber: number;
  cardsPlayedThisTurn: number;
  /** Solo se puede jugar 1 carta de oro por turno (en vigilia) */
  goldPlayedThisTurn: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  turn: TurnState;
  selectedCard: CardInPlay | null;
  isGameOver: boolean;
  winner: PlayerId | null;
  gameLog: GameLogEntry[];
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
  targetAllyInstanceId?: string;
}
