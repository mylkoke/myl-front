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
  abilityUseKey,
  effectiveForce,
  hasCaudilloSummon,
  hasMillDestroy,
  hasMillGoldAbility,
  hasRaceSuppress,
  hasTalismanRecycle,
  hasWeakenAbility,
  isSummonableByCaudillo,
  strengthLockedFor,
  CAUDILLO_SUMMON_GOLD_COST,
  MILL_DESTROY_COST,
  MILL_GOLD_AMOUNT,
  MILL_GOLD_COST,
  TALISMAN_RECYCLE_DISCOUNT,
  WEAKEN_GOLD_COST,
} from '@/utils/gameRules';
import { Modal } from '@/components/ui/Modal';
import { useTargetingStore } from '@/store/targetingStore';

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
  const { equipWeapon, summonCaudilloFromDeck, weakenAlly, millDestroyAlly, swapControl,
    playRecycledTalisman, activateMillGold, chooseRaceSuppress, equipWeaponFromZone } = useGameActions();
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [razaPickerOpen, setRazaPickerOpen] = useState(false);
  const turn   = useGameStore((s) => s.turn);
  const combat = useGameStore((s) => s.combat);
  const player = useGameStore((s) => s.players[playerId]);

  const activateWeaponAbility = useGameStore((s) => s.activateWeaponAbility);
  // Fuerza efectiva centralizada (bonos, 'fuerza_inmutable', 'debilitar_aliado')
  const strengthLocked = useGameStore((s) => strengthLockedFor(playerId, s.players));
  const weakened = player.weakenedAllies?.includes(ally.instanceId) ?? false;
  const tempBonus = strengthLocked || weakened ? 0 : player.weaponTempBonuses[ally.instanceId] ?? 0;
  const force = useGameStore((s) => effectiveForce(ally, s.players[playerId], s.players));
  const displayAlly: CardInPlay = { ...ally, fuerza: force };

  // Modo selección de objetivo ('debilitar_aliado' / 'botar3_destruye'):
  // este aliado es elegible y se ilumina.
  const weakenTargeting = useTargetingStore((s) => s.weaken);
  const destroyTargeting = useTargetingStore((s) => s.destroy);
  // 'intercambio_control': solo las cartas del RIVAL del que activa son elegibles.
  const swapTargetingRaw = useTargetingStore((s) => s.swap);
  const swapTargeting =
    swapTargetingRaw && swapTargetingRaw.playerId !== playerId ? swapTargetingRaw : null;
  // 'desde_cementerio' con armas: solo los aliados PROPIOS del que equipa.
  const equipTargetingRaw = useTargetingStore((s) => s.equip);
  const equipTargeting =
    equipTargetingRaw && equipTargetingRaw.playerId === playerId && !isOpponent
      ? equipTargetingRaw
      : null;
  const cancelTargeting = useTargetingStore((s) => s.cancel);
  const anyTargeting = weakenTargeting ?? destroyTargeting ?? swapTargeting ?? equipTargeting;

  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  const weaponHasActivatedAbility = (weapon?.habilidadesEspeciales?.length ?? 0) > 0;
  const canUseWeaponAbility =
    isMyTurn &&
    weaponHasActivatedAbility &&
    !player.weaponAbilityUsedThisTurn.includes(weapon!.instanceId) &&
    player.goldCount >= 1;

  // 'debilitar_aliado': en tu Vigilia, paga 1 oro → un aliado objetivo tiene
  // Fuerza 0 hasta la Fase Final (repetible).
  const allyHasWeakenAbility = hasWeakenAbility(ally);
  const canUseWeakenAbility =
    isMyTurn &&
    allyHasWeakenAbility &&
    !combat &&
    turn.phase === 'vigilia' &&
    player.goldCount >= WEAKEN_GOLD_COST;

  // 'talisman_reciclado': 1 vez por turno, juega un talismán desde tu
  // Cementerio o Destierro con coste −3; luego se remueve del juego.
  const allyHasRecycleAbility = hasTalismanRecycle(ally);
  const recyclePool = [...player.graveyard, ...player.exile];
  const canUseRecycleAbility =
    isMyTurn &&
    allyHasRecycleAbility &&
    !combat &&
    turn.phase === 'vigilia' &&
    !player.allyAbilityUsedThisTurn.includes(ally.instanceId) &&
    recyclePool.some(
      (c) =>
        c.tipo === 'talisman' &&
        Math.max(0, c.coste - TALISMAN_RECYCLE_DISCOUNT) <=
          player.goldCount + player.talismanGold,
    );

  // 'botar3_destruye': bota 3 cartas del Mazo Castillo → destruye un aliado.
  const allyHasMillDestroy = hasMillDestroy(ally);
  const canUseMillDestroy =
    isMyTurn &&
    allyHasMillDestroy &&
    !combat &&
    turn.phase === 'vigilia' &&
    player.deck.length >= MILL_DESTROY_COST;

  // 'pagar2_bota6' y 'nombrar_raza_suprime' (Luis Carrera SP): dos
  // habilidades activadas en la misma carta → botones múltiples en el detalle.
  const responseWindow = useGameStore((s) => s.responseWindow);
  const canActivateBase = isMyTurn && !combat && !responseWindow && turn.phase === 'vigilia';
  const abilityActions = !isOpponent
    ? [
        ...(hasMillGoldAbility(ally)
          ? [{
              label: `Pagar ${MILL_GOLD_COST} Oros: el rival bota ${MILL_GOLD_AMOUNT} (10 s para responder)`,
              enabled:
                canActivateBase &&
                player.goldCount >= MILL_GOLD_COST &&
                !player.allyAbilityUsedThisTurn.includes(abilityUseKey(ally.instanceId, 'pagar2_bota6')),
              onUse: () => activateMillGold(ally.instanceId, playerId),
            }]
          : []),
        ...(hasRaceSuppress(ally)
          ? [{
              label: 'Nombrar raza: los demás pierden sus habilidades',
              enabled:
                canActivateBase &&
                !player.allyAbilityUsedThisTurn.includes(abilityUseKey(ally.instanceId, 'nombrar_raza_suprime')),
              onUse: () => setRazaPickerOpen(true),
            }]
          : []),
      ]
    : [];

  // Razas presentes entre los aliados en mesa (ambos jugadores) para nombrar.
  const boardRazas = useGameStore((s) =>
    [
      ...new Set(
        (['player', 'opponent'] as const)
          .flatMap((pid) => [...s.players[pid].defenseField, ...s.players[pid].attackField])
          .map((c) => c.raza)
          .filter((r): r is string => !!r),
      ),
    ].sort((a, b) => a.localeCompare(b)),
  );

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
          {/* Marco pulsante: aliado elegible mientras se elige objetivo
              (rojo = debilitar/destruir; dorado = intercambio de control) */}
          {anyTargeting && (
            <div
              className={`absolute -inset-1 rounded-xl ring-2 animate-pulse pointer-events-none z-30 ${
                swapTargeting || equipTargeting ? 'ring-yellow-400' : 'ring-red-400'
              }`}
            />
          )}
          <CardView
            card={displayAlly}
            onClick={
              weakenTargeting
                ? () => {
                    weakenAlly(
                      weakenTargeting.sourceInstanceId,
                      ally.instanceId,
                      playerId,
                      weakenTargeting.playerId,
                    );
                    cancelTargeting();
                  }
                : destroyTargeting
                ? () => {
                    millDestroyAlly(
                      destroyTargeting.sourceInstanceId,
                      ally.instanceId,
                      playerId,
                      destroyTargeting.playerId,
                    );
                    cancelTargeting();
                  }
                : swapTargeting
                ? () => {
                    swapControl(
                      swapTargeting.sourceInstanceId,
                      ally.instanceId,
                      playerId,
                      swapTargeting.playerId,
                    );
                    cancelTargeting();
                  }
                : equipTargeting
                ? () => {
                    equipWeaponFromZone(
                      equipTargeting.weaponInstanceId,
                      equipTargeting.zone,
                      ally.instanceId,
                      equipTargeting.playerId,
                    );
                    cancelTargeting();
                  }
                : () => setDetailCard(ally)
            }
            dragPayload={
              !isOpponent && !anyTargeting
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
            : detailCard && detailCard.instanceId === ally.instanceId && allyHasWeakenAbility && !isOpponent
            ? () => {
                setDetailCard(null);
                // Entra en modo selección: los aliados del tablero se iluminan.
                useTargetingStore.getState().startWeaken(ally.instanceId, playerId);
              }
            : detailCard && detailCard.instanceId === ally.instanceId && allyHasRecycleAbility && !isOpponent
            ? () => { setDetailCard(null); setRecycleOpen(true); }
            : detailCard && detailCard.instanceId === ally.instanceId && allyHasMillDestroy && !isOpponent
            ? () => {
                setDetailCard(null);
                useTargetingStore.getState().startDestroy(ally.instanceId, playerId);
              }
            : undefined
        }
        canUseSpecialAbility={
          detailCard?.instanceId === ally.instanceId
            ? allyHasSummonAbility
              ? canUseSummonAbility
              : allyHasWeakenAbility
              ? canUseWeakenAbility
              : allyHasRecycleAbility
              ? canUseRecycleAbility
              : canUseMillDestroy
            : canUseWeaponAbility
        }
        specialAbilityLabel={
          detailCard?.instanceId === ally.instanceId
            ? allyHasSummonAbility
              ? `Invocar Caudillo (−${CAUDILLO_SUMMON_GOLD_COST} Oros)`
              : allyHasWeakenAbility
              ? `Debilitar: Fuerza 0 hasta la Fase Final (−${WEAKEN_GOLD_COST} Oro)`
              : allyHasRecycleAbility
              ? `Talismán del Cementerio/Destierro (coste −${TALISMAN_RECYCLE_DISCOUNT})`
              : `Botar ${MILL_DESTROY_COST} cartas: destruir un aliado`
            : undefined
        }
        abilityActions={
          detailCard?.instanceId === ally.instanceId ? abilityActions : undefined
        }
      />

      {/* 'nombrar_raza_suprime': selector de raza a nombrar */}
      <Modal
        isOpen={razaPickerOpen}
        onClose={() => setRazaPickerOpen(false)}
        title={`${ally.nombre} — nombrar una raza`}
      >
        <p className="text-xs text-slate-400 mb-3">
          Todos los demás aliados que NO sean de la raza nombrada pierden sus
          habilidades hasta la Fase Final.
        </p>
        {boardRazas.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-4">
            No hay razas entre los aliados en mesa.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {boardRazas.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRazaPickerOpen(false);
                  chooseRaceSuppress(ally.instanceId, r, playerId);
                }}
                className="px-3 py-2 rounded-full text-sm font-medium border bg-amber-500/10 border-amber-500/50 text-amber-300 hover:bg-amber-500/25 transition-all"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </Modal>

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

      {/* 'talisman_reciclado': talismanes del Cementerio + Destierro con coste −3 */}
      <DeckSearchModal
        isOpen={recycleOpen}
        onClose={() => setRecycleOpen(false)}
        title={`Cementerio y Destierro — talismanes de ${ally.nombre}`}
        deck={recyclePool}
        isEligible={(c) =>
          c.tipo === 'talisman' &&
          Math.max(0, c.coste - TALISMAN_RECYCLE_DISCOUNT) <=
            player.goldCount + player.talismanGold
        }
        onPlay={(index) =>
          playRecycledTalisman(ally.instanceId, recyclePool[index].instanceId, playerId)
        }
      />
    </>
  );
}
