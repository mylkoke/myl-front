import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { Badge } from '@/components/ui/Badge';

interface CardViewProps {
  card: CardInPlay;
  onClick?: (card: CardInPlay) => void;
  isSelected?: boolean;
  isOpponent?: boolean;
  faceDown?: boolean;
  compact?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, card: CardInPlay) => void;
}

const TYPE_COLORS: Record<string, string> = {
  criatura: 'from-blue-900 to-slate-900 border-blue-600/50',
  talisman: 'from-purple-900 to-slate-900 border-purple-600/50',
  arma: 'from-red-900 to-slate-900 border-red-600/50',
  tierra: 'from-green-900 to-slate-900 border-green-600/50',
  oro: 'from-yellow-900 to-slate-900 border-yellow-600/50',
};

const SEAL_BADGE: Record<string, { label: string; variant: 'gold' | 'blue' | 'purple' }> = {
  real: { label: 'R', variant: 'gold' },
  'ultra real': { label: 'UR', variant: 'blue' },
  'mega real': { label: 'MR', variant: 'purple' },
};

export function CardView({
  card,
  onClick,
  isSelected = false,
  isOpponent = false,
  faceDown = false,
  compact = false,
  draggable = false,
  onDragStart,
}: CardViewProps) {
  const [imageError, setImageError] = useState(false);

  const typeGradient = TYPE_COLORS[card.tipo] ?? TYPE_COLORS.criatura;
  const seal = SEAL_BADGE[card.tipoSello] ?? SEAL_BADGE.real;

  const handleClick = () => onClick?.(card);

  const handleDragStart = (e: React.DragEvent) => {
    onDragStart?.(e, card);
  };

  if (faceDown) {
    return (
      <div
        className={[
          'relative rounded-lg border-2 border-slate-600/60 cursor-default select-none',
          'bg-gradient-to-br from-slate-800 to-slate-900',
          compact ? 'w-12 h-16' : 'w-24 h-32',
        ].join(' ')}
        style={isOpponent ? { transform: 'rotate(180deg)' } : undefined}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-20 text-yellow-500 text-2xl font-bold">
          M
        </div>
        <div className="absolute inset-0 rounded-lg bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.03)_4px,rgba(255,255,255,0.03)_8px)]" />
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={handleDragStart}
      onClick={handleClick}
      className={[
        'relative rounded-lg border-2 cursor-pointer select-none transition-all duration-200',
        `bg-gradient-to-br ${typeGradient}`,
        compact ? 'w-12 h-16' : 'w-24 h-32',
        isSelected ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105' : '',
        card.tapped ? 'rotate-90 opacity-80' : '',
        onClick ? 'hover:-translate-y-1 hover:shadow-lg hover:shadow-white/10' : '',
        draggable ? 'hover:shadow-md' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Cost badge */}
      {!compact && (
        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] font-bold text-black shadow">
          {card.coste}
        </div>
      )}

      {/* Seal badge */}
      {!compact && (
        <div className="absolute top-1 right-1">
          <Badge variant={seal.variant} className="text-[8px] px-1">
            {seal.label}
          </Badge>
        </div>
      )}

      {/* Card image */}
      <div className={`w-full overflow-hidden ${compact ? 'h-8 rounded-t-md' : 'h-16 rounded-t-md'}`}>
        {imageError ? (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-500 text-xs">
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

      {/* Card name */}
      {!compact && (
        <div className="px-1 pt-1">
          <p className="text-[9px] font-bold text-white leading-tight line-clamp-2">
            {card.nombre}
          </p>
        </div>
      )}

      {/* Force stat */}
      {card.fuerza > 0 && (
        <div
          className={[
            'absolute font-bold text-white bg-red-700/80 rounded-full flex items-center justify-center',
            compact ? 'bottom-0.5 right-0.5 w-4 h-4 text-[8px]' : 'bottom-1 right-1 w-5 h-5 text-[10px]',
          ].join(' ')}
        >
          {card.fuerza}
        </div>
      )}

      {/* Tapped overlay */}
      {card.tapped && (
        <div className="absolute inset-0 rounded-lg bg-black/30 flex items-center justify-center">
          <span className="text-[8px] text-slate-400 font-bold rotate-[-90deg]">AGOTADA</span>
        </div>
      )}
    </div>
  );
}
