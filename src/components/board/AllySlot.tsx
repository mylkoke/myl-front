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

/** Calculates the effective force of an ally considering equipped weapon */
function getEffectiveForce(ally: CardInPlay, weapon?: CardInPlay): number {
  return ally.fuerza + (weapon?.bonusFuerza ?? 0);
}

export function AllySlot({ ally, weapon, playerId, isOpponent = false }: AllySlotProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const [isWeaponDropOver, setIsWeaponDropOver] = useState(false);
  const { equipWeapon } = useGameActions();
  const turn = useGameStore(s => s.turn);
  const player = useGameStore(s => s.players[playerId]);

  const effectiveForce = getEffectiveForce(ally, weapon);
  // Create a display version of ally with effective force for CardView
  const allyDisplay: CardInPlay = { ...ally, fuerza: effectiveForce };

  const handleAllyDragStart = (e: React.DragEvent, card: CardInPlay) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ card, sourceZone: 'field', sourcePlayer: playerId })
    );
  };

  // Allow weapon cards to be dropped onto this slot
  const handleWeaponDragOver = (e: React.DragEvent) => {
    if (isOpponent) return;
    try {
      // We can't read dataTransfer during dragOver, so just allow it
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsWeaponDropOver(true);
    } catch { /* noop */ }
  };

  const handleWeaponDragLeave = () => setIsWeaponDropOver(false);

  const handleWeaponDrop = (e: React.DragEvent) => {
    if (isOpponent) return;
    e.preventDefault();
    e.stopPropagation();
    setIsWeaponDropOver(false);

    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json')) as {
        card: CardInPlay;
        sourceZone: string;
        sourcePlayer: PlayerId;
      };

      if (
        payload.card.tipo === 'arma' &&
        payload.sourceZone === 'hand' &&
        payload.sourcePlayer === playerId
      ) {
        // Check if player has enough gold
        if (payload.card.coste > player.goldCount) {
          useGameStore.getState().addLog(
            `Necesitas ${payload.card.coste} de oro para equipar ${payload.card.nombre}`,
            'error'
          );
          return;
        }
        if (turn.currentPlayer !== playerId) {
          useGameStore.getState().addLog('Solo puedes equipar armas en tu turno.', 'error');
          return;
        }
        equipWeapon(payload.card, ally.instanceId, playerId);
      }
    } catch { /* noop */ }
  };

  return (
    <>
      <div
        className={[
          'relative flex flex-col items-center transition-all duration-150',
          isWeaponDropOver && !isOpponent ? 'scale-105' : '',
        ].join(' ')}
        style={{ width: 56, minHeight: weapon ? 108 : 80 }}
        onDragOver={handleWeaponDragOver}
        onDragLeave={handleWeaponDragLeave}
        onDrop={handleWeaponDrop}
      >
        {/* Weapon drop hint */}
        {isWeaponDropOver && (
          <div className="absolute inset-0 rounded-lg border-2 border-dashed border-red-400/60 bg-red-400/5 z-20 pointer-events-none flex items-end justify-center pb-1">
            <Sword size={12} className="text-red-400" />
          </div>
        )}

        {/* Ally card */}
        <div className="relative z-10">
          <CardView
            card={allyDisplay}
            onClick={() => setDetailCard(ally)}
            draggable={!isOpponent}
            onDragStart={handleAllyDragStart}
            isOpponent={isOpponent}
          />
          {/* Force bonus indicator */}
          {weapon && (weapon.bonusFuerza ?? 0) > 0 && (
            <div className="absolute -top-1 -right-1 z-20 bg-red-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">
              +{weapon.bonusFuerza}
            </div>
          )}
        </div>

        {/* Weapon card (overlapping, partially visible below ally) */}
        {weapon && (
          <div
            className="relative z-0"
            style={{ marginTop: -28 }} // overlap the bottom of the ally
          >
            <div
              className="relative cursor-pointer"
              onClick={() => setDetailCard(weapon)}
              title={`${weapon.nombre} — +${weapon.bonusFuerza ?? 0} de fuerza`}
            >
              <CardView
                card={weapon}
                compact
                isOpponent={isOpponent}
              />
              {/* Weapon label strip */}
              <div className="absolute bottom-0 left-0 right-0 bg-red-900/80 text-[7px] text-red-200 text-center py-0.5 rounded-b">
                {weapon.nombre}
              </div>
            </div>
          </div>
        )}

        {/* Drop zone label when empty and hovering */}
        {!weapon && !isOpponent && (
          <div
            className={[
              'text-[8px] text-slate-700 text-center leading-tight mt-0.5 transition-opacity',
              isWeaponDropOver ? 'opacity-0' : 'opacity-100',
            ].join(' ')}
          >
            <Sword size={9} className="inline opacity-30" />
          </div>
        )}
      </div>

      {/* Card detail modal */}
      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
      />
    </>
  );
}
