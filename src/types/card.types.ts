export type SealType = 'real' | 'ultra real' | 'mega real' | string;

export type CardType =
  | 'aliado'    // Va a línea de defensa; al atacar se mueve a línea de ataque
  | 'totem'     // Va a línea de apoyo (permanente)
  | 'arma'      // Se equipa a un aliado en defensa
  | 'tierra'    // Se juega en línea de apoyo o defensa (efectos de zona)
  | 'talisman'  // Efecto inmediato → va directo al cementerio
  | 'oro';      // Va a zona de oros (O)

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
  /** Bonus de fuerza que aporta esta arma al aliado equipado */
  bonusFuerza?: number;
  expansion?: string;
}

export interface CardInPlay extends Card {
  instanceId: string;
  tapped: boolean;
  attackedThisTurn: boolean;
}
