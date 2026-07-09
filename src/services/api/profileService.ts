import type { ProfileService } from '../interfaces';
import { apiFetch } from './http';
import { toUser, fromBoardTheme, type ServerUser } from './mappers';

export const apiProfileService: ProfileService = {
  async getMe() {
    return toUser(await apiFetch<ServerUser>('/api/users/me'));
  },

  async updateMe(patch) {
    return toUser(
      await apiFetch<ServerUser>('/api/users/me', {
        method: 'PATCH',
        body: {
          ...(patch.boardTheme ? { board_theme: fromBoardTheme(patch.boardTheme) } : {}),
          ...(patch.activeDeckId ? { active_deck_id: patch.activeDeckId } : {}),
        },
      }),
    );
  },
};
