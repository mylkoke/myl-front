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
  | 'una_vez_turno'
  | 'mientras_en_juego'
  | 'al_ser_anulado'
  | 'inicio_turno';

export const MOMENT_LABELS: Record<AbilityMoment, string> = {
  entra_juego: 'Al entrar en juego',
  vigilia: 'En tu Vigilia',
  agrupacion: 'En Agrupación',
  batalla: 'En Batalla',
  guerra_talismanes: 'Durante la Guerra de Talismanes',
  fase_final: 'Al comienzo de tu Fase Final',
  una_vez_turno: 'Una vez por turno',
  mientras_en_juego: 'Mientras esté en juego (aura continua)',
  al_ser_anulado: 'Al ser anulada',
  inicio_turno: 'Al comienzo de cada turno',
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
export type AbilityEffectKind =
  | 'mover'
  | 'invocar'
  | 'habilitar_juego'
  | 'recuperar_self'
  | 'buff_fuerza'
  | 'destruir'
  | 'buff_objetivo'
  | 'jugar_desde_zona'
  | 'coste_gratis_condicional';

export const EFFECT_LABELS: Record<AbilityEffectKind, string> = {
  mover: 'Mover / Barajar cartas',
  invocar: 'Jugar / Invocar una carta',
  habilitar_juego: 'Habilitar jugar cartas desde otra zona (aura)',
  recuperar_self: 'Recuperar / agrupar esta misma carta a otra zona',
  buff_fuerza: 'Bonificar la Fuerza de aliados (aura)',
  destruir: 'Destruir una carta en juego',
  buff_objetivo: 'Potenciar un Aliado objetivo (+N Fuerza hasta Fase Final)',
  jugar_desde_zona: 'Poder jugar esta carta desde otra zona',
  coste_gratis_condicional: 'Jugar gratis si controlas X Oros',
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
 * Efecto "mover": lleva `count` cartas de la zona `from` a la zona `to`. Con
 * `target: 'opponent'` el movimiento se aplica sobre las zonas del OPONENTE del
 * controlador (p.ej. "un oponente bota N del Castillo" = mover deck→graveyard
 * del rival); la cantidad dinámica ("tantas como Aliados controles") se cuenta
 * siempre sobre el controlador. Si `barajar` está activo, el Mazo Castillo del
 * jugador afectado se re-aleatoriza al terminar (botar del tope NO baraja).
 */
export interface MoveEffect {
  kind: 'mover';
  from: AbilityZone;
  to: AbilityZone;
  /** ¿Cuántas cartas? (fija o dinámica) */
  count: AbilityCount;
  /** Barajar el Mazo Castillo del jugador afectado al terminar. */
  barajar: boolean;
  /** Sobre quién se aplica el movimiento: el propio controlador o su oponente. */
  target?: 'self' | 'opponent';
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

/**
 * Efecto "habilitar_juego" (aura estática, momento `mientras_en_juego`):
 * mientras la carta portadora esté en juego, su propietario puede jugar OTRAS
 * cartas que cumplan los filtros (raza/tipo/coste máx.) desde la zona `from`
 * (típicamente el Cementerio) como si estuvieran en su Mano, con el coste
 * reducido en `costDelta` (número negativo) hasta un mínimo de `minCoste`.
 * A diferencia de `invocar`, no es una acción puntual: es un permiso continuo
 * de cambio de reglas para un conjunto de cartas, no para la portadora.
 */
export interface EnablePlayEffect {
  kind: 'habilitar_juego';
  /** Zona desde la que se habilita jugar (típicamente el Cementerio). */
  from: AbilityZone;
  /** Filtro de raza de las cartas habilitadas (null = cualquier raza). */
  raza: string | null;
  /** Filtro de tipo (null = aliado por defecto). */
  tipo: import('./card.types').CardType | null;
  /** Coste impreso máximo de las cartas habilitadas (null = sin límite). */
  maxCoste: number | null;
  /** Modificador al coste al jugarlas (negativo = descuento; 0 = sin cambio). */
  costDelta: number;
  /** Coste mínimo tras aplicar el descuento (tope inferior). */
  minCoste: number;
}

/**
 * Efecto "recuperar_self": mueve LA PROPIA carta portadora a la zona `to`
 * (típicamente la Mano), venga de donde venga (p.ej. Removidas tras ser
 * anulada). A diferencia de `mover`, el objetivo no son cartas del frente de
 * una zona sino la carta que lleva la habilidad. Suele combinarse con el
 * momento `al_ser_anulado`, modo activable y un `costMill` (botar del Castillo).
 */
export interface RecoverSelfEffect {
  kind: 'recuperar_self';
  /** Zona destino de la carta recuperada (típicamente la Mano). */
  to: AbilityZone;
}

/**
 * Efecto "buff_fuerza" (aura estática, momento `mientras_en_juego`): mientras la
 * carta portadora esté en juego, los Aliados del controlador de raza `targetRaza`
 * (null = todos) ganan `amount` de Fuerza por cada Aliado de raza `countRaza`
 * (null = cualquiera) en juego. `scope` decide si se cuentan solo los aliados del
 * controlador o los de ambos jugadores; `excludeSelf` no cuenta al propio aliado
 * que recibe el bono ("por cada OTRO"). Dinámico: se recalcula en `effectiveForce`.
 * Ej. Paula Jaraquemada: targetRaza=countRaza='Caudillo', amount=1, excludeSelf.
 */
export interface ForceBuffEffect {
  kind: 'buff_fuerza';
  targetRaza: string | null;
  countRaza: string | null;
  amount: number;
  scope: 'owner' | 'both';
  excludeSelf: boolean;
}

/**
 * Efecto "destruir" (activable, con selección de objetivo): el jugador elige una
 * carta EN JUEGO (líneas del tablero) del tipo `targetTipo` (null = cualquiera)
 * dentro del `scope` (propias, del rival o de ambos) y la destruye → Cementerio.
 * Respeta 'indestructible', 'no_sale_del_juego', 'solo_sale_combate' e inmunidades.
 * (Destruir solo aplica a cartas en juego; quitar de mano/mazo son otras
 * mecánicas: descartar / botar.) Ej. Mateo de Toro: targetTipo='aliado', scope='both'.
 */
export interface DestroyEffect {
  kind: 'destruir';
  /** Tipo de carta objetivo (null = cualquiera). */
  targetTipo: import('./card.types').CardType | null;
  /** De quién puede ser el objetivo. */
  scope: 'self' | 'opponent' | 'both';
}

/**
 * Efecto "buff_objetivo" (con selección): al dispararse (p.ej. al jugar el
 * talismán, momento `entra_juego`; o activable), el jugador elige un Aliado en
 * juego dentro del `scope` que gana `amount` de Fuerza hasta la Fase Final
 * (temporal, expira al terminar el turno). Ej. Abordaje: amount 4, scope both.
 */
export interface BuffTargetEffect {
  kind: 'buff_objetivo';
  amount: number;
  scope: 'self' | 'opponent' | 'both';
}

/**
 * Efecto "jugar_desde_zona" (propiedad pasiva): permite jugar ESTA carta desde
 * la zona `from` (típicamente el Cementerio) como si estuviera en la Mano; si
 * `thenExile`, tras jugarse así se destierra en vez de volver al Cementerio.
 * (El `momento`/`modo` de la receta son irrelevantes para este efecto.)
 */
export interface PlayFromZoneEffect {
  kind: 'jugar_desde_zona';
  from: AbilityZone;
  thenExile: boolean;
}

/**
 * Efecto "coste_gratis_condicional" (propiedad pasiva): si el jugador controla
 * `minGold` o más Oros (Reserva + Oro Pagado), puede jugar esta carta sin pagar
 * su Coste (coste 0). (`momento`/`modo` irrelevantes.)
 */
export interface FreeCostEffect {
  kind: 'coste_gratis_condicional';
  minGold: number;
}

export type AbilityEffect =
  | MoveEffect
  | SummonEffect
  | EnablePlayEffect
  | RecoverSelfEffect
  | ForceBuffEffect
  | DestroyEffect
  | BuffTargetEffect
  | PlayFromZoneEffect
  | FreeCostEffect;

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
  /**
   * Coste alternativo/adicional: cartas del propio Mazo Castillo que se botan al
   * Cementerio al usar la habilidad (mill). Si el Castillo no alcanza, la
   * habilidad no puede pagarse. 0/ausente = no bota.
   */
  costMill?: number;
}
