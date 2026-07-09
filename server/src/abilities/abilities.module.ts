import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpecialAbility, SpecialAbilitySchema } from './special-ability.schema';
import { AbilitiesController, AbilitiesService } from './abilities.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SpecialAbility.name, schema: SpecialAbilitySchema }]),
  ],
  controllers: [AbilitiesController],
  providers: [AbilitiesService],
})
export class AbilitiesModule {}
