import type { Card, CardInPlay } from './card.types';

export type ZoneId =
  | 'hand'
  | 'defense'      // Línea de Defensa (aliados en posición defensiva)
  | 'attack'       // Línea de Ataque (aliados que atacaron este turno)
  | 'support'      // Línea de Apoyo (tótems y maquinarias)
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
  /** Línea de Apoyo: tótems y armas con maquinaria (permanentes) */
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
  /** Bonos de fuerza temporales activos (hasta Fase Final): key = allyInstanceId */
  weaponTempBonuses: Record<string, number>;
  /** instanceIds de armas cuya habilidad activada ya se usó este turno */
  weaponAbilityUsedThisTurn: string[];
  /** instanceIds de aliados cuya habilidad activada ya se usó este turno */
  allyAbilityUsedThisTurn: string[];
  /** instanceIds de aliados con Fuerza 0 hasta la Fase Final ('debilitar_aliado') */
  weakenedAllies: string[];

  // ── Estado del jugador ─────────────────────────────────────────────────
  life: number;
  goldCount: number;
  /**
   * Oros virtuales generados por habilidades (p.ej. 'oro_talismanes'):
   * SOLO sirven para pagar talismanes y expiran al terminar el turno.
   */
  talismanGold: number;
  drawnThisTurn: boolean;
  /** True si el jugador pagó oro durante este turno; bloquea reagrupar oro. */
  goldSpentThisTurn: boolean;
}

export interface TurnState {
  currentPlayer: PlayerId;
  phase: TurnPhase;
  turnNumber: number;
  cardsPlayedThisTurn: number;
  /** Solo se puede jugar 1 carta de oro por turno (en vigilia) */
  goldPlayedThisTurn: number;
}

/**
 * Interactive combat (sub-fases de la Batalla Mitológica): set when an attack
 * is declared, cleared on damage resolution.
 *
 * - `awaiting_defense`: el DEFENSOR declara bloqueo (elige aliado o no defiende).
 * - `talisman_war`: Guerra de Talismanes. Tras el bloqueo, ambos jugadores
 *   pueden jugar talismanes / activar habilidades, empezando por el defensor y
 *   alternándose. Termina cuando ambos pasan consecutivamente → asignación de daño.
 */
export interface CombatState {
  attackerId: PlayerId;
  attackerInstanceId: string;
  /** Aliado bloqueador elegido por el defensor (null = no defendió). */
  defenderInstanceId: string | null;
  status: 'awaiting_defense' | 'talisman_war';
  /** Guerra de Talismanes: a quién le toca actuar (parte el defensor). */
  activePlayer: PlayerId;
  /** Pasos consecutivos sin jugar nada; al llegar a 2 se resuelve el combate. */
  consecutivePasses: number;
}

export interface GameState {
  players: Record<PlayerId, PlayerState>;
  turn: TurnState;
  combat: CombatState | null;
  selectedCard: CardInPlay | null;
  isGameOver: boolean;
  winner: PlayerId | null;
  gameLog: GameLogEntry[];
  isBoardRotating: boolean;
  /**
   * Jugador con un descarte OBLIGATORIO pendiente (p.ej. tras activar
   * 'oro_robar_descartar'): debe elegir una carta de su mano → cementerio
   * antes de continuar. Se sincroniza online.
   */
  pendingDiscard: PlayerId | null;
  /**
   * Ventana de respuesta: tras jugarse un Aliado o Talismán, el oponente
   * tiene 10 s para responder con un talismán de anulación ("en respuesta
   * a"). Mientras está abierta, el juego queda en pausa. Se sincroniza online.
   */
  /**
   * FX de Relámpago: timestamp del último juego de una carta 'relampago'
   * fuera de la Vigilia de su dueño. GameBoard lo observa y dispara el
   * destello en ambos clientes.
   */
  fxLightning: number | null;
  /**
   * Decisión pendiente de 'barajar_mano_roba8' (Manuel Rodríguez): al entrar
   * en juego, su dueño puede barajar su mano en el Castillo y robar 8.
   * Se sincroniza online.
   */
  pendingShuffleChoice: { playerId: PlayerId; cardName: string } | null;
  /**
   * Decisión pendiente de 'intercambio_control' (Arturo Prat SP): al entrar
   * en juego, su dueño puede intercambiar su control con una carta rival
   * no-oro por el resto de la partida. Se sincroniza online.
   */
  pendingSwapChoice: { playerId: PlayerId; cardInstanceId: string; cardName: string } | null;
  responseWindow: {
    /** Carta recién jugada (ya en su zona) que puede ser anulada */
    cardInstanceId: string;
    cardName: string;
    cardCoste: number;
    cardOwnerId: PlayerId;
    /** Jugador que puede responder (el oponente del que jugó) */
    responderId: PlayerId;
    /** Epoch ms en que expira la ventana */
    expiresAt: number;
  } | null;
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
