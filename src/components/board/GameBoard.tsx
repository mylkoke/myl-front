import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Easing } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { PlayerArea } from './PlayerArea';
import { Separator } from './Separator';
import { Button } from '@/components/ui/Button';
import { ChevronRight, SkipForward, RefreshCw, Loader2 } from 'lucide-react';

const EASE_IN: Easing  = 'easeIn';
const EASE_OUT: Easing = 'easeOut';

const PHASE_SEQUENCE = ['draw', 'main', 'combat', 'end'] as const;

export function GameBoard() {
  const players    = useGameStore((s) => s.players);
  const turn       = useGameStore((s) => s.turn);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const winner     = useGameStore((s) => s.winner);
  const gameLog    = useGameStore((s) => s.gameLog);
  const { endPlayerTurn, advancePhase, resetGame } = useGameActions();

  const [rotPhase, setRotPhase]     = useState<'idle' | 'out' | 'in'>('idle');
  const [handoffName, setHandoffName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleEndTurn = useCallback(async () => {
    if (isAnimating) return;
    const nextName = turn.currentPlayer === 'player'
      ? players.opponent.name
      : players.player.name;

    setHandoffName(nextName);
    setIsAnimating(true);
    setRotPhase('out');

    await new Promise<void>((r) => setTimeout(r, 480));
    endPlayerTurn();
    setRotPhase('in');

    await new Promise<void>((r) => setTimeout(r, 480));
    setRotPhase('idle');
    setIsAnimating(false);
  }, [isAnimating, turn, players, endPlayerTurn]);

  const boardAnimate =
    rotPhase === 'out'
      ? { rotateX: 85, scaleY: 0.55, opacity: 0,  transition: { duration: 0.45, ease: EASE_IN  } }
      : rotPhase === 'in'
      ? { rotateX: 0,  scaleY: 1,    opacity: 1,  transition: { duration: 0.45, ease: EASE_OUT } }
      : { rotateX: 0,  scaleY: 1,    opacity: 1,  transition: { duration: 0.3,  ease: EASE_OUT } };

  const isPlayerTurn = turn.currentPlayer === 'player' && !isAnimating;

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-[#080f18] flex flex-col"
      style={{ perspective: '1200px' }}
    >
      {/* ── Ambient glow ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage:
          'radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.03) 0%, transparent 65%)' }}
      />

      {/* ── Top bar: fase + controles ─────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-4 py-1.5 bg-slate-900/90 border-b border-slate-700/40 flex-shrink-0">
        {/* Left: turn info */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 text-xs">Turno {turn.turnNumber}</span>
          <span className="text-white font-semibold">{players[turn.currentPlayer].name}</span>
        </div>

        {/* Center: phase indicator */}
        <div className="flex items-center gap-1.5">
          {PHASE_SEQUENCE.map((phase) => (
            <div
              key={phase}
              className={[
                'text-[10px] px-2 py-0.5 rounded font-medium transition-all',
                turn.phase === phase
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                  : 'text-slate-600',
              ].join(' ')}
            >
              {phase === 'draw' ? 'Robar' : phase === 'main' ? 'Principal' : phase === 'combat' ? 'Combate' : 'Final'}
            </div>
          ))}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          {!isGameOver && isPlayerTurn && (
            <>
              <Button variant="secondary" size="sm" onClick={advancePhase} disabled={isAnimating}
                className="flex items-center gap-1 text-xs">
                <ChevronRight size={12} /> Fase
              </Button>
              <Button variant="primary" size="sm" onClick={handleEndTurn} disabled={isAnimating}
                className="flex items-center gap-1 text-xs">
                {isAnimating ? <Loader2 size={12} className="animate-spin" /> : <SkipForward size={12} />}
                Finalizar turno
              </Button>
            </>
          )}
          {!isGameOver && !isPlayerTurn && !isAnimating && (
            <span className="text-slate-600 text-xs italic">Turno del oponente…</span>
          )}
          {isAnimating && (
            <span className="text-slate-500 text-xs flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Girando…
            </span>
          )}
          {isGameOver && (
            <Button variant="primary" size="sm" onClick={resetGame} className="flex items-center gap-1 text-xs">
              <RefreshCw size={12} /> Nueva partida
            </Button>
          )}
        </div>
      </div>

      {/* ── Animatable board ──────────────────────────────────────────── */}
      <motion.div
        className="flex-1 flex flex-col overflow-auto"
        animate={boardAnimate}
        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
      >
        {/* Opponent (top) */}
        <div className="flex-1 p-2 opacity-85">
          <PlayerArea
            player={players.opponent}
            playerId="opponent"
            isOpponent
            currentPhase={turn.currentPlayer === 'opponent' ? turn.phase : undefined}
          />
        </div>

        <Separator />

        {/* Player (bottom) */}
        <div className="flex-1 p-2">
          <PlayerArea
            player={players.player}
            playerId="player"
            currentPhase={turn.currentPlayer === 'player' ? turn.phase : undefined}
          />
        </div>
      </motion.div>

      {/* ── Turn handoff overlay ──────────────────────────────────────── */}
      <AnimatePresence>
        {rotPhase !== 'idle' && (
          <motion.div
            key="handoff"
            className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-black/85 backdrop-blur-md px-12 py-7 rounded-2xl border border-yellow-500/30 shadow-2xl text-center">
              <div className="text-yellow-400/70 text-xs uppercase tracking-widest mb-1">Turno de</div>
              <div className="text-white text-3xl font-black">{handoffName}</div>
              <div className="text-slate-600 text-xs mt-2">Rotando el tablero…</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game log strip (bottom) ───────────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 bg-slate-950/80 border-t border-slate-800/50 px-3 py-1 flex gap-2 overflow-x-auto scrollbar-thin">
        {gameLog.slice(0, 5).map((entry) => (
          <span
            key={entry.id}
            className={[
              'text-[10px] whitespace-nowrap',
              entry.type === 'error'  ? 'text-red-400' :
              entry.type === 'system' ? 'text-blue-400' :
              entry.type === 'combat' ? 'text-orange-400' : 'text-slate-500',
            ].join(' ')}
          >
            {entry.message}
          </span>
        ))}
      </div>

      {/* ── Game over overlay ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            key="gameover"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <motion.div
                className="text-5xl font-black text-yellow-400 drop-shadow-2xl"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring' }}
              >
                {winner === 'player' ? '¡VICTORIA!' : 'DERROTA'}
              </motion.div>
              <p className="text-slate-400 mt-3 text-sm">
                {winner === 'player' ? 'Has vencido al oponente' : 'El oponente ha ganado'}
              </p>
              <Button variant="primary" size="lg" onClick={resetGame} className="mt-6">
                <RefreshCw size={16} className="inline mr-2" /> Nueva partida
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
