import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Sword, Coins, BookOpen, Zap, User, Hash } from 'lucide-react';

interface CardDetailProps {
  card: CardInPlay | null;
  isOpen: boolean;
  onClose: () => void;
  onPlay?: (card: CardInPlay) => void;
  canPlay?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  criatura: 'Criatura',
  talisman: 'Talismán',
  arma: 'Arma',
  tierra: 'Tierra',
  oro: 'Oro',
};

const RARITY_VARIANT: Record<string, 'gold' | 'blue' | 'purple' | 'gray'> = {
  comun: 'gray',
  infrecuente: 'blue',
  raro: 'gold',
  'ultra raro': 'purple',
};

export function CardDetail({ card, isOpen, onClose, onPlay, canPlay }: CardDetailProps) {
  const [imageError, setImageError] = useState(false);

  if (!card) return null;

  const handlePlay = () => {
    onPlay?.(card);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={card.nombre}>
      <div className="flex gap-6">
        {/* Card image */}
        <div className="flex-shrink-0">
          <div className="w-32 h-44 rounded-lg overflow-hidden border-2 border-yellow-500/30 shadow-xl">
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

          {/* Type and rarity badges */}
          <div className="mt-2 flex flex-col gap-1">
            <Badge variant="blue">{TYPE_LABELS[card.tipo] ?? card.tipo}</Badge>
            <Badge variant={RARITY_VARIANT[card.rareza] ?? 'gray'}>{card.rareza}</Badge>
            <Badge variant="gold">Sello: {card.tipoSello}</Badge>
          </div>
        </div>

        {/* Card info */}
        <div className="flex-1 space-y-3">
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
            <div className="flex items-center gap-1">
              <Hash size={10} />
              <span>#{card.numeroCarta} — Edición: {card.cantidadEdicion}</span>
            </div>
            {card.expansion && (
              <div>Expansión: <span className="text-slate-400">{card.expansion}</span></div>
            )}
          </div>
        </div>
      </div>

      {/* Play button */}
      {onPlay && (
        <div className="mt-6 pt-4 border-t border-white/10">
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
            {canPlay ? `Jugar ${card.nombre}` : 'No puedes jugar esta carta ahora'}
          </button>
        </div>
      )}
    </Modal>
  );
}
