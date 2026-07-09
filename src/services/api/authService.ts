import type { AuthService, AuthSession } from '../interfaces';
import { apiFetch, setAccessToken } from './http';
import { toUser, type ServerUser } from './mappers';

interface AuthResponse {
  user: ServerUser;
  accessToken: string;
}

function toSession(data: AuthResponse): AuthSession {
  setAccessToken(data.accessToken);
  return { user: toUser(data.user), accessToken: data.accessToken };
}

export const apiAuthService: AuthService = {
  async register(username, password) {
    const data = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
      retryOn401: false,
    });
    return toSession(data);
  },

  async login(username, password) {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      retryOn401: false,
    });
    return toSession(data);
  },

  async refresh() {
    try {
      const data = await apiFetch<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
        retryOn401: false,
      });
      return toSession(data);
    } catch {
      setAccessToken(null);
      return null;
    }
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', retryOn401: false });
    } finally {
      setAccessToken(null);
    }
  },
};
