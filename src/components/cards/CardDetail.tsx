import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Sword, Coins, BookOpen, Zap, User, Hash, X } from 'lucide-react';

interface CardDetailProps {
  card: CardInPlay | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (card: CardInPlay) => void;
  canPlay?: boolean;
  /** Texto del botón de jugar (por defecto "Jugar <nombre>"). */
  playLabel?: string;
  onUseSpecialAbility?: () => void;
  canUseSpecialAbility?: boolean;
  /** Texto del botón de habilidad (por defecto "Usar efecto especial (−1 Oro)"). */
  specialAbilityLabel?: string;
  /** Cartas con VARIAS habilidades activadas: un botón por acción. */
  abilityActions?: { label: string; enabled: boolean; onUse: () => void }[];
}

const TYPE_LABELS: Record<string, string> = {
  aliado: 'Aliado',
  totem: 'Tótem',
  talisman: 'Talismán',
  arma: 'Arma',
  oro: 'Oro',
};

const RARITY_VARIANT: Record<string, 'gold' | 'blue' | 'purple' | 'gray'> = {
  comun: 'gray',
  infrecuente: 'blue',
  raro: 'gold',
  'ultra raro': 'purple',
};

export function CardDetail({ card, isOpen, onClose, onPlay, canPlay, playLabel, onUseSpecialAbility, canUseSpecialAbility, specialAbilityLabel, abilityActions }: CardDetailProps) {
  const [imageError, setImageError] = useState(false);
  const [imageZoomed, setImageZoomed] = useState(false);

  if (!card) return null;

  const handlePlay = () => {
    onPlay?.(card);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={card.nombre}>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Card image */}
        <div className="flex-shrink-0 flex flex-row sm:flex-col items-center sm:items-stretch gap-3 sm:gap-0">
          <div
            onClick={imageError ? undefined : () => setImageZoomed(true)}
            title={imageError ? undefined : 'Ver la carta en grande'}
            className={[
              'w-28 h-[154px] sm:w-32 sm:h-44 flex-shrink-0 rounded-lg overflow-hidden border-2 border-yellow-500/30 shadow-xl',
              imageError ? '' : 'cursor-pointer hover:brightness-110 transition-all',
            ].join(' ')}
          >
            {imageError ? (
              <div className="w-full h-full bg-slate-700 flex items-center justify-center text-4xl text-slate-400">
                {card.tipo[0].toUpperCase()}
              </div>
            ) : (
              <img
                src={card.imagen}
                alt={card.nombre}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>

          {/* Type and rarity badges — columna junto a la imagen en móvil, debajo en desktop */}
          <div className="sm:mt-2 flex flex-col flex-wrap gap-1 min-w-0">
            <Badge variant="blue">{TYPE_LABELS[card.tipo] ?? card.tipo}</Badge>
            <Badge variant={RARITY_VARIANT[card.rareza] ?? 'gray'}>{card.rareza}</Badge>
            <Badge variant="gold">Sello: {card.tipoSello}</Badge>
            {card.habilidadesEspeciales?.map((ability) => (
              <Badge key={ability} variant="purple">
                {ability.charAt(0).toUpperCase() + ability.slice(1)}
              </Badge>
            ))}
          </div>
        </div>

        {/* Card info */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Stats row */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1 text-red-400">
              <Sword size={14} />
              <span className="font-bold text-lg">{card.fuerza}</span>
              <span className="text-xs text-slate-400">fuerza</span>
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              <Coins size={14} />
              <span className="font-bold text-lg">{card.coste}</span>
              <span className="text-xs text-slate-400">coste</span>
            </div>
          </div>

          {/* Historia */}
          <div>
            <div className="flex items-center gap-1 mb-1 text-slate-400 text-xs uppercase tracking-wide">
              <BookOpen size={12} />
              <span>Historia</span>
            </div>
            <p className="text-sm text-slate-300 italic leading-relaxed">{card.historia}</p>
          </div>

          {/* Habilidad */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1 text-yellow-400 text-xs uppercase tracking-wide">
              <Zap size={12} />
              <span>Habilidad</span>
            </div>
            <p className="text-sm text-white leading-relaxed">{card.habilidad}</p>
          </div>

          {/* Footer info */}
          <div className="text-xs text-slate-500 space-y-1 pt-2 border-t border-white/10">
            <div className="flex items-center gap-1">
              <User size={10} />
              <span>Ilustrador: {card.ilustrador}</span>
            </div>
            {/* Numeración: "HC-35/160" (serie-número/total de la edición) */}
            {(card.numeroCarta > 0 || card.expansion) && (
              <div className="flex items-center gap-1">
                <Hash size={10} />
                <span>
                  {card.expansion ? `${card.expansion}-` : '#'}
                  {card.numeroCarta}
                  {card.cantidadEdicion > 0 && `/${card.cantidadEdicion}`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      {(onPlay || onUseSpecialAbility || (abilityActions?.length ?? 0) > 0) && (
        <div className="mt-6 pt-4 border-t border-white/10 flex flex-col gap-2">
          {abilityActions?.map((action) => (
            <button
              key={action.label}
              onClick={() => { action.onUse(); onClose(); }}
              disabled={!action.enabled}
              className={[
                'w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2',
                action.enabled
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              <Zap size={14} />
              {action.label}
            </button>
          ))}
          {onUseSpecialAbility && (
            <button
              onClick={() => { onUseSpecialAbility(); onClose(); }}
              disabled={!canUseSpecialAbility}
              className={[
                'w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2',
                canUseSpecialAbility
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              <Zap size={14} />
              {canUseSpecialAbility ? (specialAbilityLabel ?? 'Usar efecto especial (−1 Oro)') : 'No disponible este turno'}
            </button>
          )}
          {onPlay && (
            <button
              onClick={handlePlay}
              disabled={!canPlay}
              className={[
                'w-full py-3 rounded-lg font-bold text-sm transition-all',
                canPlay
                  ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {canPlay ? (playLabel ?? `Jugar ${card.nombre}`) : 'No puedes jugar esta carta ahora'}
            </button>
          )}
        </div>
      )}

      {/* Visor a pantalla completa del diseño de la carta */}
      {imageZoomed && !imageError && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 cursor-zoom-out"
          onClick={(e) => {
            e.stopPropagation();
            setImageZoomed(false);
          }}
        >
          <button
            onClick={() => setImageZoomed(false)}
            className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
          <img
            src={card.imagen}
            alt={card.nombre}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </Modal>
  );
}
