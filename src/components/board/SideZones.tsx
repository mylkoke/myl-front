import { useState } from 'react';
import type { PlayerState, PlayerId } from '@/types/game.types';
import type { CardInPlay } from '@/types/card.types';
import { DeckPile } from './DeckPile';
import { CardDetail } from '@/components/cards/CardDetail';
import { CardView } from '@/components/cards/CardView';

interface SideZonesProps {
  player: PlayerState;
  playerId: PlayerId;
  isOpponent?: boolean;
}

interface SmallZoneProps {
  label: string;
  letter: string;
  letterColor: string;
  cards: CardInPlay[];
  onCardClick?: (c: CardInPlay) => void;
  title?: string;
}

function SmallZone({ label, letter, letterColor, cards, onCardClick, title }: SmallZoneProps) {
  const top = cards.at(-1); // show only top card

  return (
    <div
      className="flex flex-col items-center gap-0.5 w-14"
      title={title ?? label}
    >
      <div className={`text-[8px] uppercase tracking-wider ${letterColor} font-bold`}>
        {letter}
      </div>
      <div
        className={[
          'relative w-12 h-16 rounded-lg border-2 border-dashed cursor-default',
          'bg-slate-900/60 flex items-center justify-center transition-all',
          cards.length > 0 ? 'border-slate-600/60' : 'border-slate-800/60',
        ].join(' ')}
      >
        {top ? (
          <div
            className="absolute inset-0.5 cursor-pointer"
            onClick={() => onCardClick?.(top)}
          >
            <CardView card={top} compact />
          </div>
        ) : (
          <span className={`text-lg font-black opacity-20 ${letterColor}`}>{letter}</span>
        )}

        {/* Count badge */}
        {cards.length > 1 && (
          <div className="absolute -top-1 -right-1 bg-slate-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {cards.length}
          </div>
        )}
      </div>
      <div className="text-[7px] text-slate-600 text-center leading-tight">{label}</div>
    </div>
  );
}

export function SideZones({ player, playerId, isOpponent = false }: SideZonesProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);

  return (
    <>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {/* Row 1: P — Oro Pagado | R — Removidas */}
        <div className="flex gap-1">
          <SmallZone
            letter="P"
            letterColor="text-yellow-500"
            label="Oro Pagado"
            cards={player.goldPaid}
            onCardClick={setDetailCard}
            title="P — Zona de Oro Pagado"
          />
          <SmallZone
            letter="R"
            letterColor="text-orange-400"
            label="Removidas"
            cards={player.removed}
            onCardClick={setDetailCard}
            title="R — Cartas Removidas"
          />
        </div>

        {/* Row 2: M — Mazo Castillo | + — Cementerio */}
        <div className="flex gap-1 items-start">
          <div className="flex flex-col items-center gap-0.5 w-14">
            <div className="text-[8px] uppercase tracking-wider text-slate-300 font-bold">M</div>
            <DeckPile deck={player.deck} playerId={playerId} isOpponent={isOpponent} />
          </div>

          <SmallZone
            letter="+"
            letterColor="text-slate-300"
            label="Cementerio"
            cards={player.graveyard}
            onCardClick={setDetailCard}
            title="+ — Cementerio"
          />
        </div>

        {/* Row 3: O — Oros | D — Destierro */}
        <div className="flex gap-1">
          <SmallZone
            letter="O"
            letterColor="text-yellow-400"
            label="Oros"
            cards={player.gold}
            onCardClick={setDetailCard}
            title="O — Zona de Oros"
          />
          <SmallZone
            letter="D"
            letterColor="text-purple-400"
            label="Destierro"
            cards={player.exile}
            onCardClick={setDetailCard}
            title="D — Destierro"
          />
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
