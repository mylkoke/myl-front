export type SealType = 'real' | 'ultra real' | 'mega real' | string;

export type CardType =
  | 'aliado'    // Va a línea de defensa; al atacar se mueve a línea de ataque
  | 'totem'     // Va a línea de apoyo (permanente)
  | 'arma'      // Se equipa a un aliado; con "maquinaria" puede jugarse en apoyo
  | 'talisman'  // Efecto inmediato → va directo al cementerio
  | 'oro';      // Va a zona de oros (O)

/**
 * Habilidades especiales: lista fija extensible gestionada en el Modo editor.
 * Codes conocidos con interacción implementada: 'maquinaria', 'defensor'.
 */
export type SpecialAbility = string;

/**
 * 'especial' = habilidad especial / keyword acumulable (en la carta aparece en
 * negrita: Furia, Maquinaria…); 'carta' = habilidad de carta con mecánica
 * propia (texto normal: Invocación Caudillo, Castigo al bloqueo…).
 */
export type AbilityCategory = 'especial' | 'carta';

export interface SpecialAbilityInfo {
  id: string;
  code: string;
  nombre: string;
  descripcion: string;
  implemented: boolean;
  categoria: AbilityCategory;
  /** Tipos de carta a los que aplica (vacío = todos). */
  tipos: CardType[];
}

export type CardRarity = 'comun' | 'infrecuente' | 'raro' | 'ultra raro';

export interface Card {
  id: string;
  nombre: string;
  fuerza: number;
  coste: number;
  historia: string;
  habilidad: string;
  imagen: string;
  ilustrador: string;
  cantidadEdicion: number;
  numeroCarta: number;
  tipoSello: SealType;
  tipo: CardType;
  rareza: CardRarity;
  /** Raza del aliado (p.ej. 'Caudillo'); condiciona efectos que buscan por raza */
  raza?: string;
  /** Bonus de fuerza que aporta esta arma al aliado equipado */
  bonusFuerza?: number;
  /** Habilidades con reglas especiales, p.ej. 'maquinaria' en armas */
  habilidadesEspeciales?: SpecialAbility[];
  expansion?: string;
  /** True si la habilidad de la carta aún no tiene lógica de juego (no 100% jugable). */
  logicaPendiente?: boolean;
}

export interface CardInPlay extends Card {
  instanceId: string;
  tapped: boolean;
  attackedThisTurn: boolean;
  /**
   * True el turno en que el aliado entra en juego. Un aliado recién invocado
   * no puede atacar ese mismo turno (debe haber estado desde la Agrupación),
   * salvo que tenga la habilidad especial 'furia'. Se limpia al comenzar el
   * siguiente turno de su dueño.
   */
  summonedThisTurn: boolean;
}
