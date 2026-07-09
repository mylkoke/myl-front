import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export type GameStatus = 'waiting' | 'playing' | 'finished';
export type Seat = 'player' | 'opponent'; // host = 'player', guest = 'opponent'

@Schema({
  collection: 'games',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Game {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ required: true, unique: true, index: true })
  room_code: string;

  @Prop({ required: true })
  host_id: string;

  @Prop({ type: String, default: null })
  guest_id: string | null;

  @Prop({ type: String, enum: ['waiting', 'playing', 'finished'], default: 'waiting' })
  status: GameStatus;

  /** Full serialized GameState (client-owned shape). */
  @Prop({ type: Object, default: null })
  state: Record<string, unknown> | null;

  @Prop({ default: 0 })
  version: number;

  /** Which seat is allowed to write the NEXT push. */
  @Prop({ type: String, enum: ['player', 'opponent'], default: null })
  current_seat: Seat | null;

  @Prop({ type: String, enum: ['player', 'opponent'], default: null })
  winner_seat: Seat | null;
}

export type GameDocument = HydratedDocument<Game>;
export const GameSchema = SchemaFactory.createForClass(Game);
