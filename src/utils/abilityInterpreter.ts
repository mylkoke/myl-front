/**
 * Intérprete de recetas declarativas: ejecuta un `AbilityDefinition` sobre el
 * estado de un jugador. Por ahora soporta el efecto "mover" (que cubre también
 * "barajar", ya que barajar es mover cartas y re-aleatorizar el Mazo Castillo).
 *
 * Diseñado como función pura: recibe el `PlayerState` del propietario y devuelve
 * uno nuevo más un texto de log, sin tocar el store. Así el llamador decide
 * cuándo y cómo aplicarlo (onEnter, endTurn, online sync, …).
 */
import type { Card, CardInPlay } from '@/types/card.types';
import type { PlayerState } from '@/types/game.types';
import type {
  AbilityCount,
  AbilityMoment,
  AbilityMode,
  AbilityZone,
  EnablePlayEffect,
  MoveEffect,
  SummonEffect,
} from '@/types/ability.types';
import { ZONE_LABELS, type AbilityDefinition } from '@/types/ability.types';
import { createCardInPlay } from '@/utils/cardFactory';
import { shuffleDeck } from '@/utils/deckUtils';

/** Zona de la receta → clave de `PlayerState`. */
export const ZONE_KEY: Record<AbilityZone, keyof PlayerState> = {
  deck: 'deck',
  hand: 'hand',
  defense: 'defenseField',
  attack: 'attackField',
  support: 'supportField',
  gold: 'gold',
  goldPaid: 'goldPaid',
  graveyard: 'graveyard',
  removed: 'removed',
  exile: 'exile',
};

/** Resuelve una cantidad (fija o dinámica) contra el estado del propietario. */
export function resolveCount(count: AbilityCount, owner: PlayerState): number {
  if (count.kind === 'fixed') return Math.max(0, count.value);
  switch (count.source) {
    case 'allies_controlled':
      return owner.defenseField.length + owner.attackField.length;
    default:
      return 0;
  }
}

/** ¿La carta cumple los filtros (raza/tipo/coste máx.) del efecto invocar? */
export function isSummonEligible(card: Card, effect: SummonEffect): boolean {
  const tipoOk = effect.tipo ? card.tipo === effect.tipo : card.tipo === 'aliado';
  const razaOk = !effect.raza || card.raza === effect.raza;
  const costeOk = effect.maxCoste == null || card.coste <= effect.maxCoste;
  return tipoOk && razaOk && costeOk;
}

/** ¿La carta cumple los filtros (raza/tipo/coste máx.) de un aura `habilitar_juego`? */
export function isEnablePlayEligible(card: Card, effect: EnablePlayEffect): boolean {
  const tipoOk = effect.tipo ? card.tipo === effect.tipo : card.tipo === 'aliado';
  const razaOk = !effect.raza || card.raza === effect.raza;
  const costeOk = effect.maxCoste == null || card.coste <= effect.maxCoste;
  return tipoOk && razaOk && costeOk;
}

/** Coste a pagar por una carta jugada bajo un aura `habilitar_juego` (con tope). */
export function enablePlayCost(card: Card, effect: EnablePlayEffect): number {
  return Math.max(effect.minCoste, card.coste + effect.costDelta);
}

/** Reduce un CardInPlay a su Card base (para volver al Mazo Castillo). */
export function toBaseCard(c: CardInPlay | Card): Card {
  // Descarta los campos de instancia; conserva la definición de carta.
  const { instanceId, tapped, attackedThisTurn, summonedThisTurn, ...card } = c as CardInPlay;
  void instanceId;
  void tapped;
  void attackedThisTurn;
  void summonedThisTurn;
  return card as Card;
}

/**
 * Aplica un efecto "mover". El jugador AFECTADO es el controlador o su oponente
 * (`effect.target`); la cantidad dinámica se cuenta siempre sobre el controlador
 * (p.ej. "un oponente bota tantas como Aliados controles"). Toma `count` cartas
 * del frente (tope) de la zona origen y las agrega al destino. Solo baraja el
 * Mazo Castillo si `barajar` es explícito (botar del tope NO baraja).
 */
