import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { GamesService } from './games.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { env } from '../config/env';

interface SocketUser {
  id: string;
  username: string;
}

interface AuthedSocket extends Socket {
  data: { user?: SocketUser; gameId?: string };
}

const room = (gameId: string) => `game:${gameId}`;

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: env.corsOrigin.split(',').map((o) => o.trim()), credentials: true },
})
export class GamesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(GamesGateway.name);

  constructor(
    private readonly games: GamesService,
    private readonly jwt: JwtService,
  ) {}

  /** JWT auth on handshake: `io('/game', { auth: { token } })`. */
  handleConnection(client: AuthedSocket) {
    try {
      const token = (client.handshake.auth as { token?: string }).token;
      if (!token) throw new Error('missing token');
      const payload = this.jwt.verify<JwtPayload>(token, { secret: env.jwtSecret });
      client.data.user = { id: payload.sub, username: payload.username };
    } catch {
      client.emit('error_msg', { code: 'UNAUTHORIZED', message: 'Sesión inválida' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket) {
    if (client.data.gameId) {
      client.to(room(client.data.gameId)).emit('opponent_presence', { online: false });
    }
  }

  @SubscribeMessage('join_game')
  async joinGame(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { game_id: string },
  ) {
    const user = client.data.user;
    if (!user) return;
    try {
      const game = await this.games.getForUser(body.game_id, user.id);
      client.data.gameId = game._id;
      await client.join(room(game._id));
      client.to(room(game._id)).emit('opponent_presence', { online: true, username: user.username });
      // Current snapshot so reconnects rehydrate instantly.
      client.emit('state_update', {
        state: game.state,
        version: game.version,
        status: game.status,
        winner_seat: game.winner_seat,
        seat: this.games.seatOf(game, user.id),
      });
      // Game just paired and has no state yet: give the whole room the
      // decks + names so the HOST builds and pushes the initial state.
      if (game.status === 'playing' && game.version === 0) {
        const payload = await this.games.getInitPayload(game._id);
        if (payload) {
          this.server.to(room(game._id)).emit('opponent_joined', {
            username: user.username,
            ...payload,
          });
        }
      } else if (game.status === 'playing') {
        client.to(room(game._id)).emit('opponent_joined', { username: user.username });
      }
    } catch (e) {
      client.emit('error_msg', {
        code: 'JOIN_FAILED',
        message: e instanceof Error ? e.message : 'No se pudo entrar a la partida',
      });
    }
  }

  @SubscribeMessage('push_state')
  async pushState(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    body: { game_id: string; state: Record<string, unknown>; expected_version: number },
  ) {
    const user = client.data.user;
    if (!user) return;
    try {
      const updated = await this.games.pushState(
        body.game_id,
        user.id,
        body.state,
        body.expected_version,
      );
      if (!updated) {
        // Version conflict: send back the authoritative state.
        const game = await this.games.getForUser(body.game_id, user.id);
        client.emit('error_msg', { code: 'VERSION_CONFLICT', message: 'Estado desactualizado' });
        client.emit('state_update', {
          state: game.state,
          version: game.version,
          status: game.status,
          winner_seat: game.winner_seat,
          seat: this.games.seatOf(game, user.id),
        });
        return;
      }
      this.server.to(room(body.game_id)).emit('state_update', {
        state: updated.state,
        version: updated.version,
        status: updated.status,
        winner_seat: updated.winner_seat,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error sincronizando';
      client.emit('error_msg', {
        code: message === 'NOT_YOUR_TURN' ? 'NOT_YOUR_TURN' : 'PUSH_FAILED',
        message: message === 'NOT_YOUR_TURN' ? 'No es tu turno' : message,
      });
    }
  }

  @SubscribeMessage('abandon')
  async abandon(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { game_id: string },
  ) {
    const user = client.data.user;
    if (!user) return;
    try {
      const game = await this.games.abandon(body.game_id, user.id);
      this.server.to(room(body.game_id)).emit('state_update', {
        state: game.state,
        version: game.version,
        status: game.status,
        winner_seat: game.winner_seat,
      });
    } catch {
      /* noop */
    }
  }
}
