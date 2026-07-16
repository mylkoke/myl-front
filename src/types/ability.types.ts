/**
 * Habilidades declarativas ("recetas"): se arman en el editor con piezas y el
 * motor de juego las interpreta y ejecuta, en vez de programarlas a mano.
 * Conviven con las habilidades imperativas (código): una habilidad ejecuta su
 * `definition` si la tiene; si no, cae en la lógica programada por su `code`.
 */

/** Zonas del jugador que pueden ser origen/destino de un efecto. */
export type AbilityZone =
  | 'deck' // Mazo Castillo (M)
  | 'hand' // Mano
  | 'defense' // Línea de Defensa
  | 'attack' // Línea de Ataque
  | 'support' // Línea de Apoyo
  | 'gold' // Reserva de Oro (O)
  | 'goldPaid' // Oro Pagado (P)
  | 'graveyard' // Cementerio (+)
  | 'removed' // Removidas (R)
  | 'exile'; // Destierro (D)

export const ZONE_LABELS: Record<AbilityZone, string> = {
  deck: 'Mazo Castillo',
  hand: 'Mano',
  defense: 'Línea de Defensa',
  attack: 'Línea de Ataque',
  support: 'Línea de Apoyo',
  gold: 'Reserva de Oro',
  goldPaid: 'Oro Pagado',
  graveyard: 'Cementerio',
  removed: 'Removidas',
  exile: 'Destierro',
};

/** Momentos/condiciones en que aplica la habilidad (multi-selección). */
export type AbilityMoment =
  | 'entra_juego'
  | 'vigilia'
  | 'agrupacion'
  | 'batalla'
  | 'guerra_talismanes'
  | 'fase_final'
  | 'una_vez_turno';

export const MOMENT_LABELS: Record<AbilityMoment, string> = {
  entra_juego: 'Al entrar en juego',
  vigilia: 'En tu Vigilia',
  agrupacion: 'En Agrupación',
  batalla: 'En Batalla',
  guerra_talismanes: 'Durante la Guerra de Talismanes',
  fase_final: 'Al comienzo de tu Fase Final',
  una_vez_turno: 'Una vez por turno',
};

/**
 * Modo de activación:
 * - automatica: ocurre sola al cumplirse el momento.
 * - activable: el jugador decide usarla ("puede"). Requiere acción/botón.
 * - obligatoria: ocurre sí o sí al cumplirse el momento (sin decisión).
 */
export type AbilityMode = 'automatica' | 'activable' | 'obligatoria';

export const MODE_LABELS: Record<AbilityMode, string> = {
  automatica: 'Automática',
  activable: 'Activable (el jugador decide, "puede")',
  obligatoria: 'Obligatoria (ocurre sí o sí)',
};

/** Tipos de efecto soportados por el intérprete (extensible). */
export type AbilityEffectKind = 'mover' | 'invocar';

export const EFFECT_LABELS: Record<AbilityEffectKind, string> = {
  mover: 'Mover / Barajar cartas',
  invocar: 'Jugar / Invocar una carta',
};

/**
 * Cantidad de cartas: fija (número que escribe el creador) o dinámica (derivada
 * del estado de juego, p.ej. "tantas como aliados controles").
 */
export type DynamicCountSource = 'allies_controlled';

export const DYNAMIC_COUNT_LABELS: Record<DynamicCountSource, string> = {
  allies_controlled: 'Tantas como aliados controles',
};

export type AbilityCount =
  | { kind: 'fixed'; value: number }
  | { kind: 'dynamic'; source: DynamicCountSource };

/**
 * Efecto "mover": lleva `count` cartas de la zona `from` a la zona `to`. Si
 * `barajar` está activo (o alguna de las zonas es el Mazo Castillo), el Mazo
 * Castillo del propietario se re-aleatoriza al terminar.
 */
export interface MoveEffect {
  kind: 'mover';
  from: AbilityZone;
  to: AbilityZone;
  /** ¿Cuántas cartas? (fija o dinámica) */
  count: AbilityCount;
  /** Barajar el Mazo Castillo del propietario al terminar. */
  barajar: boolean;
}

/**
 * Efecto "invocar": el jugador busca y elige una carta de la zona `from`
 * (típicamente el Mazo Castillo) que cumpla los filtros (raza/tipo/coste máx.)
 * y la juega en la zona `to` (típicamente la Línea de Defensa) sin pagar su
 * coste impreso. El coste de activación va en `AbilityDefinition.costGold`.
 */
export interface SummonEffect {
  kind: 'invocar';
  from: AbilityZone;
  to: AbilityZone;
  /** Filtro de raza del objetivo (null = cualquier raza). */
  raza: string | null;
  /** Filtro de tipo del objetivo (null = aliado por defecto). */
  tipo: import('./card.types').CardType | null;
  /** Coste impreso máximo del objetivo (null = sin límite). */
  maxCoste: number | null;
}

export type AbilityEffect = MoveEffect | SummonEffect;

/** Receta declarativa completa de una habilidad. */
export interface AbilityDefinition {
  moments: AbilityMoment[];
  mode: AbilityMode;
  effect: AbilityEffect;
  /**
   * Condición de activación: oros de la Reserva que pasan a Oro Pagado al usar
   * la habilidad (solo tiene sentido en modo 'activable'). 0/ausente = gratis.
   */
  costGold?: number;
}
