import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Easing } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { PlayerArea } from './PlayerArea';
import { TurnPanel } from './TurnPanel';
import { Separator } from './Separator';

const EASE_IN: Easing = 'easeIn';
const EASE_OUT: Easing = 'easeOut';

/**
 * GameBoard manages the board rotation animation between turns.
 *
 * Animation sequence when "Finalizar turno" is pressed:
 *  1. Board folds away: rotateX 0→90°, opacity 1→0 (easeIn, 450ms)
 *  2. Turn state switches (players swap positions)
 *  3. Board folds in: rotateX -30→0°, opacity 0→1 (easeOut, 450ms)
 *
 * Because we always render "current player" at bottom, the content
 * swap happens naturally when the turn changes mid-animation.
 */
export function GameBoard() {
  const players = useGameStore((s) => s.players);
  const turn = useGameStore((s) => s.turn);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const winner = useGameStore((s) => s.winner);
  const { endPlayerTurn } = useGameActions();

  const [rotationPhase, setRotationPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [handoffName, setHandoffName] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleEndTurn = useCallback(async () => {
    if (isAnimating) return;

    const nextName =
      turn.currentPlayer === 'player'
        ? players.opponent.name
        : players.player.name;

    setHandoffName(nextName);
    setIsAnimating(true);
    setRotationPhase('out');

    // Wait for fold-out to finish
    await new Promise<void>((r) => setTimeout(r, 500));
    endPlayerTurn();
    setRotationPhase('in');

    // Wait for fold-in to finish
    await new Promise<void>((r) => setTimeout(r, 500));
    setRotationPhase('idle');
    setIsAnimating(false);
  }, [isAnimating, turn, players, endPlayerTurn]);

  // Compute animate target based on rotation phase
  const boardAnimate =
    rotationPhase === 'out'
      ? { rotateX: 90, scaleY: 0.6, opacity: 0,   transition: { duration: 0.45, ease: EASE_IN  } }
      : rotationPhase === 'in'
      ? { rotateX: 0,  scaleY: 1,   opacity: 1,   transition: { duration: 0.45, ease: EASE_OUT } }
      : { rotateX: 0,  scaleY: 1,   opacity: 1,   transition: { duration: 0.3,  ease: EASE_OUT } };

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-[#0a1520] flex"
      style={{ perspective: '1200px' }}
    >
      {/* Background ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 30% 50%, rgba(251,191,36,0.04) 0%, transparent 60%), ' +
            'radial-gradient(ellipse at 70% 50%, rgba(59,130,246,0.04) 0%, transparent 60%)',
        }}
      />

      {/* ── Animatable board ──────────────────────────────── */}
      <motion.div
        className="flex-1 flex flex-col gap-1 p-3 overflow-auto"
        animate={boardAnimate}
        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
      >
        {/* Opponent area (top) */}
        <div className="flex-1 opacity-90">
          <PlayerArea
            player={players.opponent}
            playerId="opponent"
            isOpponent
          />
        </div>

        <Separator />

        {/* Player area (bottom) */}
        <div className="flex-1">
          <PlayerArea player={players.player} playerId="player" />
        </div>
      </motion.div>

      {/* ── Turn handoff overlay ──────────────────────────── */}
      <AnimatePresence>
        {rotationPhase !== 'idle' && (
          <motion.div
            key="handoff"
            className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="bg-black/80 backdrop-blur-md px-10 py-6 rounded-2xl border border-yellow-500/30 shadow-2xl text-center">
              <div className="text-yellow-400 text-xs uppercase tracking-widest mb-1">
                Turno de
              </div>
              <div className="text-white text-3xl font-black">{handoffName}</div>
              <div className="text-slate-500 text-xs mt-2">Pasando el tablero…</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Side panel ───────────────────────────────────── */}
      <div className="w-52 flex-shrink-0 p-2 flex items-center">
        <TurnPanel onEndTurn={handleEndTurn} isAnimating={isAnimating} />
      </div>

      {/* ── Game over overlay ─────────────────────────────── */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div
            key="gameover"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <motion.div
                className="text-5xl font-black text-yellow-400 drop-shadow-2xl"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
              >
                {winner === 'player' ? '¡VICTORIA!' : 'DERROTA'}
              </motion.div>
              <p className="text-slate-400 mt-3 text-sm">
                {winner === 'player'
                  ? 'Has vencido al oponente'
                  : 'El oponente ha ganado la partida'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
