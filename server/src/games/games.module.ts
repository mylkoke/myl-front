import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Game, GameSchema } from './game.schema';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GamesGateway } from './games.gateway';
import { DecksModule } from '../decks/decks.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Game.name, schema: GameSchema }]),
    DecksModule,
    UsersModule,
    JwtModule.register({}),
  ],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway],
})
export class GamesModule {}
