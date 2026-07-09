import { create } from 'zustand';
import type { PlayerId } from '@/types/game.types';

export type GameMode = 'local' | 'online';
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface OnlineState {
  mode: GameMode;
  gameId: string | null;
  roomCode: string | null;
  mySeat: PlayerId | null;
  version: number;
  connection: ConnectionStatus;
  opponentOnline: boolean;
  opponentName: string | null;
  /** Version we just pushed — its echo must not be re-applied. */
  pendingVersion: number | null;

  startOnline: (params: { gameId: string; roomCode: string; mySeat: PlayerId }) => void;
  setVersion: (v: number) => void;
  setPendingVersion: (v: number | null) => void;
  setConnection: (c: ConnectionStatus) => void;
  setOpponentOnline: (online: boolean) => void;
  setOpponentName: (name: string | null) => void;
  reset: () => void;
}

const SESSION_KEY = 'myl-online-game';

export const useOnlineStore = create<OnlineState>()((set) => ({
  mode: 'local',
  gameId: null,
  roomCode: null,
  mySeat: null,
  version: 0,
  connection: 'disconnected',
  opponentOnline: false,
  opponentName: null,
  pendingVersion: null,

  startOnline: ({ gameId, roomCode, mySeat }) => {
    // Survive page reloads mid-game.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ gameId, roomCode, mySeat }));
    set({
      mode: 'online',
      gameId,
      roomCode,
      mySeat,
      version: 0,
      connection: 'connecting',
      opponentOnline: false,
    });
  },

  setVersion: (v) => set({ version: v }),
  setPendingVersion: (v) => set({ pendingVersion: v }),
  setConnection: (c) => set({ connection: c }),
  setOpponentOnline: (online) => set({ opponentOnline: online }),
  setOpponentName: (name) => set({ opponentName: name }),

  reset: () => {
    sessionStorage.removeItem(SESSION_KEY);
    set({
      mode: 'local',
      gameId: null,
      roomCode: null,
      mySeat: null,
      version: 0,
      connection: 'disconnected',
      opponentOnline: false,
      opponentName: null,
      pendingVersion: null,
    });
  },
}));

export function getStoredOnlineGame(): {
  gameId: string;
  roomCode: string;
  mySeat: PlayerId;
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
