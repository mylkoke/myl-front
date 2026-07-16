import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

/** 'especial' = keyword acumulable (Furia, Maquinaria…); 'carta' = habilidad de carta con mecánica propia (Invocación Caudillo…). */
export type AbilityCategory = 'especial' | 'carta';

/**
 * Fixed (but extensible) list of special abilities assignable to any card.
 * `implemented` marks whether the ability already has a game interaction.
 */
@Schema({
  collection: 'special_abilities',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class SpecialAbility {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ required: true })
  nombre: string;

  @Prop({ default: '' })
  descripcion: string;

  @Prop({ default: false })
  implemented: boolean;

  @Prop({ type: String, enum: ['especial', 'carta'], default: 'especial' })
  categoria: AbilityCategory;

  /** Tipos de carta a los que aplica (vacío = todos los tipos). */
  @Prop({ type: [String], default: [] })
  tipos: string[];

  /**
   * Receta declarativa (habilidades hechas con el constructor visual). Si está
   * presente, el motor la interpreta genéricamente; si no, se usa la lógica
   * programada por `code`. Estructura libre: { moments, mode, effect }.
   */
  @Prop({ type: Object, default: null })
  definition: Record<string, unknown> | null;
}

export type SpecialAbilityDocument = HydratedDocument<SpecialAbility>;
export const SpecialAbilitySchema = SchemaFactory.createForClass(SpecialAbility);
