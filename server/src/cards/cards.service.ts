import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { CatalogCard, CatalogCardDocument } from './card.schema';
import { SEED_CARDS } from './seed-cards';
import { UserRole } from '../users/user.schema';
import { env } from '../config/env';

export type CardInput = Partial<Omit<CatalogCard, '_id' | 'created_by'>> & {
  nombre: string;
  tipo: CatalogCard['tipo'];
  image_url: string;
};

@Injectable()
export class CardsService implements OnModuleInit {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectModel(CatalogCard.name) private readonly model: Model<CatalogCardDocument>,
  ) {}

  /** Seed the global catalog; also inserts any cards missing by nombre. */
  async onModuleInit() {
    if (!env.mongodbUri) return;
    const count = await this.model.estimatedDocumentCount();
    if (count === 0) {
      await this.model.insertMany(SEED_CARDS);
      this.logger.log(`Catalog seeded with ${SEED_CARDS.length} cards`);
      return;
    }
    // Upsert: add cards present in seed but not yet in the DB (by nombre)
    const existing = await this.model.distinct('nombre');
    const missing = SEED_CARDS.filter((c) => !existing.includes(c.nombre));
    if (missing.length > 0) {
      await this.model.insertMany(missing);
      this.logger.log(`Catalog: added ${missing.length} missing card(s): ${missing.map((c) => c.nombre).join(', ')}`);
    }
  }

  /** "Cartas disponibles": common users only see gated cards. */
  listForRole(role: UserRole): Promise<CatalogCard[]> {
    const filter = role === 'comun' ? { available_to_common: true } : {};
    return this.model.find(filter).sort({ numero_carta: 1 }).lean();
  }

  async findByIds(ids: string[]): Promise<CatalogCard[]> {
    return this.model.find({ _id: { $in: ids } }).lean();
  }

  async create(createdBy: string, input: CardInput): Promise<CatalogCard> {
    const doc = await this.model.create({ ...input, created_by: createdBy });
    return doc.toObject();
  }

  async update(id: string, patch: Partial<CardInput>): Promise<CatalogCard> {
    const card = await this.model
      .findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean();
    if (!card) throw new NotFoundException('Carta no encontrada');
    return card;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException('Carta no encontrada');
  }

  /**
   * Signed direct-upload params for Cloudinary: the binary never passes
   * through this server (free-tier bandwidth friendly).
   */
  uploadSignature(folder: string) {
    if (!env.cloudinary) {
      throw new NotImplementedException(
        'Cloudinary no está configurado en el servidor (CLOUDINARY_* en env)',
      );
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${folder}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
    const signature = createHash('sha1').update(toSign).digest('hex');
    return {
      cloud_name: env.cloudinary.cloudName,
      api_key: env.cloudinary.apiKey,
      timestamp,
      folder,
      signature,
    };
  }
}
