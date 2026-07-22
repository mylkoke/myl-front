/**
 * Registro en memoria de las recetas declarativas (`AbilityDefinition`) por
 * `code`. El motor de juego no tiene acceso al catálogo de habilidades (las
 * cartas solo llevan los `code` en `habilidadesEspeciales`), así que cargamos
 * las definiciones una vez al iniciar la partida y el intérprete las consulta
 * por código.
 */
import type { AbilityDefinition, AbilityZone, EnablePlayEffect } from '@/types/ability.types';
import type { Card, CardInPlay } from '@/types/card.types';
import type { PlayerId, PlayerState } from '@/types/game.types';
import { getServices } from '@/services';
import { enablePlayCost, isEnablePlayEligible } from '@/utils/abilityInterpreter';

const registry = new Map<string, AbilityDefinition>();

/** Consulta la receta declarativa de un `code` (o `undefined` si es imperativa). */
export function getAbilityDefinition(code: string): AbilityDefinition | undefined {
  return registry.get(code);
}

/** Recetas declarativas de una carta (por sus `code`), con su definición. */
export function getDeclarativeAbilitiesOf(card: Card): { code: string; def: AbilityDefinition }[] {
  return (card.habilidadesEspeciales ?? [])
    .map((code) => ({ code, def: registry.get(code) }))
    .filter((x): x is { code: string; def: AbilityDefinition } => !!x.def);
}

/** ¿Este `code` corresponde a una habilidad declarativa (con receta)? */
export function isDeclarative(code: string): boolean {
  return registry.has(code);
}

/**
 * Auras `habilitar_juego` activas: recetas (momento `mientras_en_juego`) de las
 * cartas que el propietario tiene EN JUEGO (defensa/ataque/apoyo). Efecto
 * continuo: si la carta portadora sale de juego, su aura deja de contarse.
 */
export function getEnablePlayAuras(owner: PlayerState): EnablePlayEffect[] {
  const inPlay = [...owner.defenseField, ...owner.attackField, ...owner.supportField];
  const auras: EnablePlayEffect[] = [];
  for (const c of inPlay) {
    for (const { def } of getDeclarativeAbilitiesOf(c)) {
      if (def.effect.kind === 'habilitar_juego' && def.moments.includes('mientras_en_juego')) {
        auras.push(def.effect);
      }
    }
  }
  return auras;
}

/**
 * Bono de Fuerza declarativo ('buff_fuerza', aura `mientras_en_juego`) que
 * recibe `ally` por las cartas EN JUEGO de su controlador `owner`. Dinámico:
 * cuenta aliados de `countRaza` en el ámbito `scope` (propio o ambos jugadores),
 * excluyendo al propio aliado si `excludeSelf`. Se integra en `effectiveForce`.
 */
export function getDeclarativeForceBuff(
  ally: CardInPlay,
  owner: PlayerState,
  players: Record<PlayerId, PlayerState>,
): number {
  if (ally.tipo !== 'aliado') return 0;
  let bonus = 0;
  for (const source of [...owner.defenseField, ...owner.attackField]) {
    for (const { def } of getDeclarativeAbilitiesOf(source)) {
      if (def.effect.kind !== 'buff_fuerza' || !def.moments.includes('mientras_en_juego')) continue;
      const e = def.effect;
      // ¿Este aliado recibe el bono? (raza objetivo)
      if (e.targetRaza && ally.raza !== e.targetRaza) continue;
      const pool =
        e.scope === 'both'
          ? Object.values(players).flatMap((p) => [...p.defenseField, ...p.attackField])
          : [...owner.defenseField, ...owner.attackField];
      let count = pool.filter(
        (c) => c.tipo === 'aliado' && (!e.countRaza || c.raza === e.countRaza),
      ).length;
      // "por cada OTRO": no contar al propio aliado si él mismo entra en el conteo.
      if (e.excludeSelf && (!e.countRaza || ally.raza === e.countRaza)) count -= 1;
      bonus += e.amount * Math.max(0, count);
    }
  }
  return bonus;
}

/**
 * Efecto declarativo `jugar_desde_zona` de una carta (propiedad pasiva): permite
 * jugarla desde la zona `from`; si `thenExile`, se destierra tras jugarse así.
 */
export function getDeclPlayFromZone(card: Card): { from: AbilityZone; thenExile: boolean } | null {
  for (const { def } of getDeclarativeAbilitiesOf(card)) {
    if (def.effect.kind === 'jugar_desde_zona') {
      return { from: def.effect.from, thenExile: def.effect.thenExile };
    }
  }
  return null;
}

