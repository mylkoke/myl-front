import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { CardView } from './CardView';
import { CardDetail } from './CardDetail';
import { useGameActions } from '@/hooks/useGameActions';
import { useGameStore } from '@/store/gameStore';
import { canPlayCard, hasMachinery } from '@/utils/gameRules';
import type { PlayerId } from '@/types/game.types';

interface PlayerHandProps {
  cards: CardInPlay[];
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function PlayerHand({ cards, playerId, isOpponent = false }: PlayerHandProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const { playCard } = useGameActions();
  const turn   = useGameStore((s) => s.turn);
  const player = useGameStore((s) => s.players[playerId]);
  const allPlayers = useGameStore((s) => s.players);

  const handleCardClick = (card: CardInPlay) => {
    if (isOpponent) return;
    setDetailCard(card);
  };

  const canPlay = detailCard ? canPlayCard(detailCard, player, turn, allPlayers).allowed : false;

  return (
    <>
      <div className="flex items-end justify-center gap-2 flex-wrap min-h-[56px]">
        {cards.length === 0 && (
          <span className="text-slate-700 text-xs italic self-center">Sin cartas en mano</span>
        )}
        {cards.map((card) =>
          isOpponent ? (
            <div key={card.instanceId} className="card-enter">
              <CardView card={card} faceDown size="xs" />
            </div>
          ) : (
            <div key={card.instanceId} className="card-enter">
              <CardView
                card={card}
                onClick={handleCardClick}
                isSelected={detailCard?.instanceId === card.instanceId}
                dragPayload={{ card, sourceZone: 'hand', sourcePlayer: playerId }}
              />
            </div>
          )
        )}
      </div>

      {!isOpponent && (
        <CardDetail
          card={detailCard}
          isOpen={!!detailCard}
          onClose={() => setDetailCard(null)}
          onPlay={(c) => {
            // Weapons are dragged onto allies, except machinery weapons
            // which play to the support line like a totem
            if (c.tipo !== 'arma' || hasMachinery(c)) playCard(c, playerId);
          }}
          canPlay={canPlay}
        />
      )}
    </>
  );
}
