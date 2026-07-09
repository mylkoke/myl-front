import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../users/users.repository';
import { toPublicUser, PublicUser } from '../users/users.service';
import { User } from '../users/user.schema';
import { DecksService } from '../decks/decks.service';
import { JwtPayload } from './jwt.strategy';
import { env } from '../config/env';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly decks: DecksService,
  ) {}

  async register(username: string, password: string): Promise<AuthResult> {
    const existing = await this.users.findByUsername(username);
    if (existing) throw new ConflictException('Ese nombre de usuario ya existe');

    const user = await this.users.create({
      username,
      password_hash: await bcrypt.hash(password, 10),
      role: 'comun',
    });
    const deck = await this.decks.createInitialDeck(user._id);
    return this.buildAuthResult({ ...user, active_deck_id: deck._id });
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByUsername(username);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }
    return this.buildAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: env.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Sesión expirada, vuelve a iniciar sesión');
    }
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user._id,
      username: user.username,
      role: user.role,
    };
    return {
      user: toPublicUser(user),
      accessToken: this.jwt.sign(payload, { secret: env.jwtSecret, expiresIn: '15m' }),
      refreshToken: this.jwt.sign(payload, {
        secret: env.jwtRefreshSecret,
        expiresIn: '7d',
      }),
    };
  }
}
