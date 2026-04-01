import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { CardView } from './CardView';
import { CardDetail } from './CardDetail';
import { useGameActions } from '@/hooks/useGameActions';
import { useGameStore } from '@/store/gameStore';
import { canPlayCard } from '@/utils/gameRules';
import type { PlayerId } from '@/types/game.types';

interface PlayerHandProps {
  cards: CardInPlay[];
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function PlayerHand({ cards, playerId, isOpponent = false }: PlayerHandProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const { playCard } = useGameActions();
  const turn = useGameStore((s) => s.turn);
  const player = useGameStore((s) => s.players[playerId]);

  const handleCardClick = (card: CardInPlay) => {
    if (isOpponent) return;
    setDetailCard(card);
  };

  const handleDragStart = (e: React.DragEvent, card: CardInPlay) => {
    if (isOpponent) return;
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ card, sourceZone: 'hand', sourcePlayer: playerId })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const canPlay = detailCard
    ? canPlayCard(detailCard, player, turn).allowed
    : false;

  return (
    <>
      <div className="flex items-center justify-center gap-2 flex-wrap min-h-[60px]">
        {cards.length === 0 ? (
          <span className="text-slate-600 text-xs italic">Sin cartas en mano</span>
        ) : (
          cards.map((card) =>
            isOpponent ? (
              <CardView key={card.instanceId} card={card} faceDown compact={isOpponent} isOpponent />
            ) : (
              <CardView
                key={card.instanceId}
                card={card}
                onClick={handleCardClick}
                isSelected={detailCard?.instanceId === card.instanceId}
                draggable
                onDragStart={handleDragStart}
              />
            )
          )
        )}
      </div>

      {!isOpponent && (
        <CardDetail
          card={detailCard}
          isOpen={!!detailCard}
          onClose={() => setDetailCard(null)}
          onPlay={(c) => playCard(c, playerId)}
          canPlay={canPlay}
        />
      )}
    </>
  );
}
