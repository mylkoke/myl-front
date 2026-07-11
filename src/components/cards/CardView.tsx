import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { DragPayload } from '@/types/game.types';
import type { CardSize } from '@/utils/cardSize';
import { startPointerDrag } from '@/utils/dragManager';

interface CardViewProps {
  card: CardInPlay;
  onClick?: (card: CardInPlay) => void;
  isSelected?: boolean;
  isOpponent?: boolean;
  faceDown?: boolean;
  size?: CardSize;
  /** Makes the card draggable (pointer events: works on mouse AND touch). */
  dragPayload?: DragPayload;
}

const TYPE_COLORS: Record<string, string> = {
  aliado:  'from-blue-900 to-slate-900 border-blue-600/50',
  talisman:'from-purple-900 to-slate-900 border-purple-600/50',
  arma:    'from-red-900 to-slate-900 border-red-600/50',
  totem:   'from-emerald-900 to-slate-900 border-emerald-600/50',
  oro:     'from-yellow-800 to-yellow-950 border-yellow-500/70',
};

// Width per breakpoint; height comes from aspect-[3/4] so the ratio is
// identical at every step. Literal strings — Tailwind scans sources.
const SIZE_CLASSES: Record<CardSize, string> = {
  xs: 'w-9 sm:w-10 md:w-12',
  sm: 'w-12 sm:w-14 md:w-16',
  md: 'w-16 sm:w-20 md:w-24',
  lg: 'w-20 sm:w-24 md:w-32',
  xl: 'w-24 sm:w-32 md:w-40',
};

// Wrapper for tapped (rotated) cards: width = card height, height = card
// width, so the rotated card fills its footprint without overlapping others.
const TAPPED_WRAPPER_CLASSES: Record<CardSize, string> = {
  xs: 'w-12 sm:w-[53px] md:w-16',
  sm: 'w-16 sm:w-[75px] md:w-[85px]',
  md: 'w-[85px] sm:w-[107px] md:w-32',
  lg: 'w-[107px] sm:w-32 md:w-[171px]',
  xl: 'w-32 sm:w-[171px] md:w-[214px]',
};

const BADGE_CLASSES: Record<CardSize, string> = {
  xs: 'w-3.5 h-3.5 text-[7px]',
  sm: 'w-4 h-4 text-[8px]',
  md: 'w-5 h-5 text-[10px]',
  lg: 'w-6 h-6 text-xs',
  xl: 'w-7 h-7 text-sm',
};

const NAME_CLASSES: Record<CardSize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[8px]',
  md: 'text-[9px]',
  lg: 'text-[11px]',
  xl: 'text-sm',
};

const FORCE_BADGE_CLASSES: Record<CardSize, string> = {
  xs: 'bottom-0.5 right-0.5 w-3 h-3 md:w-4 md:h-4 text-[7px] md:text-[8px]',
  sm: 'bottom-0.5 right-0.5 w-3.5 h-3.5 md:w-4 md:h-4 text-[7px] md:text-[8px]',
  md: 'bottom-1 right-1 w-4 h-4 md:w-5 md:h-5 text-[9px] md:text-[10px]',
  lg: 'bottom-1 right-1 w-5 h-5 md:w-6 md:h-6 text-[10px] md:text-xs',
  xl: 'bottom-1 right-1 w-6 h-6 md:w-7 md:h-7 text-xs md:text-sm',
};

