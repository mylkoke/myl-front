import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { ZoneId, PlayerId } from '@/types/game.types';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameActions } from '@/hooks/useGameActions';

interface GameZoneProps {
  zoneId: ZoneId;
  playerId: PlayerId;
  label: string;
  cards: CardInPlay[];
  maxCards?: number;
  horizontal?: boolean;
  allowDrop?: boolean;
  className?: string;
  compact?: boolean;
  emptyIcon?: ReactNode;
}

export function GameZone({
  zoneId,
  playerId,
  label,
  cards,
  maxCards,
  horizontal = true,
  allowDrop = false,
  className = '',
  compact = false,
  emptyIcon,
}: GameZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const { moveCard, tapCard } = useGameActions();

  const handleDragOver = (e: React.DragEvent) => {
    if (!allowDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!allowDrop) return;
    e.preventDefault();
    setIsDragOver(false);

    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'));
      const { card, sourceZone, sourcePlayer } = payload;
      if (sourceZone !== zoneId || sourcePlayer !== playerId) {
        moveCard(card, sourceZone, zoneId, playerId);
      }
    } catch {
      // ignore malformed drag data
    }
  };

  const handleCardClick = (card: CardInPlay) => {
    setDetailCard(card);
  };

  const handleCardDblClick = (card: CardInPlay) => {
    if (zoneId === 'field') {
      tapCard(card.instanceId, playerId);
    }
  };

  const handleDragStart = (e: React.DragEvent, card: CardInPlay) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ card, sourceZone: zoneId, sourcePlayer: playerId })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      <div
        className={[
          'relative rounded-lg border-2 border-dashed transition-all duration-200',
          'border-slate-700/60 bg-slate-900/40',
          isDragOver && allowDrop ? 'zone-drag-over' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Zone label */}
        <div className="absolute top-1 left-2 text-[9px] text-slate-500 uppercase tracking-widest font-medium pointer-events-none">
          {label}
          {maxCards && (
            <span className="ml-1 text-slate-600">
              ({cards.length}/{maxCards})
            </span>
          )}
        </div>

        {/* Cards container */}
        <div
          className={[
            'pt-5 pb-2 px-2 min-h-[70px]',
            horizontal ? 'flex flex-wrap gap-1 items-center' : 'flex flex-col gap-1',
          ].join(' ')}
        >
          {cards.length === 0 && (
            <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs italic select-none">
              {emptyIcon ?? 'Vacío'}
            </div>
          )}
          {cards.map((card) => (
            <div
              key={card.instanceId}
              onDoubleClick={() => handleCardDblClick(card)}
              className="cursor-pointer"
            >
              <CardView
                card={card}
                onClick={handleCardClick}
                isSelected={detailCard?.instanceId === card.instanceId}
                compact={compact}
                draggable
                onDragStart={handleDragStart}
              />
            </div>
          ))}
        </div>
      </div>

      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
      />
    </>
  );
}