function applyMove(
  controller: PlayerState,
  opponent: PlayerState,
  effect: MoveEffect,
): { controller: PlayerState; opponent: PlayerState; log: string } | null {
  const targetsOpp = effect.target === 'opponent';
  const actor = targetsOpp ? opponent : controller;
  const fromKey = ZONE_KEY[effect.from];
  const toKey = ZONE_KEY[effect.to];
  const fromArr = actor[fromKey] as (Card | CardInPlay)[];
  if (!Array.isArray(fromArr) || fromArr.length === 0) return null;

  // La cantidad (fija o dinámica) se resuelve SIEMPRE sobre el controlador.
  const n = Math.min(resolveCount(effect.count, controller), fromArr.length);
  if (n <= 0) return null;

  const moving = fromArr.slice(0, n);
  const remainingFrom = fromArr.slice(n);

  const toIsDeck = effect.to === 'deck';
  const converted = toIsDeck
    ? moving.map(toBaseCard)
    : moving.map((c) => ('instanceId' in c ? (c as CardInPlay) : createCardInPlay(c as Card)));

  const next: PlayerState = { ...actor };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (next as any)[fromKey] = remainingFrom;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (next as any)[toKey] = [...(actor[toKey] as (Card | CardInPlay)[]), ...converted];

  // Barajar solo si la receta lo pide explícitamente.
  if (effect.barajar) next.deck = shuffleDeck(next.deck);

  // Espejos de estado dependientes del tamaño de zona (vida = Mazo Castillo).
  next.life = next.deck.length;
  next.goldCount = next.gold.length;

  const quien = targetsOpp ? 'un oponente' : 'el jugador';
  const log = `${quien} mueve ${n} carta(s) de ${ZONE_LABELS[effect.from]} a ${ZONE_LABELS[effect.to]}${
    effect.barajar ? ' y baraja el Mazo Castillo' : ''
  }.`;
  return targetsOpp
    ? { controller, opponent: next, log }
    : { controller: next, opponent, log };
}

/** Ejecuta la receta completa (solo efecto "mover" por ahora). */
export function runAbilityDefinition(
  controller: PlayerState,
  opponent: PlayerState,
  def: AbilityDefinition,
): { controller: PlayerState; opponent: PlayerState; log: string } | null {
  if (def.effect.kind === 'mover') return applyMove(controller, opponent, def.effect);
  return null;
}

/** ¿La receta debe dispararse en este momento del turno? */
export function definitionTriggersAt(def: AbilityDefinition, moment: AbilityMoment): boolean {
  return def.moments.includes(moment);
}

/** Modos que el motor ejecuta sin intervención del jugador. */
export function isAutoMode(mode: AbilityMode): boolean {
  return mode === 'automatica' || mode === 'obligatoria';
}

/** ¿La receta pide un límite de una vez por turno? */
export function isOncePerTurn(def: AbilityDefinition): boolean {
  return def.moments.includes('una_vez_turno');
}

/** Momento de fase asociado a cada fase del turno (o null si no aplica). */
const PHASE_MOMENT: Record<string, AbilityMoment | undefined> = {
  agrupacion: 'agrupacion',
  vigilia: 'vigilia',
  batalla: 'batalla',
  final: 'fase_final',
};

export function momentForPhase(phase: string): AbilityMoment | undefined {
  return PHASE_MOMENT[phase];
}

/**
 * ¿Una habilidad ACTIVABLE está disponible en la fase actual? Se permite si la
 * fase actual coincide con alguno de sus momentos de fase. Si la receta NO
 * declara ningún momento de fase (solo "una vez por turno"/entra_juego), se
 * permite en CUALQUIER fase del turno propio (regla de Koke: "una vez por
 * turno" = activable en cualquier fase). El combate se bloquea aparte.
 */
export function activableAvailableInPhase(def: AbilityDefinition, phase: string): boolean {
  const phaseMoments = def.moments.filter((m) =>
    (['agrupacion', 'vigilia', 'batalla', 'fase_final'] as AbilityMoment[]).includes(m),
  );
  if (phaseMoments.length === 0) return true;
  const current = momentForPhase(phase);
  return current !== undefined && phaseMoments.includes(current);
}
