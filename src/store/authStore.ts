import { create } from 'zustand';
import type { User } from '@/services/interfaces';
import { getServices } from '@/services';
import { setRefreshHandler } from '@/services/api/http';
import { useSettingsStore } from './settingsStore';

type AuthStatus = 'loading' | 'authed' | 'anon';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<boolean>;
  signUp: (username: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
}

function applySession(user: User) {
  const settings = useSettingsStore.getState();
  // Server-side board theme wins over the localStorage cache.
  if (user.boardTheme) settings.hydrateFromServer(user.boardTheme);
  else settings.setServerSync(true);
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  user: null,
  error: null,

  bootstrap: async () => {
    const { auth } = getServices();
    // On 401 responses, http.ts retries once after refreshing the session.
    setRefreshHandler(async () => {
      const session = await auth.refresh();
      if (!session) {
        set({ status: 'anon', user: null });
        return null;
      }
      set({ status: 'authed', user: session.user });
      return session.accessToken;
    });

    try {
      const session = await auth.refresh();
      if (session) {
        applySession(session.user);
        set({ status: 'authed', user: session.user });
      } else {
        set({ status: 'anon', user: null });
      }
    } catch {
      set({ status: 'anon', user: null });
    }
  },

  signIn: async (username, password) => {
    try {
      const session = await getServices().auth.login(username, password);
      applySession(session.user);
      set({ status: 'authed', user: session.user, error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Error al iniciar sesión' });
      return false;
    }
  },

  signUp: async (username, password) => {
    try {
      const session = await getServices().auth.register(username, password);
      applySession(session.user);
      set({ status: 'authed', user: session.user, error: null });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Error al registrarse' });
      return false;
    }
  },

  signOut: async () => {
    await getServices().auth.logout();
    useSettingsStore.getState().setServerSync(false);
    set({ status: 'anon', user: null, error: null });
  },

  setUser: (user) => set({ user }),
}));
