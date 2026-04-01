import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { PlayerId } from '@/types/game.types';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { Sword } from 'lucide-react';

interface AllySlotProps {
  ally: CardInPlay;
  weapon: CardInPlay | undefined;
  playerId: PlayerId;
  isOpponent?: boolean;
}

export function AllySlot({ ally, weapon, playerId, isOpponent = false }: AllySlotProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const [isWeaponOver, setIsWeaponOver] = useState(false);
  const { equipWeapon, attackWithAlly } = useGameActions();
  const turn   = useGameStore((s) => s.turn);
  const player = useGameStore((s) => s.players[playerId]);

  const effectiveForce = ally.fuerza + (weapon?.bonusFuerza ?? 0);
  const displayAlly: CardInPlay = { ...ally, fuerza: effectiveForce };

  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  const handleWeaponDragOver = (e: React.DragEvent) => {
    if (!isMyTurn) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsWeaponOver(true);
  };

  const handleWeaponDrop = (e: React.DragEvent) => {
    if (!isMyTurn) return;
    e.preventDefault();
    e.stopPropagation();
    setIsWeaponOver(false);

    try {
      const { card, sourceZone, sourcePlayer } = JSON.parse(
        e.dataTransfer.getData('application/json')
      ) as { card: CardInPlay; sourceZone: string; sourcePlayer: PlayerId };

      if (card.tipo === 'arma' && sourceZone === 'hand' && sourcePlayer === playerId) {
        if (turn.currentPlayer !== playerId) {
          useGameStore.getState().addLog('No es tu turno.', 'error');
          return;
        }
        equipWeapon(card, ally.instanceId, playerId);
      }
    } catch { /* noop */ }
  };

  const handleAllyDragStart = (e: React.DragEvent, card: CardInPlay) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ card, sourceZone: 'defense', sourcePlayer: playerId })
    );
  };

  return (
    <>
      <div
        className={[
          'relative flex flex-col items-center transition-all duration-150',
          isWeaponOver ? 'scale-105' : '',
        ].join(' ')}
        style={{ width: 56, minHeight: weapon ? 112 : 84 }}
        onDragOver={handleWeaponDragOver}
        onDragLeave={() => setIsWeaponOver(false)}
        onDrop={handleWeaponDrop}
        onDoubleClick={() => isMyTurn && attackWithAlly(ally.instanceId, playerId)}
        title={isMyTurn ? 'Doble clic para atacar' : undefined}
      >
        {/* Weapon drop highlight */}
        {isWeaponOver && (
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-red-400/60 bg-red-500/5 z-20 pointer-events-none" />
        )}

        {/* Ally card */}
        <div className="relative z-10">
          <CardView
            card={displayAlly}
            onClick={() => setDetailCard(ally)}
            draggable={!isOpponent}
            onDragStart={handleAllyDragStart}
            isOpponent={isOpponent}
          />

          {/* Weapon bonus badge */}
          {weapon && (weapon.bonusFuerza ?? 0) > 0 && (
            <div className="absolute -top-1 -right-1 z-20 bg-red-600 text-white text-[7px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
              +{weapon.bonusFuerza}
            </div>
          )}

          {/* Attack hint */}
          {isMyTurn && (
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] text-slate-600 whitespace-nowrap">
              2x clic = atacar
            </div>
          )}
        </div>

        {/* Weapon overlapping below */}
        {weapon && (
          <div
            className="relative z-0 cursor-pointer"
            style={{ marginTop: -28 }}
            onClick={() => setDetailCard(weapon)}
            title={`${weapon.nombre} (+${weapon.bonusFuerza ?? 0} ⚔)`}
          >
            <CardView card={weapon} compact isOpponent={isOpponent} />
            <div className="absolute bottom-0 left-0 right-0 bg-red-900/80 text-[6px] text-red-200 text-center py-0.5 rounded-b truncate px-0.5">
              {weapon.nombre}
            </div>
          </div>
        )}

        {/* Empty weapon slot hint */}
        {!weapon && isMyTurn && (
          <div className="mt-0.5">
            <Sword size={8} className="text-slate-800 mx-auto" />
          </div>
        )}
      </div>

      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
        onPlay={!isOpponent && detailCard?.tipo === 'arma'
          ? (c) => equipWeapon(c, ally.instanceId, playerId)
          : undefined}
        canPlay={detailCard ? player.goldCount >= detailCard.coste : false}
      />
    </>
  );
}
