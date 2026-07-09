import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Deck, DeckDocument, DeckEntry } from './deck.schema';
import { CardsService } from '../cards/cards.service';
import { CatalogCard } from '../cards/card.schema';
import { UsersRepository } from '../users/users.repository';
import { UserRole } from '../users/user.schema';

export const MAX_DECK_CARDS = 60;

@Injectable()
export class DecksService {
  constructor(
    @InjectModel(Deck.name) private readonly model: Model<DeckDocument>,
    private readonly cards: CardsService,
    private readonly users: UsersRepository,
  ) {}

  listMine(ownerId: string): Promise<Deck[]> {
    return this.model.find({ owner_id: ownerId }).sort({ created_at: 1 }).lean();
  }

  async getMine(ownerId: string, deckId: string): Promise<{ deck: Deck; cards: CatalogCard[] }> {
    const deck = await this.model.findOne({ _id: deckId, owner_id: ownerId }).lean();
    if (!deck) throw new NotFoundException('Mazo no encontrado');
    const cards = await this.cards.findByIds(deck.entries.map((e) => e.card_id));
    return { deck, cards };
  }

  async setEntries(
    ownerId: string,
    role: UserRole,
    deckId: string,
    entries: DeckEntry[],
  ): Promise<Deck> {
    const total = entries.reduce((sum, e) => sum + e.qty, 0);
    if (total > MAX_DECK_CARDS) {
      throw new UnprocessableEntityException(
        `El mazo no puede superar ${MAX_DECK_CARDS} cartas (tiene ${total})`,
      );
    }
    if (entries.some((e) => e.qty < 1)) {
      throw new BadRequestException('Cantidades inválidas');
    }

    // Every card must exist and be available for the user's role.
    const found = await this.cards.findByIds(entries.map((e) => e.card_id));
    const foundIds = new Set(found.map((c) => c._id));
    if (entries.some((e) => !foundIds.has(e.card_id))) {
      throw new BadRequestException('El mazo referencia cartas inexistentes');
    }
    if (role === 'comun' && found.some((c) => !c.available_to_common)) {
      throw new BadRequestException('Incluye cartas no disponibles para tu cuenta');
    }

    const deck = await this.model
      .findOneAndUpdate({ _id: deckId, owner_id: ownerId }, { $set: { entries } }, { new: true })
      .lean();
    if (!deck) throw new NotFoundException('Mazo no encontrado');
    return deck;
  }

  /** Called on register: starter deck from the catalog + set as active. */
  async createInitialDeck(ownerId: string): Promise<Deck> {
    const catalog = await this.cards.listForRole('comun');
    const entries: DeckEntry[] = catalog.map((card) => ({
      card_id: card._id,
      qty: card.tipo === 'oro' ? 6 : 2,
    }));
    // Trim to the limit preserving order (golds are at the end of the seed).
    let total = entries.reduce((s, e) => s + e.qty, 0);
    while (total > MAX_DECK_CARDS && entries.length > 0) {
      const last = entries[entries.length - 1];
      if (last.qty > 1) {
        last.qty--;
      } else {
        entries.pop();
      }
      total--;
    }

    const doc = await this.model.create({
      owner_id: ownerId,
      name: 'Mazo inicial',
      entries,
    });
    await this.users.update(ownerId, { active_deck_id: doc._id });
    return doc.toObject();
  }

  /** Expanded card list (qty copies) of the user's active deck, for the game. */
  async getActiveDeckCards(ownerId: string): Promise<CatalogCard[]> {
    const user = await this.users.findById(ownerId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    // Self-healing: users created before the deck system (e.g. the seed
    // admin) get their starter deck lazily.
    const activeDeckId = user.active_deck_id ?? (await this.createInitialDeck(ownerId))._id;
    const { deck, cards } = await this.getMine(ownerId, activeDeckId);
    const byId = new Map(cards.map((c) => [c._id, c]));
    const expanded: CatalogCard[] = [];
    for (const entry of deck.entries) {
      const card = byId.get(entry.card_id);
      if (!card) continue;
      for (let i = 0; i < entry.qty; i++) expanded.push(card);
    }
    return expanded;
  }
}
