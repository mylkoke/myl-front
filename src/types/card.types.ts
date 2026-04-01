export type SealType = 'real' | 'ultra real' | 'mega real' | string;

export type CardType = 'aliado' | 'talisman' | 'arma' | 'tierra' | 'oro';

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
  /** Bonus de fuerza que aporta esta carta (usado por armas) */
  bonusFuerza?: number;
  expansion?: string;
}

export interface CardInPlay extends Card {
  instanceId: string;
  tapped: boolean;
  attackedThisTurn: boolean;
}
