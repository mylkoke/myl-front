import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { PlayerId } from '@/types/game.types';
import { AllySlot } from './AllySlot';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';

interface BattleFieldProps {
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function BattleField({ playerId, isOpponent = false }: BattleFieldProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);

  const field = useGameStore(s => s.players[playerId].field);
  const equippedWeapons = useGameStore(s => s.players[playerId].equippedWeapons);
  const turn = useGameStore(s => s.turn);
  const player = useGameStore(s => s.players[playerId]);
  const { moveCard, tapCard } = useGameActions();

  const allies = field.filter(c => c.tipo === 'aliado');
  const lands = field.filter(c => c.tipo === 'tierra');

  const handleDragOver = (e: React.DragEvent) => {
    if (isOpponent) return;
    try {
      const types = e.dataTransfer.types;
      if (types.includes('application/json')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }
    } catch { /* noop */ }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    if (isOpponent) return;
    e.preventDefault();
    setIsDragOver(false);

    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json')) as {
        card: CardInPlay;
        sourceZone: string;
        sourcePlayer: PlayerId;
      };

      // Only accept allies and lands from hand; skip weapons (handled by AllySlot)
      if (
        payload.sourceZone === 'hand' &&
        payload.sourcePlayer === playerId &&
        (payload.card.tipo === 'aliado' || payload.card.tipo === 'tierra')
      ) {
        if (turn.currentPlayer !== playerId) {
          useGameStore.getState().addLog('No es tu turno.', 'error');
          return;
        }
        if (payload.card.coste > player.goldCount) {
          useGameStore.getState().addLog(
            `Necesitas ${payload.card.coste} de oro.`, 'error'
          );
          return;
        }
        moveCard(payload.card, 'hand', 'field', playerId);
      }
    } catch { /* noop */ }
  };

  return (
    <>
      <div
        className={[
          'rounded-lg border-2 border-dashed transition-all duration-200 min-h-[100px] p-2',
          isDragOver && !isOpponent
            ? 'border-blue-400/70 bg-blue-400/5'
            : 'border-slate-700/50 bg-slate-900/30',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Zone label */}
        <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-2">
          Campo de Batalla — {allies.length}/5 aliados
        </div>

        {/* Allies with weapons */}
        <div className="flex flex-wrap gap-3 items-end justify-center min-h-[80px]">
          {allies.length === 0 && (
            <span className="text-slate-700 text-xs italic self-center">
              {!isOpponent ? 'Arrastra aliados aquí' : 'Sin aliados'}
            </span>
          )}

          {allies.map((ally) => (
            <AllySlot
              key={ally.instanceId}
              ally={ally}
              weapon={equippedWeapons[ally.instanceId]}
              playerId={playerId}
              isOpponent={isOpponent}
            />
          ))}
        </div>

        {/* Land cards row */}
        {lands.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/40">
            <div className="text-[8px] text-slate-600 uppercase tracking-widest mb-1">
              Tierras
            </div>
            <div className="flex gap-2 flex-wrap">
              {lands.map((land) => (
                <div
                  key={land.instanceId}
                  onDoubleClick={() => tapCard(land.instanceId, playerId)}
                >
                  <CardView
                    card={land}
                    onClick={() => setDetailCard(land)}
                    compact
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
      />
    </>
  );
}
