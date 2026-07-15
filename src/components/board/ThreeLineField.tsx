import { useCallback, useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { PlayerId, DragPayload } from '@/types/game.types';
import { AllySlot } from './AllySlot';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { getLineCardSize } from '@/utils/cardSize';
import { effectiveForce, hasMachinery } from '@/utils/gameRules';
import { useDropZone } from '@/utils/dragManager';
import { useTargetingStore } from '@/store/targetingStore';
import { Shield, Sword, Layers } from 'lucide-react';

interface ThreeLineFieldProps {
  playerId: PlayerId;
  isOpponent?: boolean;
}

interface DropLineProps {
  zoneId: string;
  label: string;
  icon: React.ReactNode;
  cards: CardInPlay[];
  zoneColor: string;
  accepts: (payload: DragPayload) => boolean;
  onDrop: (payload: DragPayload) => void;
  renderCard: (card: CardInPlay) => React.ReactNode;
  disabled?: boolean;
}

function DropLine({
  zoneId, label, icon, cards, zoneColor, accepts, onDrop, renderCard, disabled = false,
}: DropLineProps) {
  const { isOver, isEligible, zoneProps } = useDropZone(disabled ? null : zoneId, {
    accepts,
    onDrop,
  });

  return (
    <div
      {...zoneProps}
      className={[
        'flex-1 min-h-12 sm:min-h-16 rounded-lg border-2 border-dashed transition-all duration-200 overflow-visible',
        isOver
          ? 'border-blue-400/70 bg-blue-500/5 scale-[1.01] ring-1 ring-blue-400/40 card-glow-blue'
          : isEligible
          ? `border-blue-500/40 ${zoneColor}`
          : `border-slate-700/50 ${zoneColor}`,
      ].join(' ')}
    >
      {/* Line header */}
      <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 border-b border-slate-700/40 bg-slate-900/40">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[8px] sm:text-[9px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        <span className="ml-auto text-[8px] sm:text-[9px] text-slate-600">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="relative flex flex-wrap gap-1 sm:gap-2 p-1 sm:p-2 items-end content-start min-h-10 sm:min-h-12">
        {cards.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-400 opacity-10 pointer-events-none [&>svg]:w-8 [&>svg]:h-8">
            {icon}
          </span>
        )}
        {cards.map(renderCard)}
      </div>
    </div>
  );
}

