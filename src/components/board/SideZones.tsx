import { useState } from 'react';
import type { PlayerState, PlayerId } from '@/types/game.types';
import type { CardInPlay } from '@/types/card.types';
import { DeckPile } from './DeckPile';
import { CardDetail } from '@/components/cards/CardDetail';
import { CardView } from '@/components/cards/CardView';
import { useGameStore } from '@/store/gameStore';

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
  const top = cards.at(-1);

  return (
    <div className="flex flex-col items-center gap-0.5 w-14" title={title ?? label}>
      <div className={`text-[8px] uppercase tracking-wider ${letterColor} font-bold`}>{letter}</div>
      <div
        className={[
          'relative w-12 h-16 rounded-lg border-2 border-dashed cursor-default',
          'bg-slate-900/60 flex items-center justify-center transition-all',
          cards.length > 0 ? 'border-slate-600/60' : 'border-slate-800/60',
        ].join(' ')}
      >
        {top ? (
          <div className="absolute inset-0.5 cursor-pointer" onClick={() => onCardClick?.(top)}>
            <CardView card={top} compact />
          </div>
        ) : (
          <span className={`text-lg font-black opacity-20 ${letterColor}`}>{letter}</span>
        )}
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

/**
 * Zona O — Oros.
 * Muestra todas las cartas de oro acumuladas con un contador prominente.
 * Las cartas se apilan visualmente y quedan en la zona de forma permanente.
 */
interface GoldZoneProps {
  cards: CardInPlay[];
  goldCount: number;
  playerId: PlayerId;
  onCardClick?: (c: CardInPlay) => void;
}

function GoldZone({ cards, goldCount, playerId, onCardClick }: GoldZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const playCard = useGameStore((s) => s.playCard);
  const turn     = useGameStore((s) => s.turn);
  const stackVisible = Math.min(cards.length, 4);

  const canReceive = turn.currentPlayer === playerId && turn.phase === 'vigilia';

  const handleDragOver = (e: React.DragEvent) => {
    if (!canReceive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canReceive) return;

    try {
      const { card, sourceZone, sourcePlayer } = JSON.parse(
        e.dataTransfer.getData('application/json')
      ) as { card: CardInPlay; sourceZone: string; sourcePlayer: PlayerId };

      if (card.tipo === 'oro' && sourceZone === 'hand' && sourcePlayer === playerId) {
        playCard(card, playerId);
      }
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-col items-center gap-0.5 w-14" title="O — Zona de Oros (arrastra cartas de oro aquí)">
      <div className="text-[8px] uppercase tracking-wider text-yellow-400 font-bold">O</div>

      {/* Drop target + card pile */}
      <div
        className={[
          'relative w-12 h-16 rounded-lg border-2 transition-all duration-150',
          isDragOver
            ? 'border-yellow-400 bg-yellow-400/10 scale-105 shadow-lg shadow-yellow-400/20'
            : canReceive && cards.length === 0
            ? 'border-dashed border-yellow-700/50 bg-yellow-950/20'
            : 'border-dashed border-slate-800/60 bg-slate-900/60',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
        }}
        onDrop={handleDrop}
      >
        {cards.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
            <span className="text-lg font-black opacity-20 text-yellow-400">O</span>
            {canReceive && (
              <span className="text-[6px] text-yellow-700 text-center leading-tight px-1">
                arrastra oro
              </span>
            )}
          </div>
        ) : (
          <>
            {/* Stacked offset layers */}
            {Array.from({ length: stackVisible }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-lg border border-yellow-600/40 bg-yellow-950/60"
                style={{
                  width: 44,
                  height: 60,
                  top: (stackVisible - 1 - i) * 2,
                  left: (stackVisible - 1 - i) * 1,
                  zIndex: i,
                }}
              />
            ))}
            {/* Top card — clickable */}
            <div
              className="absolute cursor-pointer"
              style={{ top: 0, left: stackVisible - 1, zIndex: stackVisible, width: 44, height: 60 }}
              onClick={() => onCardClick?.(cards.at(-1)!)}
            >
              <CardView card={cards.at(-1)!} compact />
            </div>
          </>
        )}

        {/* Counter badge — visible cuando hay oros */}
        {goldCount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 z-20 bg-yellow-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow border border-yellow-300">
            {goldCount}
          </div>
        )}

        {/* Drag-over flash */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-lg bg-yellow-400/10 border-2 border-yellow-400 pointer-events-none z-30 flex items-center justify-center">
            <span className="text-yellow-400 font-black text-base">✦</span>
          </div>
        )}
      </div>

      <div className="text-[7px] text-slate-600 text-center leading-tight">Oros</div>
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
          <SmallZone letter="P" letterColor="text-yellow-500" label="Oro Pagado"
            cards={player.goldPaid} onCardClick={setDetailCard} title="P — Zona de Oro Pagado" />
          <SmallZone letter="R" letterColor="text-orange-400" label="Removidas"
            cards={player.removed} onCardClick={setDetailCard} title="R — Cartas Removidas" />
        </div>

        {/* Row 2: M — Mazo Castillo | + — Cementerio */}
        <div className="flex gap-1 items-start">
          <div className="flex flex-col items-center gap-0.5 w-14">
            <div className="text-[8px] uppercase tracking-wider text-slate-300 font-bold">M</div>
            <DeckPile deck={player.deck} playerId={playerId} isOpponent={isOpponent} />
          </div>
          <SmallZone letter="+" letterColor="text-slate-300" label="Cementerio"
            cards={player.graveyard} onCardClick={setDetailCard} title="+ — Cementerio" />
        </div>

        {/* Row 3: O — Oros (zona especial) | D — Destierro */}
        <div className="flex gap-1">
          <GoldZone cards={player.gold} goldCount={player.goldCount} playerId={playerId} onCardClick={setDetailCard} />
          <SmallZone letter="D" letterColor="text-purple-400" label="Destierro"
            cards={player.exile} onCardClick={setDetailCard} title="D — Destierro" />
        </div>
      </div>

      <CardDetail card={detailCard} isOpen={!!detailCard} onClose={() => setDetailCard(null)} />
    </>
  );
}
