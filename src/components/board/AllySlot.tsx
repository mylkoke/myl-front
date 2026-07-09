import { useCallback, useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { PlayerId, DragPayload } from '@/types/game.types';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { useDropZone } from '@/utils/dragManager';
import { Sword } from 'lucide-react';
import type { CardSize } from '@/utils/cardSize';
import { DeckSearchModal } from './DeckSearchModal';
import {
  hasCaudilloSummon,
  isSummonableByCaudillo,
  strengthLockedFor,
  CAUDILLO_SUMMON_GOLD_COST,
} from '@/utils/gameRules';

interface AllySlotProps {
  ally: CardInPlay;
  weapon: CardInPlay | undefined;
  playerId: PlayerId;
  isOpponent?: boolean;
  size?: CardSize;
}

export function AllySlot({ ally, weapon, playerId, isOpponent = false, size = 'md' }: AllySlotProps) {
  const [detailCard, setDetailCard] = useState<CardInPlay | null>(null);
  const [deckSearchOpen, setDeckSearchOpen] = useState(false);
  const { equipWeapon, summonCaudilloFromDeck } = useGameActions();
  const turn   = useGameStore((s) => s.turn);
  const combat = useGameStore((s) => s.combat);
  const player = useGameStore((s) => s.players[playerId]);

  const activateWeaponAbility = useGameStore((s) => s.activateWeaponAbility);
  // 'fuerza_inmutable' rival en juego: se muestra la fuerza impresa, sin bonos.
  const strengthLocked = useGameStore((s) => strengthLockedFor(playerId, s.players));
  const tempBonus = strengthLocked ? 0 : player.weaponTempBonuses[ally.instanceId] ?? 0;
  const effectiveForce = strengthLocked
    ? ally.fuerza
    : ally.fuerza + (weapon?.bonusFuerza ?? 0) + tempBonus;
  const displayAlly: CardInPlay = { ...ally, fuerza: effectiveForce };

  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  const weaponHasActivatedAbility = (weapon?.habilidadesEspeciales?.length ?? 0) > 0;
  const canUseWeaponAbility =
    isMyTurn &&
    weaponHasActivatedAbility &&
    !player.weaponAbilityUsedThisTurn.includes(weapon!.instanceId) &&
    player.goldCount >= 1;

  // 'invocacion_caudillo': el aliado puede pagar 3 oros para invocar desde el
  // Mazo Castillo un aliado de su misma raza con coste ≤ 4, 1 vez por turno.
  const allyHasSummonAbility = hasCaudilloSummon(ally);
  const canUseSummonAbility =
    isMyTurn &&
    allyHasSummonAbility &&
    !combat &&
    !player.allyAbilityUsedThisTurn.includes(ally.instanceId) &&
    player.goldCount >= CAUDILLO_SUMMON_GOLD_COST;

  // Weapon drop target: an arma from this player's hand equips this ally.
  const acceptsWeapon = useCallback(
    (p: DragPayload) =>
      p.card.tipo === 'arma' && p.sourceZone === 'hand' && p.sourcePlayer === playerId,
    [playerId],
  );
  const onWeaponDrop = useCallback(
    (p: DragPayload) => equipWeapon(p.card, ally.instanceId, playerId),
    [equipWeapon, ally.instanceId, playerId],
  );
  const { isOver: isWeaponOver, zoneProps } = useDropZone(
    isMyTurn ? `ally:${playerId}:${ally.instanceId}` : null,
    { accepts: acceptsWeapon, onDrop: onWeaponDrop },
  );

  return (
    <>
      <div
        {...zoneProps}
        className={[
          'relative flex flex-col items-center transition-all duration-150',
          isWeaponOver ? 'scale-105' : '',
        ].join(' ')}
        title={isMyTurn ? 'Arrastra a la Línea de Ataque para atacar' : undefined}
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
            dragPayload={
              !isOpponent
                ? { card: ally, sourceZone: 'defense', sourcePlayer: playerId }
                : undefined
            }
            isOpponent={isOpponent}
            size={size}
          />

          {/* Weapon bonus badge — muestra el bono total (base + temporal) */}
          {weapon && !strengthLocked && ((weapon.bonusFuerza ?? 0) + tempBonus) > 0 && (
            <div className={`absolute -top-1 -right-1 z-20 text-white text-[7px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow ${tempBonus > 0 ? 'bg-orange-500' : 'bg-red-600'}`}>
              +{(weapon.bonusFuerza ?? 0) + tempBonus}
            </div>
          )}


          {/* Weapon miniature — right edge of the ally card; click shows
              full detail, closing it returns to miniature */}
          {weapon && (
            <div
              className="absolute top-1/2 -translate-y-1/2 -right-4 z-20 cursor-pointer hover:scale-110 transition-transform drop-shadow-lg"
              onClick={(e) => {
                e.stopPropagation();
                setDetailCard(weapon);
              }}
              title={`${weapon.nombre} (+${weapon.bonusFuerza ?? 0} ⚔) — clic para ver detalle`}
            >
              <div className="card-enter">
                <CardView card={weapon} size="xs" isOpponent={isOpponent} />
              </div>
            </div>
          )}
        </div>

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
        onUseSpecialAbility={
          detailCard && detailCard.instanceId === weapon?.instanceId && weaponHasActivatedAbility
            ? () => { activateWeaponAbility(weapon!.instanceId, ally.instanceId, playerId); setDetailCard(null); }
            : detailCard && detailCard.instanceId === ally.instanceId && allyHasSummonAbility && !isOpponent
            ? () => { setDetailCard(null); setDeckSearchOpen(true); }
            : undefined
        }
        canUseSpecialAbility={
          detailCard?.instanceId === ally.instanceId ? canUseSummonAbility : canUseWeaponAbility
        }
        specialAbilityLabel={
          detailCard?.instanceId === ally.instanceId
            ? `Invocar Caudillo (−${CAUDILLO_SUMMON_GOLD_COST} Oros)`
            : undefined
        }
      />

      {/* Búsqueda en el Mazo Castillo: solo las cartas elegibles (misma raza,
          coste ≤ 4) aparecen a color y son seleccionables */}
      <DeckSearchModal
        isOpen={deckSearchOpen}
        onClose={() => setDeckSearchOpen(false)}
        title={`Mazo Castillo — invocación de ${ally.nombre}`}
        deck={player.deck}
        isEligible={(c) => isSummonableByCaudillo(c, ally)}
        onPlay={(deckIndex) => summonCaudilloFromDeck(ally.instanceId, deckIndex, playerId)}
      />
    </>
  );
}
