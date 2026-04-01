import type { Card } from '@/types/card.types';
import type { PlayerId } from '@/types/game.types';
import { useGameActions } from '@/hooks/useGameActions';
import { useTurn } from '@/hooks/usePlayer';
import { Layers } from 'lucide-react';

interface DeckPileProps {
  deck: Card[];
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function DeckPile({ deck, playerId, isOpponent = false }: DeckPileProps) {
  const { drawForPlayer } = useGameActions();
  const turn = useTurn();

  const isMyTurn = turn.currentPlayer === playerId;
  const canDraw = isMyTurn && !isOpponent;
  const count = deck.length;

  // Visual stack layers (up to 5 offset cards)
  const stackLayers = Math.min(count, 5);

  const handleClick = () => {
    if (!canDraw) return;
    drawForPlayer(playerId);
  };

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      {/* Label */}
      <span className="text-[9px] text-slate-500 uppercase tracking-widest">
        Mazo Castillo
      </span>

      {/* Deck pile visual */}
      <div
        className={[
          'relative',
          canDraw ? 'cursor-pointer group' : 'cursor-default',
        ].join(' ')}
        style={{ width: 52, height: 72 }}
        onClick={handleClick}
        title={canDraw ? 'Robar carta del Mazo Castillo' : `${count} cartas`}
      >
        {count === 0 ? (
          <div
            className="absolute inset-0 rounded-lg border-2 border-dashed border-slate-700
                        flex items-center justify-center text-slate-700"
          >
            <Layers size={18} />
          </div>
        ) : (
          <>
            {/* Stacked shadow layers */}
            {Array.from({ length: stackLayers }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-lg border border-slate-600 bg-slate-800"
                style={{
                  width: 48,
                  height: 68,
                  top: (stackLayers - 1 - i) * 2,
                  left: (stackLayers - 1 - i) * 1,
                  zIndex: i,
                }}
              />
            ))}

            {/* Top card (face down) */}
            <div
              className={[
                'absolute rounded-lg border-2 bg-gradient-to-br',
                'from-slate-700 to-slate-900',
                isMyTurn && canDraw
                  ? 'border-yellow-500/60 group-hover:border-yellow-400 group-hover:shadow-lg group-hover:shadow-yellow-500/20 transition-all'
                  : 'border-slate-600/60',
              ].join(' ')}
              style={{
                width: 48,
                height: 68,
                top: 0,
                left: stackLayers - 1,
                zIndex: stackLayers,
              }}
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
                <span className="text-yellow-500/40 font-black text-lg">M</span>
              </div>

              {/* Hover glow on drawable */}
              {canDraw && (
                <div className="absolute inset-0 rounded-lg bg-yellow-500/0 group-hover:bg-yellow-500/10 transition-colors" />
              )}
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
