import type { BoardTheme } from '@/store/settingsStore';

export type UserRole = 'admin' | 'supervisor' | 'comun';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  boardTheme: BoardTheme | null;
  activeDeckId: string | null;
}

export interface AuthSession {
  user: User;
  accessToken: string;
}

/**
 * Backend abstraction layer: components and stores only talk to these
 * interfaces. Swapping the backend means writing a new implementation
 * folder under src/services/ without touching the rest of the app.
 */
export interface AuthService {
  register(username: string, password: string): Promise<AuthSession>;
  login(username: string, password: string): Promise<AuthSession>;
  refresh(): Promise<AuthSession | null>;
  logout(): Promise<void>;
}

export interface ProfileService {
  getMe(): Promise<User>;
  updateMe(patch: { boardTheme?: BoardTheme; activeDeckId?: string }): Promise<User>;
}
