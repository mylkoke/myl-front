import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type UserRole = 'admin' | 'supervisor' | 'comun';

export interface BoardTheme {
  mode: 'preset' | 'custom-color' | 'image';
  preset_id: string;
  custom_color: string;
  image_url: string | null;
  overlay_opacity: number;
}

// snake_case + uuid string _id: mirrors the future PostgreSQL schema
// so the eventual migration is a repository swap, not a data redesign.
@Schema({
  collection: 'users',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class User {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop({ type: String, enum: ['admin', 'supervisor', 'comun'], default: 'comun' })
  role: UserRole;

  @Prop({ type: Object, default: null })
  board_theme: BoardTheme | null;

  @Prop({ type: String, default: null })
  active_deck_id: string | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
