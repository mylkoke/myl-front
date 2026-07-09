import type { BoardTheme } from '@/store/settingsStore';
import type { User, UserRole } from '../interfaces';

/** Server document shapes (snake_case, mirrors the Mongo/SQL schema). */
export interface ServerUser {
  _id: string;
  username: string;
  role: UserRole;
  board_theme: ServerBoardTheme | null;
  active_deck_id: string | null;
}

export interface ServerBoardTheme {
  mode: 'preset' | 'custom-color' | 'image';
  preset_id: string;
  custom_color: string;
  image_url: string | null;
  overlay_opacity: number;
}

export function toUser(raw: ServerUser): User {
  return {
    id: raw._id,
    username: raw.username,
    role: raw.role,
    boardTheme: raw.board_theme ? toBoardTheme(raw.board_theme) : null,
    activeDeckId: raw.active_deck_id,
  };
}

export function toBoardTheme(raw: ServerBoardTheme): BoardTheme {
  return {
    mode: raw.mode,
    presetId: raw.preset_id,
    customColor: raw.custom_color,
    imageUrl: raw.image_url,
    overlayOpacity: raw.overlay_opacity,
  };
}

export function fromBoardTheme(theme: BoardTheme): ServerBoardTheme {
  return {
    mode: theme.mode,
    preset_id: theme.presetId,
    custom_color: theme.customColor,
    image_url: theme.imageUrl,
    overlay_opacity: theme.overlayOpacity,
  };
}
