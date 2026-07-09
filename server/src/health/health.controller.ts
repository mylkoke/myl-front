import { Controller, Get, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { env } from '../config/env';

@Controller('health')
export class HealthController {
  constructor(
    @Optional() @InjectConnection() private readonly connection: Connection | null,
  ) {}

  @Get()
  check() {
    const dbState = env.mongodbUri && this.connection
      ? this.connection.readyState === 1
        ? 'connected'
        : 'disconnected'
      : 'not_configured';

    return {
      success: true,
      data: {
        status: 'ok',
        db: dbState,
        uptime: process.uptime(),
      },
    };
  }
}
