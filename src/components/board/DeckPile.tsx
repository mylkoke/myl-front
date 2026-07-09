import type { Card } from '@/types/card.types';
import type { PlayerId } from '@/types/game.types';
import { Layers } from 'lucide-react';

interface DeckPileProps {
  deck: Card[];
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function DeckPile({ deck, playerId }: DeckPileProps) {
  const count = deck.length;
  const stackLayers = Math.min(count, 5);

  return (
    <div className="flex flex-col items-center gap-1 select-none" data-fx={`deck-${playerId}`}>
      {/* Label */}
      <span className="text-[9px] text-slate-500 uppercase tracking-widest hidden sm:inline">
        Mazo Castillo
      </span>

      {/* Deck pile visual */}
      <div
        className="relative cursor-default w-16 h-[85px] sm:w-20 sm:h-[107px] lg:w-24 lg:h-32"
        title={`${count} cartas`}
      >
        {count === 0 ? (
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-700">
            <Layers size={16} />
          </div>
        ) : (
          <>
            {/* Stacked shadow layers */}
            {Array.from({ length: stackLayers }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-lg border border-slate-600 bg-slate-800"
                style={{
                  inset: 0,
                  top: (stackLayers - 1 - i) * 2,
                  left: (stackLayers - 1 - i) * 1,
                  zIndex: i,
                }}
              />
            ))}

            {/* Top card (face down) */}
            <div
              className="absolute inset-0 rounded-lg border-2 bg-gradient-to-br from-slate-700 to-slate-900 border-slate-600/60"
              style={{ zIndex: stackLayers }}
            >
              {/* MYL card back pattern */}
              <div className="absolute inset-0 rounded-lg overflow-hidden">
                <div
                  className="w-full h-full opacity-10"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(45deg, rgba(251,191,36,0.5) 0px, rgba(251,191,36,0.5) 1px, transparent 1px, transparent 8px)',
                  }}
                />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-yellow-500/40 font-black text-xl lg:text-2xl">M</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Card count */}
      <div className="flex items-center gap-1 text-slate-500 text-[10px]">
        <Layers size={9} />
        <span>{count}</span>
      </div>
    </div>
  );
}
