export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_ORDER: CardSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/**
 * Discrete size steps by card count in a line.
 * Rule: las primeras 2 cartas se ven grandes; por cada 2 adicionales baja un paso.
 *   1-2 → xl  (muy grandes)
 *   3-4 → lg  (grandes)
 *   5-6 → md  (medianas)
 *   7-8 → sm  (pequeñas)
 *    9+ → xs  (mínimo)
 */
export function getLineCardSize(count: number): CardSize {
  if (count <= 2) return 'xl';
  if (count <= 4) return 'lg';
  if (count <= 6) return 'md';
  if (count <= 8) return 'sm';
  return 'xs';
}

/** One step smaller (used for the weapon tucked under an ally). */
export function smallerSize(size: CardSize): CardSize {
  const idx = SIZE_ORDER.indexOf(size);
  return SIZE_ORDER[Math.max(0, idx - 1)];
}