export function CardView({
  card,
  onClick,
  isSelected = false,
  isOpponent = false,
  faceDown = false,
  size = 'md',
  dragPayload,
}: CardViewProps) {
  const [imageError, setImageError] = useState(false);

  const typeGradient = TYPE_COLORS[card.tipo] ?? TYPE_COLORS.aliado;
  const isCompact = size === 'xs' || size === 'sm';

  const handleClick = () => onClick?.(card);

  const handlePointerDown = dragPayload
    ? (e: React.PointerEvent) => startPointerDrag(e, dragPayload)
    : undefined;

  if (faceDown) {
    return (
      <div
        className={[
          'relative rounded-lg border-2 border-slate-600/60 cursor-default select-none',
          'bg-gradient-to-br from-slate-800 to-slate-900',
          SIZE_CLASSES[size],
          'aspect-[3/4]',
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

  const cardEl = (
    <div
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      // touch-action none on draggable cards so the drag gesture isn't
      // hijacked by scrolling; the rest of the board scrolls normally.
      style={dragPayload ? { touchAction: 'none' } : undefined}
      className={[
        'relative rounded-lg cursor-pointer select-none transition-all duration-200',
        isCompact ? 'border' : 'border-2',
        `bg-gradient-to-br ${typeGradient}`,
        SIZE_CLASSES[size],
        'aspect-[3/4] flex-shrink-0',
        isSelected ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 -translate-y-2 scale-105' : '',
        card.tapped ? 'rotate-90 opacity-80' : '',
        onClick && !card.tapped ? 'hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 hover:brightness-110' : '',
        dragPayload ? 'hover:shadow-md select-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Imagen full-bleed (todos los tipos) */}
      <div className="absolute inset-0 rounded-lg overflow-hidden">
        {imageError ? (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-500 text-xs">
            {card.tipo === 'arma' ? '⚔' : card.tipo[0].toUpperCase()}
          </div>
        ) : (
          <img src={card.imagen} alt={card.nombre} className="w-full h-full object-cover" onError={() => setImageError(true)} />
        )}
        {/* Gradiente inferior para legibilidad del nombre */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 rounded-lg" />
      </div>

      {/* Aliado: fuerza SIEMPRE arriba-izquierda (como el diseño real) */}
      {card.tipo === 'aliado' && (
        <div className={`absolute top-0.5 left-0.5 md:top-1 md:left-1 z-10 rounded-full bg-red-700 flex items-center justify-center font-bold text-white shadow ${BADGE_CLASSES[size]}`}>
          {card.fuerza}
        </div>
      )}

      {/* Coste SIEMPRE arriba-derecha con fondo amarillo (todos los tipos
          salvo oro, que lleva la moneda amarilla sin número) */}
      {card.tipo !== 'oro' ? (
        <div className={`absolute top-0.5 right-0.5 md:top-1 md:right-1 z-10 rounded-full bg-yellow-500 flex items-center justify-center font-bold text-black shadow ${BADGE_CLASSES[size]}`}>
          {card.coste}
        </div>
      ) : (
        <div className={`absolute top-0.5 right-0.5 md:top-1 md:right-1 z-10 rounded-full bg-yellow-400 shadow border border-yellow-300 ${BADGE_CLASSES[size]}`} />
      )}

      {/* Etiqueta tipo arriba-izquierda (solo arma) */}
      {!isCompact && card.tipo === 'arma' && (
        <div className="absolute top-1 left-1 flex items-center gap-0.5 bg-black/60 rounded px-1 py-0.5">
          <span className={`text-red-300 font-bold uppercase tracking-wider leading-none ${size === 'lg' || size === 'xl' ? 'text-[8px]' : 'text-[7px]'}`}>⚔ Arma</span>
        </div>
      )}

      {/* Nombre abajo en overlay */}
      {!isCompact && (
        <div className="absolute bottom-0 left-0 right-0 px-1 pb-1">
          <p className={`font-bold text-white leading-tight line-clamp-2 drop-shadow-md ${NAME_CLASSES[size]}`}>
            {card.nombre}
          </p>
        </div>
      )}

      {/* Bono de fuerza arma — badge rojo abajo-derecha */}
      {!isCompact && card.tipo === 'arma' && (card.bonusFuerza ?? 0) > 0 && (
        <div className={`absolute font-bold text-white bg-red-700 rounded-full flex items-center justify-center shadow border border-red-500/50 ${FORCE_BADGE_CLASSES[size]}`}>
          +{card.bonusFuerza}
        </div>
      )}

      {/* Force stat abajo-derecha — solo cartas que NO son aliado ni arma
          (los aliados llevan la fuerza arriba-izquierda en todos los tamaños) */}
      {card.tipo !== 'arma' && card.tipo !== 'aliado' && card.fuerza > 0 && (
        <div
          className={[
            'absolute font-bold text-white bg-red-700/80 rounded-full flex items-center justify-center',
            FORCE_BADGE_CLASSES[size],
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

  // Tapped cards rotate 90°: reserve the rotated footprint so they don't
  // overflow onto neighbours.
  if (card.tapped) {
    return (
      <div className={`flex items-center justify-center aspect-[4/3] flex-shrink-0 ${TAPPED_WRAPPER_CLASSES[size]}`}>
        {cardEl}
      </div>
    );
  }

  return cardEl;
}
