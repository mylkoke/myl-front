import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Game, GameDocument, Seat } from './game.schema';
import { DecksService } from '../decks/decks.service';
import { UsersRepository } from '../users/users.repository';
import { CatalogCard } from '../cards/card.schema';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Minimal shape the server needs to understand from the client GameState
 * to arbitrate who writes next (turn owner, or the defender mid-combat).
 */
interface ClientGameState {
  turn?: { currentPlayer?: Seat };
  combat?: { attackerId?: Seat; status?: string; activePlayer?: Seat } | null;
  isGameOver?: boolean;
  winner?: Seat | null;
}

export function deriveCurrentSeat(state: ClientGameState): Seat {
  // Declaración de bloqueo: escribe el defensor.
  if (state.combat?.status === 'awaiting_defense' && state.combat.attackerId) {
    return state.combat.attackerId === 'player' ? 'opponent' : 'player';
  }
  // Guerra de Talismanes: escribe el jugador activo (alterna entre ambos).
  if (state.combat?.status === 'talisman_war' && state.combat.activePlayer) {
    return state.combat.activePlayer;
  }
  return state.turn?.currentPlayer ?? 'player';
}

@Injectable()
export class GamesService {
  constructor(
    @InjectModel(Game.name) private readonly model: Model<GameDocument>,
    private readonly decks: DecksService,
    private readonly users: UsersRepository,
  ) {}

  async createRoom(hostId: string): Promise<Game> {
    // Ensure the host has a playable deck before opening the room.
    await this.decks.getActiveDeckCards(hostId);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const doc = await this.model.create({ host_id: hostId, room_code: randomCode() });
        return doc.toObject();
      } catch (e: unknown) {
        // Duplicate room_code: retry with a new one.
        if ((e as { code?: number }).code !== 11000) throw e;
      }
    }
    throw new BadRequestException('No se pudo generar un código de sala, reintenta');
  }

  async joinRoom(
    guestId: string,
    roomCode: string,
  ): Promise<{
    game: Game;
    seat: Seat;
    hostName: string;
    guestName: string;
    hostDeck: CatalogCard[];
    guestDeck: CatalogCard[];
  }> {
    const game = await this.model.findOne({ room_code: roomCode.toUpperCase() }).lean();
    if (!game) throw new NotFoundException('Sala no encontrada');

    // Rejoin: a participant re-entering an ongoing game.
    if (game.status !== 'waiting') {
      if (game.host_id !== guestId && game.guest_id !== guestId) {
        throw new ForbiddenException('La sala ya está en juego');
      }
      const seat: Seat = game.host_id === guestId ? 'player' : 'opponent';
      return { game, seat, hostName: '', guestName: '', hostDeck: [], guestDeck: [] };
    }

    if (game.host_id === guestId) {
      throw new BadRequestException('No puedes unirte a tu propia sala');
    }

    const [host, guest, hostDeck, guestDeck] = await Promise.all([
      this.users.findById(game.host_id),
      this.users.findById(guestId),
      this.decks.getActiveDeckCards(game.host_id),
      this.decks.getActiveDeckCards(guestId),
    ]);
    if (!host || !guest) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.model
      .findOneAndUpdate(
        { _id: game._id, status: 'waiting' },
        // current_seat stays null: the HOST pushes the initial state (v0→v1).
        { $set: { guest_id: guestId, status: 'playing' } },
        { new: true },
      )
      .lean();
    if (!updated) throw new BadRequestException('Otro jugador entró primero');

    return {
      game: updated,
      seat: 'opponent',
      hostName: host.username,
      guestName: guest.username,
      hostDeck,
      guestDeck,
    };
  }

  /** Names + expanded decks so the host can build the initial GameState. */
  async getInitPayload(gameId: string): Promise<{
    host_name: string;
    guest_name: string;
    host_deck: CatalogCard[];
    guest_deck: CatalogCard[];
  } | null> {
    const game = await this.model.findById(gameId).lean();
    if (!game?.guest_id) return null;
    const [host, guest, hostDeck, guestDeck] = await Promise.all([
      this.users.findById(game.host_id),
      this.users.findById(game.guest_id),
      this.decks.getActiveDeckCards(game.host_id),
      this.decks.getActiveDeckCards(game.guest_id),
    ]);
    if (!host || !guest) return null;
    return {
      host_name: host.username,
      guest_name: guest.username,
      host_deck: hostDeck,
      guest_deck: guestDeck,
    };
  }

  async getForUser(gameId: string, userId: string): Promise<Game> {
    const game = await this.model.findById(gameId).lean();
    if (!game) throw new NotFoundException('Partida no encontrada');
    if (game.host_id !== userId && game.guest_id !== userId) {
      throw new ForbiddenException('No participas en esta partida');
    }
    return game;
  }

  seatOf(game: Game, userId: string): Seat {
    return game.host_id === userId ? 'player' : 'opponent';
  }

  /**
   * Optimistic-versioned state push. Returns the new version, or null on
   * version conflict (caller should re-sync).
   */
  async pushState(
    gameId: string,
    userId: string,
    state: ClientGameState,
    expectedVersion: number,
  ): Promise<Game | null> {
    const game = await this.getForUser(gameId, userId);
    if (game.status === 'finished') throw new BadRequestException('La partida terminó');

    const seat = this.seatOf(game, userId);
    // While playing, only the seat indicated by current_seat may write.
    if (game.status === 'playing' && game.current_seat && game.current_seat !== seat) {
      throw new ForbiddenException('NOT_YOUR_TURN');
    }

    const finished = state.isGameOver === true;
    const updated = await this.model
      .findOneAndUpdate(
        { _id: gameId, version: expectedVersion },
        {
          $set: {
            state: state as Record<string, unknown>,
            current_seat: deriveCurrentSeat(state),
            ...(finished
              ? { status: 'finished', winner_seat: state.winner ?? null }
              : { status: 'playing' }),
          },
          $inc: { version: 1 },
        },
        { new: true },
      )
      .lean();

    return updated; // null → version conflict
  }

  async abandon(gameId: string, userId: string): Promise<Game> {
    const game = await this.getForUser(gameId, userId);
    const winner: Seat = this.seatOf(game, userId) === 'player' ? 'opponent' : 'player';
    const updated = await this.model
      .findByIdAndUpdate(
        gameId,
        { $set: { status: 'finished', winner_seat: winner } },
        { new: true },
      )
      .lean();
    return updated as Game;
  }
}
