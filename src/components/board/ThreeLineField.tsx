import { useState } from 'react';
import type { CardInPlay } from '@/types/card.types';
import type { PlayerId } from '@/types/game.types';
import { AllySlot } from './AllySlot';
import { CardView } from '@/components/cards/CardView';
import { CardDetail } from '@/components/cards/CardDetail';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { Shield, Sword, Layers } from 'lucide-react';

interface ThreeLineFieldProps {
  playerId: PlayerId;
  isOpponent?: boolean;
}

interface DropLineProps {
  label: string;
  icon: React.ReactNode;
  cards: CardInPlay[];
  accepts: string[];           // card types this zone accepts
  zoneColor: string;
  onDrop?: (card: CardInPlay) => void;
  renderCard: (card: CardInPlay) => React.ReactNode;
  minHeight?: string;
  disabled?: boolean;
}

function DropLine({
  label, icon, cards, zoneColor, onDrop, renderCard, minHeight = '80px', disabled = false,
}: DropLineProps) {
  const [over, setOver] = useState(false);

  return (
    <div
      className={[
        'flex-1 rounded-lg border-2 border-dashed transition-all duration-200 overflow-hidden',
        over && !disabled ? 'border-blue-400/70 bg-blue-500/5 scale-[1.01]' : `border-slate-700/50 ${zoneColor}`,
      ].join(' ')}
      style={{ minHeight }}
      onDragOver={(e) => {
        if (disabled || !onDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled || !onDrop) return;
        e.preventDefault();
        setOver(false);
        try {
          const { card } = JSON.parse(e.dataTransfer.getData('application/json')) as { card: CardInPlay };
          onDrop(card);
        } catch { /* noop */ }
      }}
    >
      {/* Line header */}
      <div className="flex items-center gap-1.5 px-3 py-1 border-b border-slate-700/40 bg-slate-900/40">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-medium">{label}</span>
        <span className="ml-auto text-[9px] text-slate-600">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-wrap gap-2 p-2 items-end">
        {cards.length === 0 && (
          <span className="text-slate-700 text-xs italic self-center px-2">
            {disabled ? '—' : 'Vacío'}
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
  const equippedWeapons = useGameStore((s) => s.players[playerId].equippedWeapons);
  const turn           = useGameStore((s) => s.turn);
  const player         = useGameStore((s) => s.players[playerId]);
  const { playCard, tapCard } = useGameActions();
  const [detailCard, setDetailCard]   = useState<CardInPlay | null>(null);

  const isMyTurn = turn.currentPlayer === playerId && !isOpponent;

  const handleDropToDefense = (card: CardInPlay) => {
    if (!isMyTurn) return;
    if (card.tipo === 'aliado' || card.tipo === 'tierra') {
      playCard(card, playerId);
    }
  };

  const handleDropToSupport = (card: CardInPlay) => {
    if (!isMyTurn) return;
    if (card.tipo === 'totem' || card.tipo === 'tierra') {
      playCard(card, playerId);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-1 flex-1">
        {/* ── Línea de Ataque ────────────────────────────────────────── */}
        <DropLine
          label="Línea de Ataque"
          icon={<Sword size={10} />}
          cards={attackField}
          accepts={[]}
          zoneColor="bg-red-950/10"
          minHeight="72px"
          disabled // attack line: aliados solo entran vía atacar
          renderCard={(card) => (
            <div key={card.instanceId} className="relative">
              <CardView
                card={{ ...card, fuerza: card.fuerza + (equippedWeapons[card.instanceId]?.bonusFuerza ?? 0) }}
                onClick={() => setDetailCard(card)}
                isOpponent={isOpponent}
              />
              {/* Attacking indicator */}
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                ⚔ atacando
              </div>
            </div>
          )}
        />

        {/* ── Línea de Defensa ───────────────────────────────────────── */}
        <DropLine
          label="Línea de Defensa"
          icon={<Shield size={10} />}
          cards={defenseField}
          accepts={['aliado', 'tierra']}
          zoneColor="bg-blue-950/10"
          minHeight="100px"
          onDrop={isMyTurn ? handleDropToDefense : undefined}
          disabled={!isMyTurn}
          renderCard={(card) => (
            <div
              key={card.instanceId}
              onDoubleClick={() => !isOpponent && tapCard(card.instanceId, playerId)}
            >
              <AllySlot
                ally={card}
                weapon={equippedWeapons[card.instanceId]}
                playerId={playerId}
                isOpponent={isOpponent}
              />
            </div>
          )}
        />

        {/* ── Línea de Apoyo ─────────────────────────────────────────── */}
        <DropLine
          label="Línea de Apoyo"
          icon={<Layers size={10} />}
          cards={supportField}
          accepts={['totem', 'tierra']}
          zoneColor="bg-green-950/10"
          minHeight="72px"
          onDrop={isMyTurn ? handleDropToSupport : undefined}
          disabled={!isMyTurn}
          renderCard={(card) => (
            <div key={card.instanceId}>
              <CardView
                card={card}
                onClick={() => setDetailCard(card)}
                compact
                isOpponent={isOpponent}
              />
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
