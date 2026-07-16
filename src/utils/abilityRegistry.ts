/**
 * Registro en memoria de las recetas declarativas (`AbilityDefinition`) por
 * `code`. El motor de juego no tiene acceso al catálogo de habilidades (las
 * cartas solo llevan los `code` en `habilidadesEspeciales`), así que cargamos
 * las definiciones una vez al iniciar la partida y el intérprete las consulta
 * por código.
 */
import type { AbilityDefinition } from '@/types/ability.types';
import type { Card } from '@/types/card.types';
import { getServices } from '@/services';

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