/** Mínimo de Oros de un efecto declarativo `coste_gratis_condicional` (o null). */
export function getDeclFreeCostMinGold(card: Card): number | null {
  for (const { def } of getDeclarativeAbilitiesOf(card)) {
    if (def.effect.kind === 'coste_gratis_condicional') return Math.max(0, def.effect.minGold);
  }
  return null;
}

/**
 * Efecto declarativo `buff_objetivo` disparado al entrar en juego (momento
 * `entra_juego`): `amount` de Fuerza + `scope`, o null. Usado para iniciar el
 * targeting de potenciar un Aliado al jugar la carta.
 */
export function getDeclBuffTargetOnEnter(card: Card): { amount: number; scope: 'self' | 'opponent' | 'both' } | null {
  for (const { def } of getDeclarativeAbilitiesOf(card)) {
    if (def.effect.kind === 'buff_objetivo' && def.moments.includes('entra_juego')) {
      return { amount: def.effect.amount, scope: def.effect.scope };
    }
  }
  return null;
}

/**
 * ¿La carta tiene una habilidad declarativa activable en la Fase Final que la
 * agrupe a sí misma (`recuperar_self` con momento `fase_final`)? Devuelve la zona
 * destino (típicamente la Línea de Defensa) o `null`. Usado para abrir el modal
 * de agrupado al comenzar la Fase Final.
 */
export function getFaseFinalSelfMove(card: Card): { toZone: AbilityZone } | null {
  for (const { def } of getDeclarativeAbilitiesOf(card)) {
    if (
      def.effect.kind === 'recuperar_self' &&
      def.moments.includes('fase_final') &&
      def.mode === 'activable'
    ) {
      return { toZone: def.effect.to };
    }
  }
  return null;
}

/**
 * Receta de recuperación al ser anulada de una carta: busca una definición
 * declarativa con momento `al_ser_anulado` y efecto `recuperar_self`. Devuelve
 * la zona destino y el coste de botado (mill), o `null` si la carta no la tiene.
 */
export function getAnnulRecover(card: Card): { toZone: AbilityZone; millCount: number } | null {
  for (const { def } of getDeclarativeAbilitiesOf(card)) {
    if (def.effect.kind === 'recuperar_self' && def.moments.includes('al_ser_anulado')) {
      return { toZone: def.effect.to, millCount: Math.max(0, def.costMill ?? 0) };
    }
  }
  return null;
}

/**
 * ¿Algún aura del propietario habilita jugar `card` desde `zone`? Devuelve el
 * coste a pagar (descuento ya aplicado, con tope) o `null` si ninguna la
 * habilita. Con varias auras aplicables, gana el menor coste.
 */
export function auraEnablesPlayFromZone(
  card: Card,
  zone: AbilityZone,
  owner: PlayerState,
): number | null {
  let best: number | null = null;
  for (const effect of getEnablePlayAuras(owner)) {
    if (effect.from !== zone || !isEnablePlayEligible(card, effect)) continue;
    const cost = enablePlayCost(card, effect);
    best = best === null ? cost : Math.min(best, cost);
  }
  return best;
}

/**
 * ¿La `definition` está bien formada? El motor asume en todas partes que una
 * receta registrada tiene `effect` (con `kind`) y `moments` (array). Una entrada
 * malformada del catálogo (Atlas) reventaría el render (effectiveForce, AllySlot…);
 * la validamos al cargar para que el registro solo contenga recetas seguras.
 */
function isValidDefinition(def: unknown): def is AbilityDefinition {
  if (!def || typeof def !== 'object') return false;
  const d = def as Partial<AbilityDefinition>;
  return (
    Array.isArray(d.moments) &&
    !!d.effect &&
    typeof d.effect === 'object' &&
    typeof (d.effect as { kind?: unknown }).kind === 'string'
  );
}

/** Reemplaza el registro con una lista de definiciones (code → definition). */
export function setAbilityDefinitions(entries: { code: string; definition: AbilityDefinition }[]): void {
  registry.clear();
  for (const { code, definition } of entries) {
    if (isValidDefinition(definition)) registry.set(code, definition);
  }
}

/**
 * Carga las definiciones desde el catálogo del backend. Idempotente y tolerante
 * a fallos: si la llamada falla (offline, etc.) el registro queda vacío y las
 * cartas simplemente no ejecutan recetas declarativas.
 */
export async function loadAbilityDefinitions(): Promise<void> {
  try {
    const abilities = await getServices().catalog.listAbilities();
    setAbilityDefinitions(
      abilities
        .filter((a): a is typeof a & { definition: AbilityDefinition } => !!a.definition)
        .map((a) => ({ code: a.code, definition: a.definition })),
    );
  } catch {
    // Silencioso: sin definiciones, el juego funciona con la lógica imperativa.
  }
}
