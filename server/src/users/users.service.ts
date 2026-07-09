import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from './users.repository';
import { User, UserRole, BoardTheme } from './user.schema';
import { env } from '../config/env';

export type PublicUser = Omit<User, 'password_hash'>;

export function toPublicUser(user: User): PublicUser {
  const { password_hash: _, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly repo: UsersRepository) {}

  /** Bootstrap: create the first admin from env if it doesn't exist. */
  async onModuleInit() {
    if (!env.mongodbUri || !env.seedAdminUsername || !env.seedAdminPassword) return;
    const existing = await this.repo.findByUsername(env.seedAdminUsername);
    if (existing) return;
    await this.repo.create({
      username: env.seedAdminUsername,
      password_hash: await bcrypt.hash(env.seedAdminPassword, 10),
      role: 'admin',
    });
    this.logger.log(`Seed admin '${env.seedAdminUsername}' created`);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return toPublicUser(user);
  }

  async updateMe(
    userId: string,
    patch: Partial<{ board_theme: BoardTheme; active_deck_id: string }>,
  ): Promise<PublicUser> {
    const user = await this.repo.update(userId, patch);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return toPublicUser(user);
  }

  async listAll(): Promise<PublicUser[]> {
    return (await this.repo.findAll()).map(toPublicUser);
  }

  async setRole(userId: string, role: UserRole): Promise<PublicUser> {
    const user = await this.repo.update(userId, { role });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return toPublicUser(user);
  }
}
