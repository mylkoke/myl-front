import { io, Socket } from 'socket.io-client';
import type { GameState, PlayerId } from '@/types/game.types';
import type { Card } from '@/types/card.types';
import { apiFetch, getAccessToken, getApiUrl } from './http';
import { toCard, type ServerCard } from './catalogService';

export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface StateUpdate {
  state: GameState | null;
  version: number;
  status: GameStatus;
  winner_seat: PlayerId | null;
}

export interface JoinResult {
  gameId: string;
  status: GameStatus;
  seat: PlayerId;
  hostName: string;
  guestName: string;
  hostDeck: Card[];
  guestDeck: Card[];
  state: GameState | null;
  version: number;
}

export interface OpponentJoinedPayload {
  username: string;
  /** Present only on the initial pairing (version 0): host builds the state. */
  hostName?: string;
  guestName?: string;
  hostDeck?: Card[];
  guestDeck?: Card[];
}

interface SyncHandlers {
  onStateUpdate: (update: StateUpdate) => void;
  onOpponentJoined: (payload: OpponentJoinedPayload) => void;
  onPresence: (online: boolean) => void;
  onError: (code: string, message: string) => void;
  onConnectionChange: (connected: boolean) => void;
}

let socket: Socket | null = null;

export const apiGameSyncService = {
  async createRoom(): Promise<{ gameId: string; roomCode: string }> {
    const data = await apiFetch<{ game_id: string; room_code: string }>('/api/games', {
      method: 'POST',
    });
    return { gameId: data.game_id, roomCode: data.room_code };
  },

  async joinRoom(roomCode: string): Promise<JoinResult> {
    const d = await apiFetch<{
      game_id: string;
      status: GameStatus;
      seat: PlayerId;
      host_name: string;
      guest_name: string;
      host_deck: ServerCard[];
      guest_deck: ServerCard[];
      state: GameState | null;
      version: number;
    }>('/api/games/join', { method: 'POST', body: { room_code: roomCode.toUpperCase() } });
    return {
      gameId: d.game_id,
      status: d.status,
      seat: d.seat,
      hostName: d.host_name,
      guestName: d.guest_name,
      hostDeck: d.host_deck.map(toCard),
      guestDeck: d.guest_deck.map(toCard),
      state: d.state,
      version: d.version,
    };
  },

  async getGame(gameId: string): Promise<{
    status: GameStatus;
    seat: PlayerId;
    roomCode: string;
    state: GameState | null;
    version: number;
    winnerSeat: PlayerId | null;
  }> {
    const d = await apiFetch<{
      status: GameStatus;
      seat: PlayerId;
      room_code: string;
      state: GameState | null;
      version: number;
      winner_seat: PlayerId | null;
    }>(`/api/games/${gameId}`);
    return {
      status: d.status,
      seat: d.seat,
      roomCode: d.room_code,
      state: d.state,
      version: d.version,
      winnerSeat: d.winner_seat,
    };
  },

  /** Connect (or reuse) the /game socket and join the game room. */
  connect(gameId: string, handlers: SyncHandlers): () => void {
    this.disconnect();

    socket = io(`${getApiUrl()}/game`, {
      auth: { token: getAccessToken() },
      transports: ['websocket', 'polling'],
    });

    const join = () => socket?.emit('join_game', { game_id: gameId });

    socket.on('connect', () => {
      handlers.onConnectionChange(true);
      join(); // also runs on every reconnect → instant rehydration
    });
    socket.on('disconnect', () => handlers.onConnectionChange(false));
    socket.on('state_update', (u: StateUpdate) => handlers.onStateUpdate(u));
    socket.on(
      'opponent_joined',
      (d: {
        username: string;
        host_name?: string;
        guest_name?: string;
        host_deck?: ServerCard[];
        guest_deck?: ServerCard[];
      }) =>
        handlers.onOpponentJoined({
          username: d.username,
          hostName: d.host_name,
          guestName: d.guest_name,
          hostDeck: d.host_deck?.map(toCard),
          guestDeck: d.guest_deck?.map(toCard),
        }),
    );
    socket.on('opponent_presence', (d: { online: boolean }) => handlers.onPresence(d.online));
    socket.on('error_msg', (d: { code: string; message: string }) =>
      handlers.onError(d.code, d.message),
    );

    return () => this.disconnect();
  },

  pushState(gameId: string, state: GameState, expectedVersion: number) {
    socket?.emit('push_state', {
      game_id: gameId,
      state,
      expected_version: expectedVersion,
    });
  },

  abandon(gameId: string) {
    socket?.emit('abandon', { game_id: gameId });
  },

  disconnect() {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  },
};
