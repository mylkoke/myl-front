/**
 * Registro en memoria de las recetas declarativas (`AbilityDefinition`) por
 * `code`. El motor de juego no tiene acceso al catálogo de habilidades (las
 * cartas solo llevan los `code` en `habilidadesEspeciales`), así que cargamos
 * las definiciones una vez al iniciar la partida y el intérprete las consulta
 * por código.
 */
import type { AbilityDefinition, AbilityZone, EnablePlayEffect } from '@/types/ability.types';
import type { Card } from '@/types/card.types';
import type { PlayerState } from '@/types/game.types';
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

/** Reemplaza el registro con una lista de definiciones (code → definition). */
export function setAbilityDefinitions(entries: { code: string; definition: AbilityDefinition }[]): void {
  registry.clear();
  for (const { code, definition } of entries) registry.set(code, definition);
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