export function ThreeLineField({ playerId, isOpponent = false }: ThreeLineFieldProps) {
  const defenseField   = useGameStore((s) => s.players[playerId].defenseField);
  const attackField    = useGameStore((s) => s.players[playerId].attackField);
  const supportField   = useGameStore((s) => s.players[playerId].supportField);
  const boardPlayers = useGameStore((s) => s.players);
  // 'intercambio_control': cartas no-oro de ESTE lado elegibles si el que
  // activa es el rival (marco dorado + clic para intercambiar).
  const swapTargetingRaw = useTargetingStore((s) => s.swap);
  const swapTargeting =
    swapTargetingRaw && swapTargetingRaw.playerId !== playerId ? swapTargetingRaw : null;
  // 'destruye_no_oro' (Héroes de Chile): cualquier carta en juego es objetivo.
  const destroyAnyTargeting = useTargetingStore((s) => s.destroyAny);
  const cancelTargeting = useTargetingStore((s) => s.cancel);
  const { swapControl, destroyNonGoldCard } = useGameActions();

  const swapWrap = (card: CardInPlay, node: React.ReactNode) => {
    if (swapTargeting) {
      return (
        <div
          className="relative cursor-pointer"
          onClick={() => {
            swapControl(swapTargeting.sourceInstanceId, card.instanceId, playerId, swapTargeting.playerId);
            cancelTargeting();
          }}
        >
          <div className="absolute -inset-1 rounded-xl ring-2 ring-yellow-400 animate-pulse pointer-events-none z-30" />
          <div className="pointer-events-none">{node}</div>
        </div>
      );
    }
    if (destroyAnyTargeting) {
      return (
        <div
          className="relative cursor-pointer"
          onClick={() => {
            destroyNonGoldCard(destroyAnyTargeting.sourceInstanceId, card.instanceId, playerId, destroyAnyTargeting.playerId);
            cancelTargeting();
          }}
        >
          <div className="absolute -inset-1 rounded-xl ring-2 ring-red-400 animate-pulse pointer-events-none z-30" />
          <div className="pointer-events-none">{node}</div>
        </div>
      );
    }
    return node;
  };
  const equippedWeapons = useGameStore((s) => s.players[playerId].equippedWeapons);
  const turn           = useGameStore((s) => s.turn);
  const player         = useGameStore((s) => s.players[playerId]);
  const { playCard, declareAttack } = useGameActions();
  const [detailCard, setDetailCard]   = useState<CardInPlay | null>(null);

  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  const attackSize  = getLineCardSize(attackField.length);
  const defenseSize = getLineCardSize(defenseField.length);
  const supportSize = getLineCardSize(supportField.length);

  // Zone predicates: what each line accepts (drives eligibility highlight).
  const acceptsDefense = useCallback(
    (p: DragPayload) =>
      p.card.tipo === 'aliado' && p.sourceZone === 'hand' && p.sourcePlayer === playerId,
    [playerId],
  );
  const acceptsSupport = useCallback(
    (p: DragPayload) =>
      p.sourceZone === 'hand' &&
      p.sourcePlayer === playerId &&
      (p.card.tipo === 'totem' || (p.card.tipo === 'arma' && hasMachinery(p.card))),
    [playerId],
  );
  // Own ally dragged from defense to the attack line declares an attack.
  const acceptsAttack = useCallback(
    (p: DragPayload) =>
      p.card.tipo === 'aliado' && p.sourceZone === 'defense' && p.sourcePlayer === playerId,
    [playerId],
  );

  const handleDropToDefense = useCallback(
    (p: DragPayload) => playCard(p.card, playerId),
    [playCard, playerId],
  );
  const handleDropToSupport = useCallback(
    (p: DragPayload) => playCard(p.card, playerId),
    [playCard, playerId],
  );
  const handleDropToAttack = useCallback(
    (p: DragPayload) => declareAttack(p.card.instanceId, playerId),
    [declareAttack, playerId],
  );

  return (
    <>
      <div className="flex flex-col gap-1 flex-1">
        {/* ── Línea de Ataque ────────────────────────────────────────── */}
        <DropLine
          zoneId={`attack:${playerId}`}
          label="Línea de Ataque"
          icon={<Sword size={10} />}
          cards={attackField}
          accepts={acceptsAttack}
          zoneColor="bg-red-950/10"
          onDrop={handleDropToAttack}
          disabled={!isMyTurn}
          renderCard={(card) => (
            <div key={card.instanceId} data-fx-instance={card.instanceId} className="relative card-enter">
              {swapWrap(
                card,
                <>
                  <CardView
                    card={{
                      // Fuerza efectiva: bonos, 'fuerza_inmutable' y 'debilitar_aliado'
                      ...card,
                      fuerza: effectiveForce(card, boardPlayers[playerId], boardPlayers),
                    }}
                    onClick={() => setDetailCard(card)}
                    isOpponent={isOpponent}
                    size={attackSize}
                  />
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    ⚔ atacando
                  </div>
                </>,
              )}
            </div>
          )}
        />

        {/* ── Línea de Defensa ───────────────────────────────────────── */}
        <DropLine
          zoneId={`defense:${playerId}`}
          label="Línea de Defensa"
          icon={<Shield size={10} />}
          cards={defenseField}
          accepts={acceptsDefense}
          zoneColor="bg-blue-950/10"
          onDrop={handleDropToDefense}
          disabled={!isMyTurn}
          renderCard={(card) => (
            <div
              key={card.instanceId}
              data-fx-instance={card.instanceId}
              className="card-enter"
            >
              <AllySlot
                ally={card}
                weapons={equippedWeapons[card.instanceId] ?? []}
                playerId={playerId}
                isOpponent={isOpponent}
                size={defenseSize}
              />
            </div>
          )}
        />

        {/* ── Línea de Apoyo ─────────────────────────────────────────── */}
        <DropLine
          zoneId={`support:${playerId}`}
          label="Línea de Apoyo"
          icon={<Layers size={10} />}
          cards={supportField}
          accepts={acceptsSupport}
          zoneColor="bg-green-950/10"
          onDrop={handleDropToSupport}
          disabled={!isMyTurn}
          renderCard={(card) => (
            <div key={card.instanceId} className="card-enter">
              {swapWrap(
                card,
                <CardView
                  card={card}
                  onClick={() => setDetailCard(card)}
                  size={supportSize}
                  isOpponent={isOpponent}
                />,
              )}
            </div>
          )}
        />
      </div>

      <CardDetail
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
        onPlay={!isOpponent ? (c) => {
          const { allowed } = { allowed: player.goldCount >= c.coste };
          if (allowed) playCard(c, playerId);
        } : undefined}
        canPlay={detailCard ? player.goldCount >= detailCard.coste : false}
      />
    </>
  );
}
