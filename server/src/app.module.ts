import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CardsModule } from './cards/cards.module';
import { AbilitiesModule } from './abilities/abilities.module';
import { DecksModule } from './decks/decks.module';
import { GamesModule } from './games/games.module';
import { DriveModule } from './drive/drive.module';
import { env } from './config/env';

@Module({
  imports: [
    // In dev without MONGODB_URI the app still boots (health reports
    // db: 'not_configured'); in production the env loader fails fast.
    ...(env.mongodbUri ? [MongooseModule.forRoot(env.mongodbUri)] : []),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ...(env.mongodbUri
      ? [UsersModule, AuthModule, CardsModule, AbilitiesModule, DecksModule, GamesModule, DriveModule]
      : []),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
