import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Flag, ImagePlus, Link2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import {
  BOARD_PRESETS,
  useSettingsStore,
  resolveBoardColor,
} from '@/store/settingsStore';
import { getServices } from '@/services';
import { compressImage, blobToDataUrl } from '@/utils/imageUtils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Reinicia la partida (con confirmación inline). Mostrado solo en móvil. */
  onResetGame?: () => void;
  /** Abandona la partida online (con confirmación inline). Mostrado solo en móvil. */
  onAbandonGame?: () => void;
}

// localStorage quota is ~5MB per origin; leave room for the rest of the state.
const MAX_DATA_URL_BYTES = 2.5 * 1024 * 1024;

export function SettingsPanel({ isOpen, onClose, onResetGame, onAbandonGame }: SettingsPanelProps) {
  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const setPreset = useSettingsStore((s) => s.setPreset);
  const setCustomColor = useSettingsStore((s) => s.setCustomColor);
  const setImage = useSettingsStore((s) => s.setImage);
  const setOverlayOpacity = useSettingsStore((s) => s.setOverlayOpacity);
  const resetTheme = useSettingsStore((s) => s.resetTheme);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset]     = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const blob = await compressImage(file);
      try {
        // Preferred path: Cloudinary URL (light, syncs across devices).
        const url = await getServices().catalog.uploadBoardImage(blob);
        setImage(url);
        return;
      } catch {
        // Cloudinary not configured: keep a local dataURL fallback.
      }
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl.length > MAX_DATA_URL_BYTES) {
        setError('La imagen es demasiado grande incluso comprimida. Prueba con otra o usa una URL.');
        return;
      }
      setImage(dataUrl);
    } catch {
      setError('No se pudo procesar la imagen.');
    }
  };

  const handleUrlApply = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setError(null);
    setImage(url);
    setImageUrlInput('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Personalizar campo de juego">
      <div className="flex flex-col gap-5">
        {/* Preset colors */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">
            Color del campo
          </h3>
          <div className="flex flex-wrap gap-3">
            {BOARD_PRESETS.map((preset) => {
              const active = boardTheme.mode === 'preset' && boardTheme.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setPreset(preset.id)}
                  title={preset.label}
                  className={[
                    'w-10 h-10 rounded-full border-2 transition-all',
                    active
                      ? 'border-yellow-400 ring-2 ring-yellow-400/40 scale-110'
                      : 'border-slate-600 hover:border-slate-400 hover:scale-105',
                  ].join(' ')}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}

            {/* Custom color picker */}
            <label
              title="Color personalizado"
              className={[
                'relative w-10 h-10 rounded-full border-2 cursor-pointer transition-all overflow-hidden',
                boardTheme.mode === 'custom-color'
                  ? 'border-yellow-400 ring-2 ring-yellow-400/40 scale-110'
                  : 'border-slate-600 hover:border-slate-400 hover:scale-105',
              ].join(' ')}
              style={{
                background:
                  boardTheme.mode === 'custom-color'
                    ? boardTheme.customColor
                    : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              }}
            >
              <input
                type="color"
                value={boardTheme.customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </section>

        {/* Background image */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">
            Imagen de fondo
          </h3>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5"
              >
                <ImagePlus size={14} /> Subir imagen
              </Button>
              {boardTheme.imageUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setImage(null)}
                  className="flex items-center gap-1.5 text-red-300"
                >
                  <Trash2 size={14} /> Quitar
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="url"
                  placeholder="…o pega una URL de imagen"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlApply()}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={handleUrlApply} disabled={!imageUrlInput.trim()}>
                Aplicar
              </Button>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            {boardTheme.mode === 'image' && boardTheme.imageUrl && (
              <>
                {/* Preview */}
                <div
                  className="h-20 rounded-lg border border-slate-700 bg-cover bg-center relative overflow-hidden"
                  style={{ backgroundImage: `url(${boardTheme.imageUrl})` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: `rgba(0,0,0,${boardTheme.overlayOpacity})` }}
                  />
                </div>

                {/* Overlay opacity */}
                <label className="flex items-center gap-3 text-xs text-slate-400">
                  Oscurecer
                  <input
                    type="range"
                    min={0}
                    max={0.8}
                    step={0.05}
                    value={boardTheme.overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="flex-1 accent-yellow-500"
                  />
                  <span className="w-8 text-right">{Math.round(boardTheme.overlayOpacity * 100)}%</span>
                </label>
              </>
            )}
          </div>
        </section>

        {/* Partida — acciones de juego (solo móvil; en desktop viven en la barra superior) */}
        {(onResetGame || onAbandonGame) && (
          <section className="sm:hidden border-t border-slate-800 pt-4">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-2">Partida</h3>
            <div className="flex flex-col gap-2">
              {onResetGame && (
                confirmReset ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-1">¿Reiniciar la partida?</span>
                    <Button variant="danger" size="sm"
                      onClick={() => { onResetGame(); setConfirmReset(false); onClose(); }}>
                      Sí
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" fullWidth
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center justify-center gap-1.5">
                    <RefreshCw size={14} /> Reiniciar partida
                  </Button>
                )
              )}
              {onAbandonGame && (
                confirmAbandon ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 flex-1">¿Abandonar la partida?</span>
                    <Button variant="danger" size="sm"
                      onClick={() => { onAbandonGame(); setConfirmAbandon(false); onClose(); }}>
                      Sí
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConfirmAbandon(false)}>
                      No
                    </Button>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" fullWidth
                    onClick={() => setConfirmAbandon(true)}
                    className="flex items-center justify-center gap-1.5">
                    <Flag size={14} /> Abandonar partida
                  </Button>
                )
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <div
            className="w-8 h-8 rounded-md border border-slate-700"
            style={{ backgroundColor: resolveBoardColor(boardTheme) }}
            title="Color actual"
          />
          <Button variant="secondary" size="sm" onClick={resetTheme} className="flex items-center gap-1.5">
            <RotateCcw size={14} /> Restablecer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
