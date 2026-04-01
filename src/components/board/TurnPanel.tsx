import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { useGameStatus, useTurn } from '@/hooks/usePlayer';
import { Button } from '@/components/ui/Button';
import { ChevronRight, RefreshCw, SkipForward, Loader2 } from 'lucide-react';

const PHASE_LABELS: Record<string, string> = {
  draw: 'Robar',
  main: 'Principal',
  combat: 'Combate',
  end: 'Final',
};

const PHASE_COLORS: Record<string, string> = {
  draw: 'text-blue-400',
  main: 'text-green-400',
  combat: 'text-red-400',
  end: 'text-slate-400',
};

interface TurnPanelProps {
  /** Callback que dispara la animación de rotación antes de cambiar turno */
  onEndTurn: () => void;
  isAnimating: boolean;
}

export function TurnPanel({ onEndTurn, isAnimating }: TurnPanelProps) {
  const turn = useTurn();
  const players = useGameStore((s) => s.players);
  const { isGameOver, winner, gameLog } = useGameStatus();
  const { advancePhase, resetGame } = useGameActions();

  const currentPlayerName = players[turn.currentPlayer]?.name ?? '';
  const isPlayerTurn = turn.currentPlayer === 'player';

  return (
    <div className="flex flex-col gap-3 p-3 bg-slate-900/90 border border-slate-700/50 rounded-xl shadow-xl w-full">
      {/* ── Turn info ──────────────────────────────────────── */}
      <div className="text-center">
        <div className="text-xs text-slate-500 uppercase tracking-wider">
          Turno {turn.turnNumber}
        </div>
        <div className="font-bold text-white text-sm mt-0.5">{currentPlayerName}</div>
        <div className={`text-sm font-semibold mt-1 ${PHASE_COLORS[turn.phase] ?? 'text-white'}`}>
          {PHASE_LABELS[turn.phase] ?? turn.phase}
        </div>
      </div>

      {/* Phase dots */}
      <div className="flex justify-center gap-1.5">
        {Object.entries(PHASE_LABELS).map(([phase, label]) => (
          <div
            key={phase}
            title={label}
            className={[
              'w-2 h-2 rounded-full transition-all duration-300',
              turn.phase === phase ? 'bg-yellow-400 scale-125' : 'bg-slate-600',
            ].join(' ')}
          />
        ))}
      </div>

      {/* ── Actions ───────────────────────────────────────── */}
      {!isGameOver && isPlayerTurn && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={advancePhase}
            disabled={isAnimating}
            className="flex items-center justify-center gap-1"
          >
            <ChevronRight size={14} />
            Siguiente fase
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onEndTurn}
            disabled={isAnimating}
            className="flex items-center justify-center gap-1"
          >
            {isAnimating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <SkipForward size={14} />
            )}
            {isAnimating ? 'Girando…' : 'Finalizar turno'}
          </Button>
        </div>
      )}

      {!isGameOver && !isPlayerTurn && (
        <div className="text-center text-xs text-slate-500 italic py-2">
          {isAnimating ? (
            <span className="flex items-center justify-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              Girando tablero…
            </span>
          ) : (
            'Turno del oponente'
          )}
        </div>
      )}

      {/* ── Game over ─────────────────────────────────────── */}
      {isGameOver && (
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-sm mb-2">
            {winner === 'player' ? '¡Ganaste!' : 'Derrota'}
          </div>
          <Button variant="primary" size="sm" onClick={resetGame} fullWidth>
            <RefreshCw size={12} className="inline mr-1" />
            Nueva partida
          </Button>
        </div>
      )}

      {/* ── Game log ──────────────────────────────────────── */}
      <div className="mt-1">
        <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">
          Registro
        </div>
        <div className="space-y-0.5 max-h-[160px] overflow-y-auto scrollbar-thin">
          {gameLog.slice(0, 15).map((entry) => (
            <div
              key={entry.id}
              className={[
                'text-[10px] leading-snug',
                entry.type === 'error'  ? 'text-red-400'    : '',
                entry.type === 'system' ? 'text-blue-400'   : '',
                entry.type === 'combat' ? 'text-orange-400' : '',
                entry.type === 'action' ? 'text-slate-400'  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {entry.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
