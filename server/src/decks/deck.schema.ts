import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { randomUUID } from 'crypto';

export interface DeckEntry {
  card_id: string;
  qty: number;
}

// `entries` embedded maps 1:1 to a future deck_cards(deck_id, card_id, qty)
// table in PostgreSQL.
@Schema({
  collection: 'decks',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Deck {
  @Prop({ type: String, default: () => randomUUID() })
  _id: string;

  @Prop({ required: true, index: true })
  owner_id: string;

  @Prop({ default: 'Mi mazo' })
  name: string;

  @Prop({ type: [{ card_id: String, qty: Number, _id: false }], default: [] })
  entries: DeckEntry[];
}

export type DeckDocument = HydratedDocument<Deck>;
export const DeckSchema = SchemaFactory.createForClass(Deck);
