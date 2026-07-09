import { useCallback, useState } from 'react';
import type { PlayerState, PlayerId, DragPayload } from '@/types/game.types';
import type { CardInPlay } from '@/types/card.types';
import { DeckPile } from './DeckPile';
import { ZoneViewer } from './ZoneViewer';
import { CardView } from '@/components/cards/CardView';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { useDropZone } from '@/utils/dragManager';
import { GOLD_TALISMAN_YIELD, hasGoldTalismanAbility } from '@/utils/gameRules';

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
  /** Abre el visor de la zona. Solo se pasa cuando el jugador puede inspeccionarla. */
  onInspect?: () => void;
  title?: string;
  /** Ancla DOM para efectos visuales (ver src/utils/*Fx.ts). */
  dataFx?: string;
}

function SmallZone({ label, letter, letterColor, cards, onInspect, title, dataFx }: SmallZoneProps) {
  const top = cards.at(-1);

  return (
    <div
      className="flex flex-col items-center gap-0.5 w-[72px] sm:w-[88px] lg:w-[104px]"
      title={title ?? label}
      data-fx={dataFx}
    >
      <div className={`text-[9px] sm:text-[10px] uppercase tracking-wider ${letterColor} font-bold`}>{letter}</div>
      <div
        onClick={onInspect}
        className={[
          'relative w-16 h-[85px] sm:w-20 sm:h-[107px] lg:w-24 lg:h-32 rounded-lg border-2 border-dashed',
          'bg-slate-900/60 flex items-center justify-center transition-all',
          onInspect ? 'cursor-pointer hover:border-slate-500/80 active:scale-[0.97]' : 'cursor-default',
          cards.length > 0 ? 'border-slate-600/60' : 'border-slate-800/60',
        ].join(' ')}
      >
        {top ? (
          <div className="absolute inset-1 pointer-events-none">
            <CardView card={top} size="sm" />
          </div>
        ) : (
          <span className={`text-2xl font-black opacity-20 ${letterColor}`}>{letter}</span>
        )}
        {cards.length > 1 && (
          <div className="absolute -top-1.5 -right-1.5 bg-slate-700 text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
            {cards.length}
          </div>
        )}
      </div>
      <div className="text-[8px] sm:text-[9px] text-slate-600 text-center leading-tight">{label}</div>
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
  /** Oros virtuales 'oro_talismanes' activos (solo pagan talismanes). */
  talismanGold: number;
  playerId: PlayerId;
  /** Abre el visor de la zona. Solo se pasa cuando el jugador puede inspeccionarla. */
  onInspect?: () => void;
}

function GoldZone({ cards, goldCount, talismanGold, playerId, onInspect }: GoldZoneProps) {
  const { playCard } = useGameActions();
  const turn = useGameStore((s) => s.turn);
  const stackVisible = Math.min(cards.length, 4);

  const canReceive = turn.currentPlayer === playerId && turn.phase === 'vigilia';

  const acceptsGold = useCallback(
    (p: DragPayload) =>
      p.card.tipo === 'oro' && p.sourceZone === 'hand' && p.sourcePlayer === playerId,
    [playerId],
  );
  const onDropGold = useCallback(
    (p: DragPayload) => playCard(p.card, playerId),
    [playCard, playerId],
  );
  const { isOver: isDragOver, zoneProps } = useDropZone(
    canReceive ? `gold:${playerId}` : null,
    { accepts: acceptsGold, onDrop: onDropGold },
  );

  return (
    <div className="flex flex-col items-center gap-0.5 w-[72px] sm:w-[88px] lg:w-[104px]" title="O — Zona de Oros (arrastra cartas de oro aquí)">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-yellow-400 font-bold">O</div>

      {/* Drop target + card pile */}
      <div
        {...zoneProps}
        onClick={onInspect}
        className={[
          'relative w-16 h-[85px] sm:w-20 sm:h-[107px] lg:w-24 lg:h-32 rounded-lg border-2 transition-all duration-150',
          onInspect ? 'cursor-pointer' : '',
          isDragOver
            ? 'border-yellow-400 bg-yellow-400/10 scale-105 shadow-lg shadow-yellow-400/20'
            : canReceive && cards.length === 0
            ? 'border-dashed border-yellow-700/50 bg-yellow-950/20'
            : 'border-dashed border-slate-800/60 bg-slate-900/60',
        ].join(' ')}
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
                  inset: 0,
                  top: (stackVisible - 1 - i) * 2,
                  left: (stackVisible - 1 - i) * 1,
                  zIndex: i,
                }}
              />
            ))}
            {/* Top card — entra con pop y pulso dorado al llegar un oro nuevo */}
            <div
              key={cards.at(-1)!.instanceId}
              className="absolute inset-0 pointer-events-none card-enter"
              style={{ zIndex: stackVisible }}
            >
              <CardView card={cards.at(-1)!} size="sm" />
            </div>
            <div
              key={`pulse-${cards.length}`}
              className="absolute inset-0 rounded-lg gold-pulse pointer-events-none"
              style={{ zIndex: stackVisible + 1 }}
            />
          </>
        )}

        {/* Counter badge — visible cuando hay oros */}
        {goldCount > 0 && (
          <div className="absolute -top-1.5 -right-1.5 z-20 bg-yellow-500 text-black text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center shadow border border-yellow-300">
            {goldCount}
          </div>
        )}

        {/* Oros virtuales solo-talismanes ('oro_talismanes') */}
        {talismanGold > 0 && (
          <div
            className="absolute -bottom-1.5 -right-1.5 z-20 bg-purple-500 text-white text-[8px] font-black rounded-full px-1.5 h-5 flex items-center justify-center shadow border border-purple-300"
            title={`${talismanGold} Oro(s) solo para Talismanes (expiran al final del turno)`}
          >
            +{talismanGold}✨
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

/** Zonas inspeccionables con el visor. */
type InspectableZone = 'goldPaid' | 'removed' | 'deck' | 'graveyard' | 'gold' | 'exile';

const ZONE_META: Record<InspectableZone, { title: string; letter: string }> = {
  goldPaid:  { title: 'Oro Pagado',    letter: 'P' },
  removed:   { title: 'Removidas',     letter: 'R' },
  deck:      { title: 'Mazo Castillo', letter: 'M' },
  graveyard: { title: 'Cementerio',    letter: '+' },
  gold:      { title: 'Oros',          letter: 'O' },
  exile:     { title: 'Destierro',     letter: 'D' },
};

export function SideZones({ player, playerId, isOpponent = false }: SideZonesProps) {
  const [viewerZone, setViewerZone] = useState<InspectableZone | null>(null);
  const { activateGoldTalisman } = useGameActions();

  // Regla: un jugador solo puede revisar SUS PROPIAS zonas. Punto de extensión:
  // cuando una habilidad/habilidad especial permita mirar zonas del oponente,
  // este flag deberá derivarse de los efectos activos en vez de isOpponent.
  const canInspectZones = !isOpponent;

  const inspect = (zone: InspectableZone) =>
    canInspectZones ? () => setViewerZone(zone) : undefined;

  // El mazo castillo son Cards (aún no en juego): se adaptan para el visor.
  const viewerCards: CardInPlay[] =
    viewerZone === null
      ? []
      : viewerZone === 'deck'
      ? player.deck.map((c, i) => ({
          ...c,
          instanceId: `deck-view-${c.id}-${i}`,
          tapped: false,
          attackedThisTurn: false,
          summonedThisTurn: false,
        }))
      : player[viewerZone];

  return (
    <>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        {/* Row 1: P — Oro Pagado | R — Removidas */}
        <div className="flex gap-1.5">
          <SmallZone letter="P" letterColor="text-yellow-500" label="Oro Pagado"
            cards={player.goldPaid} onInspect={inspect('goldPaid')} title="P — Zona de Oro Pagado" />
          <SmallZone letter="R" letterColor="text-orange-400" label="Removidas"
            cards={player.removed} onInspect={inspect('removed')} title="R — Cartas Removidas" />
        </div>

        {/* Row 2: M — Mazo Castillo | + — Cementerio */}
        <div className="flex gap-1.5 items-start">
          <div
            className={`flex flex-col items-center gap-0.5 ${canInspectZones ? 'cursor-pointer' : ''}`}
            onClick={inspect('deck')}
          >
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-300 font-bold">M</div>
            <DeckPile deck={player.deck} playerId={playerId} isOpponent={isOpponent} />
          </div>
          <SmallZone letter="+" letterColor="text-slate-300" label="Cementerio"
            cards={player.graveyard} onInspect={inspect('graveyard')} title="+ — Cementerio"
            dataFx={`grave-${playerId}`} />
        </div>

        {/* Row 3: O — Oros (zona especial) | D — Destierro */}
        <div className="flex gap-1.5">
          <GoldZone cards={player.gold} goldCount={player.goldCount} talismanGold={player.talismanGold} playerId={playerId} onInspect={inspect('gold')} />
          <SmallZone letter="D" letterColor="text-purple-400" label="Destierro"
            cards={player.exile} onInspect={inspect('exile')} title="D — Destierro" />
        </div>
      </div>

      {viewerZone && (
        <ZoneViewer
          isOpen
          onClose={() => setViewerZone(null)}
          title={ZONE_META[viewerZone].title}
          letter={ZONE_META[viewerZone].letter}
          cards={viewerCards}
          detailAction={
            // 'oro_talismanes': pagar el oro desde la zona O propia genera
            // 2 oros virtuales solo para talismanes (en cualquier turno).
            viewerZone === 'gold' && !isOpponent
              ? (card) =>
                  hasGoldTalismanAbility(card)
                    ? {
                        label: `Pagar: +${GOLD_TALISMAN_YIELD} Oros para Talismanes`,
                        onUse: () => activateGoldTalisman(card.instanceId, playerId),
                      }
                    : null
              : undefined
          }
        />
      )}
    </>
  );
}
