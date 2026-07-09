import type { User, UserRole } from '../interfaces';
import { apiFetch } from './http';
import { toUser, type ServerUser } from './mappers';

export const apiAdminService = {
  async listUsers(): Promise<User[]> {
    return (await apiFetch<ServerUser[]>('/api/users')).map(toUser);
  },

  async setRole(userId: string, role: UserRole): Promise<User> {
    return toUser(
      await apiFetch<ServerUser>(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: { role },
      }),
    );
  },
};
