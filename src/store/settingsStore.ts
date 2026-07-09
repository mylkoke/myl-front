import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BoardPreset {
  id: string;
  label: string;
  color: string;
}

export const BOARD_PRESETS: BoardPreset[] = [
  { id: 'midnight', label: 'Medianoche',    color: '#080f18' },
  { id: 'felt',     label: 'Tapete verde',  color: '#0a1f14' },
  { id: 'ocean',    label: 'Azul profundo', color: '#0a1428' },
  { id: 'wine',     label: 'Vino',          color: '#1f0a12' },
  { id: 'stone',    label: 'Gris piedra',   color: '#14161a' },
];

export const DEFAULT_PRESET = BOARD_PRESETS[0];

export type BoardThemeMode = 'preset' | 'custom-color' | 'image';

export interface BoardTheme {
  mode: BoardThemeMode;
  presetId: string;
  customColor: string;
  /** Compressed dataURL from upload, or an external image URL. */
  imageUrl: string | null;
  /** 0–0.8 dark overlay over the image for readability. */
  overlayOpacity: number;
}

interface SettingsState {
  boardTheme: BoardTheme;
  /** True while a user session is active: theme changes are pushed to the server. */
  serverSync: boolean;
  setPreset: (id: string) => void;
  setCustomColor: (hex: string) => void;
  setImage: (url: string | null) => void;
  setOverlayOpacity: (value: number) => void;
  resetTheme: () => void;
  /** Replace the local theme with the server-side one (on login). */
  hydrateFromServer: (theme: BoardTheme) => void;
  setServerSync: (enabled: boolean) => void;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced push of the current theme to the user profile. */
function schedulePush(get: () => SettingsState) {
  if (!get().serverSync) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    // Dynamic import avoids a static cycle with the services layer.
    void import('@/services').then(({ getServices }) =>
      getServices()
        .profile.updateMe({ boardTheme: get().boardTheme })
        .catch(() => {/* offline: localStorage cache still holds the theme */}),
    );
  }, 800);
}

const DEFAULT_THEME: BoardTheme = {
  mode: 'preset',
  presetId: DEFAULT_PRESET.id,
  customColor: DEFAULT_PRESET.color,
  imageUrl: null,
  overlayOpacity: 0.4,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      boardTheme: DEFAULT_THEME,
      serverSync: false,
      setPreset: (id) => {
        set((s) => ({ boardTheme: { ...s.boardTheme, mode: 'preset', presetId: id } }));
        schedulePush(get);
      },
      setCustomColor: (hex) => {
        set((s) => ({ boardTheme: { ...s.boardTheme, mode: 'custom-color', customColor: hex } }));
        schedulePush(get);
      },
      setImage: (url) => {
        set((s) => ({
          boardTheme: { ...s.boardTheme, mode: url ? 'image' : 'preset', imageUrl: url },
        }));
        schedulePush(get);
      },
      setOverlayOpacity: (value) => {
        set((s) => ({ boardTheme: { ...s.boardTheme, overlayOpacity: value } }));
        schedulePush(get);
      },
      resetTheme: () => {
        set({ boardTheme: DEFAULT_THEME });
        schedulePush(get);
      },
      hydrateFromServer: (theme) => set({ boardTheme: theme, serverSync: true }),
      setServerSync: (enabled) => set({ serverSync: enabled }),
    }),
    { name: 'myl-settings', partialize: (s) => ({ boardTheme: s.boardTheme }) }
  )
);

/** Resolve the background color for the current theme. */
export function resolveBoardColor(theme: BoardTheme): string {
  if (theme.mode === 'custom-color') return theme.customColor;
  return BOARD_PRESETS.find((p) => p.id === theme.presetId)?.color ?? DEFAULT_PRESET.color;
}
