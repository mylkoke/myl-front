import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type CardType = 'aliado' | 'totem' | 'arma' | 'talisman' | 'oro';

/**
 * GLOBAL card catalog: created by admin/supervisor in editor mode.
 * `available_to_common` + `categoria` prepare future gating by category.
 */
@Schema({
  collection: 'cards',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class CatalogCard {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ type: String, default: null })
  created_by: string | null;

  @Prop({ required: true })
  nombre: string;

  @Prop({ type: String, required: true, enum: ['aliado', 'totem', 'arma', 'talisman', 'oro'] })
  tipo: CardType;

  @Prop({ default: 0 })
  fuerza: number;

  @Prop({ default: 0 })
  coste: number;

  @Prop({ default: '' })
  historia: string;

  /** "Habilidad de carta": texto personalizado por carta. */
  @Prop({ default: '' })
  habilidad: string;

  @Prop({ type: Number, default: null })
  bonus_fuerza: number | null;

  /** Raza del aliado (p.ej. 'Caudillo'); condiciona efectos que buscan por raza. */
  @Prop({ type: String, default: null })
  raza: string | null;

  /** Codes of special abilities (fixed list), accumulative. */
  @Prop({ type: [String], default: [] })
  special_abilities: string[];

  @Prop({ default: 'real' })
  tipo_sello: string;

  @Prop({ default: 'comun' })
  rareza: string;

  @Prop({ type: String, default: null })
  expansion: string | null;

  @Prop({ default: '' })
  ilustrador: string;

  @Prop({ default: 0 })
  cantidad_edicion: number;

  @Prop({ default: 0 })
  numero_carta: number;

  @Prop({ required: true })
  image_url: string;

  @Prop({ type: String, default: null })
  categoria: string | null;

  /** True si la habilidad de la carta aún NO tiene lógica de juego implementada. */
  @Prop({ default: false })
  logica_pendiente: boolean;

  @Prop({ default: true })
  available_to_common: boolean;
}

export type CatalogCardDocument = HydratedDocument<CatalogCard>;
export const CatalogCardSchema = SchemaFactory.createForClass(CatalogCard);
