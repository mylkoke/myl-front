import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import { CardView } from './CardView';
import { CardDetail } from './CardDetail';
import { DeckSearchModal } from '@/components/board/DeckSearchModal';
import { useGameActions } from '@/hooks/useGameActions';
import { useGameStore } from '@/store/gameStore';
import {
  canPlayCard,
  hasMachinery,
  hasHandDiscardDraw,
  hasHandTutorCaudillo,
  isHandRevealed,
} from '@/utils/gameRules';
import type { PlayerId } from '@/types/game.types';

interface PlayerHandProps {
  cards: CardInPlay[];
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function PlayerHand({ cards, playerId, isOpponent = false }: PlayerHandProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const [tutorOpen, setTutorOpen] = useState(false);
  const { playCard, handDiscardDraw, handTutorCaudillo } = useGameActions();
  const turn   = useGameStore((s) => s.turn);
  const player = useGameStore((s) => s.players[playerId]);
  const allPlayers = useGameStore((s) => s.players);
  // Monitor Araucano: la mano se revela si el oponente controla solo Caudillos.
  const revealed = useGameStore((s) => isHandRevealed(playerId, s.players));

  const handleCardClick = (card: CardInPlay) => {
    if (isOpponent && !revealed) return;
    setDetailCard(card);
  };

  const canPlay = detailCard ? canPlayCard(detailCard, player, turn, allPlayers).allowed : false;
  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  // Habilidades activables desde la mano (Bandera Patria Vieja, Salitre).
  const handActions =
    detailCard && !isOpponent
      ? [
          ...(hasHandDiscardDraw(detailCard)
            ? [{
                label: 'Descartar esta carta y robar 1',
                enabled: isMyTurn && player.deck.length > 0,
                onUse: () => handDiscardDraw(detailCard.instanceId, playerId),
              }]
            : []),
          ...(hasHandTutorCaudillo(detailCard)
            ? [{
                label: 'Remover: buscar un Aliado Caudillo en tu Castillo',
                enabled: isMyTurn && player.deck.some((c) => c.tipo === 'aliado' && c.raza === 'Caudillo'),
                onUse: () => setTutorOpen(true),
              }]
            : []),
        ]
      : [];

  // La carta mostrada boca abajo salvo que sea propia o esté revelada.
  const showFaceUp = !isOpponent || revealed;

  return (
    <>
      <div className="flex items-end justify-center gap-2 flex-wrap min-h-[56px]">
        {cards.length === 0 && (
          <span className="text-slate-700 text-xs italic self-center">Sin cartas en mano</span>
        )}
        {cards.map((card) =>
          !showFaceUp ? (
            <div key={card.instanceId} className="card-enter">
              <CardView card={card} faceDown size="xs" />
            </div>
          ) : (
            <div key={card.instanceId} className="card-enter relative">
              {/* Marco revelado: mano del rival descubierta por Monitor Araucano */}
              {isOpponent && revealed && (
                <div className="absolute -inset-0.5 rounded-lg ring-2 ring-cyan-400/70 pointer-events-none z-10" />
              )}
              <CardView
                card={card}
                onClick={handleCardClick}
                isSelected={detailCard?.instanceId === card.instanceId}
                size={isOpponent ? 'xs' : 'md'}
                dragPayload={
                  !isOpponent ? { card, sourceZone: 'hand', sourcePlayer: playerId } : undefined
                }
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
          abilityActions={handActions.length > 0 ? handActions : undefined}
        />
      )}

      {/* Rival revelado: detalle de solo lectura al tocar sus cartas */}
      {isOpponent && revealed && (
        <CardDetail card={detailCard} isOpen={!!detailCard} onClose={() => setDetailCard(null)} />
      )}

      {/* Salitre: tutor de Aliado Caudillo desde el Castillo */}
      {detailCard && (
        <DeckSearchModal
          isOpen={tutorOpen}
          onClose={() => setTutorOpen(false)}
          title={`Castillo — buscar Caudillo (${detailCard.nombre})`}
          deck={player.deck}
          isEligible={(c) => c.tipo === 'aliado' && c.raza === 'Caudillo'}
          onPlay={(deckIndex) => {
            handTutorCaudillo(detailCard.instanceId, deckIndex, playerId);
            setTutorOpen(false);
            setDetailCard(null);
          }}
        />
      )}
    </>
  );
}
