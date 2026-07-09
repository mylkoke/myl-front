import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogCard, CatalogCardSchema } from './card.schema';
import { CardsService } from './cards.service';
import { CardsController, UploadsController } from './cards.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CatalogCard.name, schema: CatalogCardSchema }]),
  ],
  controllers: [CardsController, UploadsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
