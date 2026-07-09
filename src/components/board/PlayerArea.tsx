import type { PlayerState, PlayerId, TurnPhase } from '@/types/game.types';
import { ThreeLineField } from './ThreeLineField';
import { SideZones } from './SideZones';
import { PlayerHand } from '@/components/cards/PlayerHand';
import { Heart, Coins } from 'lucide-react';

interface PlayerAreaProps {
  player: PlayerState;
  playerId: PlayerId;
  isOpponent?: boolean;
  /** Shown only for the non-opponent (active player header) */
  currentPhase?: TurnPhase;
}

const PHASE_LABELS: Record<TurnPhase, string> = {
  agrupacion: 'Agrupación',
  vigilia:    'Vigilia',
  batalla:    'Batalla Mitológica',
  final:      'Fase Final',
};

const PHASE_COLORS: Record<TurnPhase, string> = {
  agrupacion: 'text-slate-400 border-slate-500/40',
  vigilia:    'text-green-400 border-green-500/40',
  batalla:    'text-red-400 border-red-500/40',
  final:      'text-blue-400 border-blue-500/40',
};

export function PlayerArea({ player, playerId, isOpponent = false, currentPhase }: PlayerAreaProps) {
  const lifeColor =
    player.life > 10 ? 'text-green-400' : player.life > 5 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="flex flex-col gap-1.5 w-full">

      {/* ── Header: stats + phase ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg bg-slate-900/70 border border-slate-700/40">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-bold text-white text-xs sm:text-sm">{player.name}</span>
          <span className={`flex items-center gap-0.5 font-bold text-xs sm:text-sm ${lifeColor}`}>
            <Heart size={10} />
            {player.life}
          </span>
          <span className="flex items-center gap-0.5 text-yellow-400 font-bold text-xs sm:text-sm">
            <Coins size={10} />
            {player.goldCount}
          </span>
        </div>

        {/* Phase badge — only shown when it's this player's active turn */}
        {currentPhase && (
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PHASE_COLORS[currentPhase]}`}>
            {PHASE_LABELS[currentPhase]}
          </div>
        )}
      </div>

      {/* ── Main board row: 3 lines (left) + 6 zones (right) ─────────── */}
      <div className="flex flex-col sm:flex-row gap-1.5 items-stretch">
        {/* Three horizontal lines */}
        <ThreeLineField playerId={playerId} isOpponent={isOpponent} />

        {/* Six side zones (P/R — M/+ — O/D) */}
        <SideZones player={player} playerId={playerId} isOpponent={isOpponent} />
      </div>

      {/* ── Hand ──────────────────────────────────────────────────────── */}
      <div
        className="px-1.5 sm:px-2 py-1 sm:py-1.5 bg-slate-900/50 rounded-lg border border-slate-700/30"
        data-fx={`hand-${playerId}`}
      >
        <div className="text-[7px] sm:text-[8px] text-slate-600 uppercase tracking-widest mb-0.5 sm:mb-1">
          Mano — {player.hand.length} cartas
        </div>
        <PlayerHand cards={player.hand} playerId={playerId} isOpponent={isOpponent} />
      </div>
    </div>
  );
}
