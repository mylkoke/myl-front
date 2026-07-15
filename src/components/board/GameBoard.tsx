import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Easing } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useGameActions } from '@/hooks/useGameActions';
import { useOnlineStore } from '@/store/onlineStore';
import { apiGameSyncService } from '@/services/api/gameSyncService';
import { PlayerArea } from './PlayerArea';
import { CardView } from '@/components/cards/CardView';
import { Separator } from './Separator';
import { Button } from '@/components/ui/Button';
import { SettingsPanel } from '@/components/ui/SettingsPanel';
import { DragGhost } from '@/components/DragGhost';
import { useSettingsStore, resolveBoardColor } from '@/store/settingsStore';
import { playDrawCardFx } from '@/utils/drawCardFx';
import { playDeckDamageFx } from '@/utils/deckDamageFx';
import { playAllyDestroyedFx } from '@/utils/allyDestroyedFx';
import { playPhaseBannerFx } from '@/utils/phaseBannerFx';
import { playAttackPulseFx } from '@/utils/attackPulseFx';
import {
  ChevronRight, SkipForward, RefreshCw, Loader2, Settings, Flag, WifiOff, Sparkles,
} from 'lucide-react';
import { APP_VERSION } from '@/version';
import { effectiveForce, hasAnnulResponse, hasImbloqueable, hasRelampago } from '@/utils/gameRules';
import { playLightningFx } from '@/utils/lightningFx';
import { useTargetingStore } from '@/store/targetingStore';
import type { PlayerId } from '@/types/game.types';

const EASE_IN: Easing  = 'easeIn';
const EASE_OUT: Easing = 'easeOut';

const PHASE_SEQUENCE = ['agrupacion', 'vigilia', 'batalla', 'final'] as const;

const PHASE_LABELS: Record<string, string> = {
  agrupacion: 'Agrupación',
  vigilia:    'Vigilia',
  batalla:    'Batalla Mitológica',
  final:      'Fase Final',
};

export function GameBoard() {
  const players    = useGameStore((s) => s.players);
  const turn       = useGameStore((s) => s.turn);
  const combat     = useGameStore((s) => s.combat);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const winner     = useGameStore((s) => s.winner);
  const gameLog    = useGameStore((s) => s.gameLog);
  const surrender = useGameStore((s) => s.surrender);
  const { endPlayerTurn, advancePhase, resetGame, defendWith, regroupGold, regroupAllies,
    passCombat, playCombatTalisman } = useGameActions();
  const weakenTargeting = useTargetingStore((s) => s.weaken);
  const destroyTargeting = useTargetingStore((s) => s.destroy);
  const cancelTargeting = useTargetingStore((s) => s.cancel);
  const pendingDiscard = useGameStore((s) => s.pendingDiscard);
  const pendingHandDiscard = useGameStore((s) => s.pendingHandDiscard);
  const pendingCopyTutor = useGameStore((s) => s.pendingCopyTutor);
  const pendingSelfSummon = useGameStore((s) => s.pendingSelfSummon);
  const responseWindow = useGameStore((s) => s.responseWindow);
  const { discardFromHand, respondWithAnnul, passResponse, closeResponseWindow, resolveShuffleChoice,
    resolveSwapChoice, resolveTypeChoice, resolvePatriotaTrigger, pickPatriotaGraveyardCard,
    discardRivalTalisman, tutorCopyFromZone, cancelCopyTutor,
    resolveSelfSummon, cancelSelfSummon, playCard: playCardAction } = useGameActions();
  const pendingSwapChoice = useGameStore((s) => s.pendingSwapChoice);
  const pendingTypeChoice = useGameStore((s) => s.pendingTypeChoice);
  const startSwap = useTargetingStore((s) => s.startSwap);
  const swapTargeting = useTargetingStore((s) => s.swap);
  const equipTargeting = useTargetingStore((s) => s.equip);
  const pendingShuffleChoice = useGameStore((s) => s.pendingShuffleChoice);
  const pendingPatriotaTrigger = useGameStore((s) => s.pendingPatriotaTrigger);

  const [rotPhase, setRotPhase]       = useState<'idle' | 'out' | 'in'>('idle');
  const [handoffName, setHandoffName]   = useState('');
  const [isAnimating, setIsAnimating]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [confirmAbandon, setConfirmAbandon]     = useState(false);
  const [confirmReset, setConfirmReset]         = useState(false);

  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const boardColor = resolveBoardColor(boardTheme);
  const boardImage = boardTheme.mode === 'image' ? boardTheme.imageUrl : null;

  const navigate = useNavigate();
  const mode          = useOnlineStore((s) => s.mode);
  const mySeat        = useOnlineStore((s) => s.mySeat);
  const gameId        = useOnlineStore((s) => s.gameId);
  const connection    = useOnlineStore((s) => s.connection);
  const opponentOnline = useOnlineStore((s) => s.opponentOnline);
  const resetOnline   = useOnlineStore((s) => s.reset);
  const isOnline = mode === 'online' && mySeat !== null;

  // FX de Relámpago: se dispara cuando una carta 'relampago' se juega fuera
  // de la Vigilia de su dueño (fxLightning cambia en el estado sincronizado).
  const fxLightning = useGameStore((s) => s.fxLightning);
  const lastLightningRef = useRef<number | null>(null);
  useEffect(() => {
    if (fxLightning && fxLightning !== lastLightningRef.current) {
      lastLightningRef.current = fxLightning;
      playLightningFx();
    }
  }, [fxLightning]);

  // Reloj de la ventana de respuesta: tick cada 250 ms mientras esté abierta;
  // al expirar la cierra el dueño de la carta jugada (o cualquiera en local).
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!responseWindow) return;
    const iv = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(iv);
  }, [responseWindow]);
  useEffect(() => {
    if (!responseWindow) return;
    if (nowTick < responseWindow.expiresAt) return;
    if (!isOnline || mySeat === responseWindow.cardOwnerId) closeResponseWindow();
  }, [nowTick, responseWindow, isOnline, mySeat, closeResponseWindow]);

  // FX de daño al mazo: se detecta por diff de estado (mazo baja Y cementerio
  // sube a la vez), así funciona en local y en AMBOS dispositivos online
  // (el remoto solo recibe el estado hidratado, no eventos).
  const zoneCountsRef = useRef<Record<PlayerId, { deck: number; grave: number }> | null>(null);
  useEffect(() => {
    const prev = zoneCountsRef.current;
    const next = {
      player:   { deck: players.player.deck.length,   grave: players.player.graveyard.length },
      opponent: { deck: players.opponent.deck.length, grave: players.opponent.graveyard.length },
    };
    if (prev) {
      (['player', 'opponent'] as PlayerId[]).forEach((pid) => {
        const deckDrop = prev[pid].deck - next[pid].deck;
        const graveRise = next[pid].grave - prev[pid].grave;
        // deckDrop>0 + graveRise>0 = daño de combate (robar no toca cementerio).
        const damage = Math.min(deckDrop, graveRise);
        if (damage > 0) playDeckDamageFx(pid, damage);
      });
    }
    zoneCountsRef.current = next;
  }, [players]);

  // FX de aliado destruido: un instanceId que estaba en campo (defensa o
  // ataque) desaparece de ambas líneas → su carta se quiebra y cae al
  // cementerio. Los rects se capturan en el render ANTERIOR (React ya
  // desmontó el slot cuando corre este efecto).
  const fieldIdsRef = useRef<Record<PlayerId, Set<string>> | null>(null);
  const fieldRectsRef = useRef<Map<string, DOMRect>>(new Map());
  useEffect(() => {
    const prev = fieldIdsRef.current;
    const next: Record<PlayerId, Set<string>> = {
      player: new Set([...players.player.defenseField, ...players.player.attackField].map((c) => c.instanceId)),
      opponent: new Set([...players.opponent.defenseField, ...players.opponent.attackField].map((c) => c.instanceId)),
    };
    if (prev) {
      (['player', 'opponent'] as PlayerId[]).forEach((pid) => {
        prev[pid].forEach((id) => {
          if (next[pid].has(id)) return;
          const rect = fieldRectsRef.current.get(id);
          if (rect) playAllyDestroyedFx(rect, pid);
        });
      });
    }
    fieldIdsRef.current = next;
    // Re-captura los rects de las cartas que siguen en campo para el próximo diff.
    fieldRectsRef.current = new Map(
      Array.from(document.querySelectorAll<HTMLElement>('[data-fx-instance]')).map((el) => [
        el.dataset.fxInstance!,
        el.getBoundingClientRect(),
      ]),
    );
  }, [players]);

  // Banner animado al cambiar de fase (se omite el primer render).
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevPhaseRef.current && prevPhaseRef.current !== turn.phase) {
      playPhaseBannerFx(turn.phase, PHASE_LABELS[turn.phase] ?? turn.phase);
    }
    prevPhaseRef.current = turn.phase;
  }, [turn.phase]);

  // Pulso de onda roja sobre el aliado que acaba de declarar un ataque.
  const prevAttackerRef = useRef<string | null>(null);
  useEffect(() => {
    const attacker = combat?.attackerInstanceId ?? null;
    if (attacker && attacker !== prevAttackerRef.current) playAttackPulseFx(attacker);
    prevAttackerRef.current = attacker;
  }, [combat?.attackerInstanceId]);

  const leaveOnlineGame = () => {
    apiGameSyncService.disconnect();
    resetOnline();
    navigate('/');
  };

  const handleEndTurn = useCallback(async () => {
    if (isAnimating) return;
    const currentId = turn.currentPlayer;
    // La carta que se robará al finalizar (drawCards toma deck[0]): se anticipa
    // para animar la "mano" tomándola del mazo ANTES de la mutación del estado.
    const topDeckCard = combat ? undefined : players[currentId].deck[0];

    // Online: each device keeps its own perspective — no board rotation.
    if (isOnline) {
      setIsAnimating(true);
      if (topDeckCard) await playDrawCardFx(currentId, topDeckCard.nombre);
      endPlayerTurn();
      setIsAnimating(false);
      return;
    }
    const nextName = turn.currentPlayer === 'player'
      ? players.opponent.name
      : players.player.name;

    setHandoffName(nextName);
    setIsAnimating(true);

    // 1. Robo animado: la mano toma la carta del Mazo Castillo → mano del jugador.
    if (topDeckCard) await playDrawCardFx(currentId, topDeckCard.nombre);

    // 2. Rotación 3D de traspaso de turno.
    setRotPhase('out');
    await new Promise<void>((r) => setTimeout(r, 480));
    endPlayerTurn();
    setRotPhase('in');

    await new Promise<void>((r) => setTimeout(r, 480));
    setRotPhase('idle');
    setIsAnimating(false);
  }, [isOnline, isAnimating, turn, players, combat, endPlayerTurn]);

  const boardAnimate =
    rotPhase === 'out'
      ? { rotateX: 85, scaleY: 0.55, opacity: 0,  transition: { duration: 0.45, ease: EASE_IN  } }
      : rotPhase === 'in'
      ? { rotateX: 0,  scaleY: 1,    opacity: 1,  transition: { duration: 0.45, ease: EASE_OUT } }
      : { rotateX: 0,  scaleY: 1,    opacity: 1,  transition: { duration: 0.3,  ease: EASE_OUT } };

  // Local: el jugador activo siempre abajo (hot-seat con rotación).
  // Online: MI lado siempre abajo, gane o no el turno.
  const bottomId: PlayerId = isOnline ? mySeat! : turn.currentPlayer;
  const topId: PlayerId    = bottomId === 'player' ? 'opponent' : 'player';
  const isMyTurnOnline = isOnline && turn.currentPlayer === mySeat;
  const canAct = !isGameOver && (isOnline ? isMyTurnOnline : !isAnimating);

  const activePlayer = players[isOnline ? mySeat! : turn.currentPlayer];
  const hasGoldToRegroup  = canAct && turn.phase === 'agrupacion' && (activePlayer?.goldPaid.length ?? 0) > 0 && !activePlayer?.goldSpentThisTurn;
  const hasAlliesToRegroup = canAct && turn.phase === 'agrupacion' && (activePlayer?.attackField.length ?? 0) > 0;

  return (
    <div
      className="relative w-full h-screen overflow-hidden flex flex-col"
      style={{
        perspective: '1200px',
        backgroundColor: boardColor,
        backgroundImage: boardImage ? `url(${boardImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ── Image overlay for readability ────────────────────────────── */}
      {boardImage && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `rgba(0,0,0,${boardTheme.overlayOpacity})` }}
        />
      )}

      {/* ── Ambient glow ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage:
          'radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.03) 0%, transparent 65%)' }}
      />

      {/* ── Top bar: fase + controles ─────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-2 sm:px-4 py-1.5 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/40 flex-shrink-0 gap-2">
        {/* Left: turn info */}
        <div className="flex items-center gap-2 text-sm flex-shrink-0">
          <span className="text-slate-500 text-xs hidden sm:inline">Turno {turn.turnNumber}</span>
          <span className="text-white font-semibold text-xs sm:text-sm">{players[turn.currentPlayer].name}</span>
          {/* Fase actual — versión compacta para móvil (el indicador completo es md+) */}
          <span className="md:hidden text-[9px] font-bold px-1.5 py-0.5 rounded border bg-yellow-500/15 text-yellow-300 border-yellow-500/40 whitespace-nowrap">
            {PHASE_LABELS[turn.phase] ?? turn.phase}
          </span>
          {isOnline && (
            <span
              className={[
                'text-[9px] uppercase tracking-wider rounded-full px-1.5 py-0.5 border',
                isMyTurnOnline
                  ? 'text-green-400 border-green-500/40 bg-green-500/10'
                  : 'text-slate-400 border-slate-600/50',
              ].join(' ')}
            >
              {isMyTurnOnline ? 'Tu turno' : 'Turno rival'}
            </span>
          )}
          {isOnline && connection !== 'connected' && (
            <span className="flex items-center gap-1 text-[9px] text-orange-400">
              <WifiOff size={10} /> reconectando…
            </span>
          )}
          {isOnline && connection === 'connected' && !opponentOnline && (
            <span className="text-[9px] text-orange-400 hidden sm:inline">rival desconectado</span>
          )}
        </div>

        {/* Center: phase indicator — oculto en pantallas pequeñas */}
        <div className="hidden md:flex items-center gap-1.5">
          {PHASE_SEQUENCE.map((phase) => (
            <div
              key={phase}
              className={[
                'text-[10px] px-2 py-0.5 rounded font-medium transition-all',
                turn.phase === phase
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-[0_0_8px_rgba(251,191,36,0.25)]'
                  : 'text-slate-600',
              ].join(' ')}
            >
              {PHASE_LABELS[phase] ?? phase}
            </div>
          ))}
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {hasGoldToRegroup && (
            <Button variant="secondary" size="sm"
              onClick={() => regroupGold(isOnline ? mySeat! : turn.currentPlayer)}
              className="flex items-center gap-1 text-xs border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
              title={`Reagrupar ${activePlayer.goldPaid.length} oro(s) pagado(s)`}
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Reagrupar Oro</span>
              <span className="text-[9px] bg-yellow-500/20 rounded px-1">{activePlayer.goldPaid.length}</span>
            </Button>
          )}
          {hasAlliesToRegroup && (
            <Button variant="secondary" size="sm"
              onClick={() => regroupAllies(isOnline ? mySeat! : turn.currentPlayer)}
              className="flex items-center gap-1 text-xs border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
              title={`Reagrupar ${activePlayer.attackField.length} aliado(s) de la línea de ataque`}
            >
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Reagrupar Aliados</span>
              <span className="text-[9px] bg-blue-500/20 rounded px-1">{activePlayer.attackField.length}</span>
            </Button>
          )}
          {canAct && (
            <>
              <Button variant="secondary" size="sm" onClick={advancePhase}
                className="flex items-center gap-1 text-xs">
                <ChevronRight size={12} />
                <span className="hidden sm:inline">Fase</span>
              </Button>
              <Button variant="primary" size="sm" onClick={handleEndTurn}
                className="flex items-center gap-1 text-xs">
                <SkipForward size={12} />
                <span className="hidden sm:inline">Finalizar turno</span>
              </Button>
            </>
          )}
          {isAnimating && (
            <span className="text-slate-500 text-xs flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              <span className="hidden sm:inline">Girando…</span>
            </span>
          )}
          {isGameOver && !isOnline && (
            <Button variant="primary" size="sm" onClick={resetGame} className="flex items-center gap-1 text-xs">
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Nueva partida</span>
            </Button>
          )}
          {/* Rendirse — local: visible siempre que la partida esté activa */}
          {!isOnline && !isGameOver && (
            confirmSurrender ? (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 hidden sm:inline">¿Rendirse?</span>
                <Button variant="danger" size="sm"
                  onClick={() => { surrender(bottomId); setConfirmSurrender(false); }}
                  className="text-xs px-2">Sí</Button>
                <Button variant="secondary" size="sm"
                  onClick={() => setConfirmSurrender(false)}
                  className="text-xs px-2">No</Button>
              </div>
            ) : (
              <Button variant="danger" size="sm"
                onClick={() => setConfirmSurrender(true)}
                className="flex items-center gap-1 text-xs">
                <Flag size={12} />
                <span className="hidden sm:inline">Rendirse</span>
              </Button>
            )
          )}
          {/* Abandonar — online (desktop; en móvil vive en el menú del engranaje) */}
          {isOnline && !isGameOver && (
            confirmAbandon ? (
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-[10px] text-slate-400 hidden sm:inline">¿Abandonar?</span>
                <Button variant="danger" size="sm"
                  onClick={() => { if (gameId) apiGameSyncService.abandon(gameId); setConfirmAbandon(false); }}
                  className="text-xs px-2">Sí</Button>
                <Button variant="secondary" size="sm"
                  onClick={() => setConfirmAbandon(false)}
                  className="text-xs px-2">No</Button>
              </div>
            ) : (
              <Button variant="danger" size="sm"
                onClick={() => setConfirmAbandon(true)}
                className="hidden sm:flex items-center gap-1 text-xs">
                <Flag size={12} />
                <span className="hidden sm:inline">Abandonar</span>
              </Button>
            )
          )}
          {/* Reiniciar partida (desktop; en móvil vive en el menú del engranaje) */}
          {confirmReset ? (
            <div className="hidden sm:flex items-center gap-1">
              <span className="text-[10px] text-slate-400 hidden sm:inline">¿Reiniciar?</span>
              <Button variant="danger" size="sm"
                onClick={() => { resetGame(); setConfirmReset(false); }}
                className="text-xs px-2">Sí</Button>
              <Button variant="secondary" size="sm"
                onClick={() => setConfirmReset(false)}
                className="text-xs px-2">No</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm"
              onClick={() => setConfirmReset(true)}
              className="hidden sm:flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              title="Reiniciar partida">
              <RefreshCw size={12} />
              <span className="hidden sm:inline">Reiniciar</span>
            </Button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Personalizar campo"
            className="text-slate-500 hover:text-yellow-400 transition-colors p-1"
          >
            <Settings size={14} />
          </button>
          <span className="text-[9px] text-slate-600 font-mono select-none hidden sm:inline ml-1">
            v{APP_VERSION}
          </span>
        </div>
      </div>

      {/* ── Animatable board ──────────────────────────────────────────── */}
      <motion.div
        className="flex-1 flex flex-col overflow-auto"
        animate={boardAnimate}
        style={{ transformOrigin: 'center center', transformStyle: 'preserve-3d' }}
      >
        {/* Rival / jugador en espera (arriba) — cartas boca abajo */}
        <div className="flex-1 p-2 opacity-60 saturate-75 transition-all duration-300">
          <PlayerArea
            player={players[topId]}
            playerId={topId}
            isOpponent
            currentPhase={undefined}
          />
        </div>

        <Separator />

        {/* Mi lado (abajo) */}
        <div
          className={[
            'flex-1 p-2 rounded-xl transition-all duration-300',
            canAct ? 'ring-1 ring-yellow-500/10' : '',
          ].join(' ')}
        >
          <PlayerArea
            player={players[bottomId]}
            playerId={bottomId}
            currentPhase={turn.phase}
          />
        </div>
      </motion.div>

      {/* ── Ventana de respuesta: el rival puede anular la carta jugada ── */}
      {responseWindow && (() => {
        const secondsLeft = Math.max(0, Math.ceil((responseWindow.expiresAt - nowTick) / 1000));
        const responder = players[responseWindow.responderId];
        const isMyResponse = !isOnline || mySeat === responseWindow.responderId;
        const effect = responseWindow.effect;
        if (!isMyResponse) {
          return (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-purple-500/40 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
              <Loader2 size={13} className="animate-spin text-purple-400" />
              <span className="text-xs text-slate-300">
                {effect
                  ? `${responder.name} puede responder al efecto de ${responseWindow.cardName}… (${secondsLeft}s)`
                  : `${responder.name} puede responder a ${responseWindow.cardName}… (${secondsLeft}s)`}
              </span>
            </div>
          );
        }
        // Respuestas jugables: talismanes de anulación (ventana de carta) y,
        // en ventanas de efecto, también cartas a velocidad de respuesta.
        const responses = responder.hand.filter(
          (c) =>
            (hasAnnulResponse(c) ||
              (effect && (hasRelampago(c) || (c.tipo === 'talisman' && c.habilidadesEspeciales?.includes('instantaneo'))))) &&
            c.coste <= responder.goldCount + responder.talismanGold,
        );
        return (
          <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center p-3 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-slate-900/95 border border-purple-500/50 rounded-2xl p-3 sm:p-4 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-purple-300 text-[10px] uppercase tracking-widest font-bold">
                    Ventana de respuesta — {secondsLeft}s
                  </div>
                  <p className="text-slate-300 text-xs mt-0.5">
                    {effect ? (
                      <>
                        Efecto de <b>{responseWindow.cardName}</b>: botarás{' '}
                        <b>{effect.amount}</b> cartas si no respondes
                      </>
                    ) : (
                      <>
                        {responder.name}: puedes responder a <b>{responseWindow.cardName}</b>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => passResponse(responseWindow.responderId)}
                >
                  No responder
                </Button>
              </div>
              {responses.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {responses.map((c) => (
                    <CardView
                      key={c.instanceId}
                      card={c}
                      size="sm"
                      onClick={() =>
                        hasAnnulResponse(c)
                          ? respondWithAnnul(c.instanceId, responseWindow.responderId)
                          : playCardAction(c, responseWindow.responderId)
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 text-center">
                  No tienes cartas de respuesta jugables.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Decisión de 'nombrar_tipo_sobrecoste' (Plaza de Armas SP) ──── */}
      {pendingTypeChoice && (!isOnline || mySeat === pendingTypeChoice.playerId) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-center">
            <div className="text-emerald-300 text-xs uppercase tracking-widest font-bold">
              {pendingTypeChoice.cardName}
            </div>
            <p className="text-slate-300 text-sm mt-2 mb-4">
              Nombra un tipo de carta: costarán <b>+2 Oros</b> mientras este
              tótem esté en la línea de apoyo.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['aliado', 'arma', 'totem', 'talisman'] as const).map((t) => (
                <Button
                  key={t}
                  variant="secondary"
                  fullWidth
                  onClick={() => resolveTypeChoice(t, pendingTypeChoice.playerId)}
                  className="capitalize"
                >
                  {t === 'talisman' ? 'Talismán' : t === 'totem' ? 'Tótem' : t}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Decisión de 'intercambio_control' (Arturo Prat SP) ─────────── */}
      {pendingSwapChoice && (!isOnline || mySeat === pendingSwapChoice.playerId) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-yellow-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-center">
            <div className="text-yellow-300 text-xs uppercase tracking-widest font-bold">
              {pendingSwapChoice.cardName}
            </div>
            <p className="text-slate-300 text-sm mt-2 mb-4">
              ¿Intercambiar el control de esta carta por el de una carta rival
              (que no sea Oro), por el resto de la partida?
            </p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  startSwap(pendingSwapChoice.cardInstanceId, pendingSwapChoice.playerId);
                  resolveSwapChoice(true, pendingSwapChoice.playerId);
                }}
              >
                Sí, elegir carta
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => resolveSwapChoice(false, pendingSwapChoice.playerId)}
              >
                No usar el efecto
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Targeting banner: eligiendo portador para arma desde zona ──── */}
      {equipTargeting && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-yellow-500/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl">
          <span className="text-xs text-yellow-300 font-bold">
            Elige un aliado tuyo como portador del arma
          </span>
          <button
            onClick={cancelTargeting}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Targeting banner: eligiendo carta para intercambio de control ── */}
      {swapTargeting && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-yellow-500/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl">
          <span className="text-xs text-yellow-300 font-bold">
            Elige una carta rival (no Oro): intercambio de control permanente
          </span>
          <button
            onClick={cancelTargeting}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Trigger 'trigger_patriota_roba_baraja' (Arturo Prat) ───────── */}
      {pendingPatriotaTrigger && (!isOnline || mySeat === pendingPatriotaTrigger.playerId) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          {pendingPatriotaTrigger.step === 'confirm' ? (
            <div className="w-full max-w-sm bg-slate-900 border border-sky-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-center">
              <div className="text-sky-300 text-xs uppercase tracking-widest font-bold">
                {pendingPatriotaTrigger.sourceName}
              </div>
              <p className="text-slate-300 text-sm mt-2 mb-4">
                Entró un Aliado Patriota. ¿Robar 1 carta del Castillo y barajar
                una carta del Cementerio de vuelta en él?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => resolvePatriotaTrigger(true, pendingPatriotaTrigger.playerId)}
                >
                  Sí, usar el efecto
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => resolvePatriotaTrigger(false, pendingPatriotaTrigger.playerId)}
                >
                  No
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-md bg-slate-900 border border-sky-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl">
              <div className="text-center mb-3">
                <div className="text-sky-300 text-xs uppercase tracking-widest font-bold">
                  {pendingPatriotaTrigger.sourceName}
                </div>
                <p className="text-slate-300 text-sm mt-1">
                  Elige una carta del Cementerio para barajar en tu Castillo.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-h-64 overflow-y-auto">
                {players[pendingPatriotaTrigger.playerId].graveyard.map((card) => (
                  <CardView
                    key={card.instanceId}
                    card={card}
                    size="sm"
                    onClick={() =>
                      pickPatriotaGraveyardCard(card.instanceId, pendingPatriotaTrigger.playerId)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Decisión de 'barajar_mano_roba8' (Manuel Rodríguez) ────────── */}
      {pendingShuffleChoice && (!isOnline || mySeat === pendingShuffleChoice.playerId) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-blue-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-center">
            <div className="text-blue-300 text-xs uppercase tracking-widest font-bold">
              {pendingShuffleChoice.cardName}
            </div>
            <p className="text-slate-300 text-sm mt-2 mb-4">
              ¿Barajar tu mano en tu Mazo Castillo y robar 8 cartas nuevas?
            </p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                fullWidth
                onClick={() => resolveShuffleChoice(true, pendingShuffleChoice.playerId)}
              >
                Sí, barajar y robar 8
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => resolveShuffleChoice(false, pendingShuffleChoice.playerId)}
              >
                Conservar mi mano
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── San Martín: jugar una copia propia desde el Castillo gratis ── */}
      {pendingSelfSummon && (!isOnline || mySeat === pendingSelfSummon.playerId) && (() => {
        const p = players[pendingSelfSummon.playerId];
        const copies = p.deck
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.id === pendingSelfSummon.cardId);
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
            <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl">
              <div className="text-center mb-3">
                <div className="text-emerald-300 text-xs uppercase tracking-widest font-bold">
                  {pendingSelfSummon.cardName}
                </div>
                <p className="text-slate-300 text-sm mt-1">
                  Puedes jugar una copia desde tu Castillo sin pagar su coste.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-h-64 overflow-y-auto mb-3">
                {copies.map(({ c, i }) => (
                  <CardView
                    key={`self-${i}`}
                    card={{ ...c, instanceId: `self-${i}`, tapped: false, attackedThisTurn: false, summonedThisTurn: false }}
                    size="sm"
                    onClick={() => resolveSelfSummon(i, pendingSelfSummon.playerId)}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => cancelSelfSummon(pendingSelfSummon.playerId)}
              >
                No invocar
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ── Escudo Nacional Mercenario: buscar una copia propia ────────── */}
      {pendingCopyTutor && (!isOnline || mySeat === pendingCopyTutor.playerId) && (() => {
        const p = players[pendingCopyTutor.playerId];
        const deckCopies = p.deck
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.id === pendingCopyTutor.cardId);
        const graveCopies = p.graveyard.filter((c) => c.id === pendingCopyTutor.cardId);
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
            <div className="w-full max-w-md bg-slate-900 border border-yellow-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl">
              <div className="text-center mb-3">
                <div className="text-yellow-300 text-xs uppercase tracking-widest font-bold">
                  {pendingCopyTutor.cardName}
                </div>
                <p className="text-slate-300 text-sm mt-1">
                  Busca una copia en tu Castillo o Cementerio y ponla en tu mano
                  (elige solo una).
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-h-64 overflow-y-auto mb-3">
                {deckCopies.map(({ c, i }) => (
                  <div key={`deck-${i}`} className="relative">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 bg-slate-700 text-cyan-300 text-[7px] font-bold px-1 rounded-full whitespace-nowrap">
                      Castillo
                    </span>
                    <CardView
                      card={{ ...c, instanceId: `copy-deck-${i}`, tapped: false, attackedThisTurn: false, summonedThisTurn: false }}
                      size="sm"
                      onClick={() => tutorCopyFromZone('deck', i, pendingCopyTutor.playerId)}
                    />
                  </div>
                ))}
                {graveCopies.map((c) => (
                  <div key={c.instanceId} className="relative">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 bg-slate-700 text-slate-300 text-[7px] font-bold px-1 rounded-full whitespace-nowrap">
                      Cementerio
                    </span>
                    <CardView
                      card={c}
                      size="sm"
                      onClick={() => tutorCopyFromZone('graveyard', c.instanceId, pendingCopyTutor.playerId)}
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => cancelCopyTutor(pendingCopyTutor.playerId)}
              >
                No buscar
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ── Aurora de Chile: descartar un Talismán de la mano rival ────── */}
      {pendingHandDiscard && (!isOnline || mySeat === pendingHandDiscard.viewerId) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="text-center mb-3">
              <div className="text-purple-300 text-xs uppercase tracking-widest font-bold">
                {pendingHandDiscard.sourceName}
              </div>
              <p className="text-slate-300 text-sm mt-1">
                Mira la mano de {players[pendingHandDiscard.targetId].name} y elige
                un Talismán para descartarlo.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-h-64 overflow-y-auto">
              {players[pendingHandDiscard.targetId].hand
                .filter((c) => c.tipo === 'talisman')
                .map((card) => (
                  <CardView
                    key={card.instanceId}
                    card={card}
                    size="sm"
                    onClick={() => discardRivalTalisman(card.instanceId, pendingHandDiscard.viewerId)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Descarte obligatorio ('oro_robar_descartar') ──────────────── */}
      {pendingDiscard && (!isOnline || mySeat === pendingDiscard) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3">
          <div className="w-full max-w-md bg-slate-900 border border-yellow-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl">
            <div className="text-center mb-3">
              <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold">
                Descarte obligatorio
              </div>
              <p className="text-slate-300 text-xs mt-1">
                Elige una carta de tu mano para enviarla al Cementerio.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-h-64 overflow-y-auto">
              {players[pendingDiscard].hand.map((card) => (
                <CardView
                  key={card.instanceId}
                  card={card}
                  size="sm"
                  onClick={() => discardFromHand(card.instanceId, pendingDiscard)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Esperando el descarte del rival (online) ───────────────────── */}
      {pendingDiscard && isOnline && mySeat !== pendingDiscard && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-yellow-500/40 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl">
          <Loader2 size={13} className="animate-spin text-yellow-400" />
          <span className="text-xs text-slate-300">
            {players[pendingDiscard].name} está descartando una carta…
          </span>
        </div>
      )}

      {/* ── Targeting banner: eligiendo objetivo (debilitar / destruir) ── */}
      {(weakenTargeting || destroyTargeting) && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-red-500/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl">
          <span className="text-xs text-red-300 font-bold">
            {weakenTargeting
              ? 'Elige un aliado: tendrá Fuerza 0 hasta la Fase Final'
              : 'Elige un aliado: será destruido (botas 3 cartas de tu Castillo)'}
          </span>
          <button
            onClick={cancelTargeting}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Defense panel: shown while a combat awaits the defender ────── */}
      <AnimatePresence>
        {combat && !isGameOver && (() => {
          const defenderId: PlayerId = combat.attackerId === 'player' ? 'opponent' : 'player';
          const attackerPlayer = players[combat.attackerId];
          const defenderPlayer = players[defenderId];
          const attacker = attackerPlayer.attackField.find(
            (c) => c.instanceId === combat.attackerInstanceId
          );
          if (!attacker) return null;
          const atkForce = effectiveForce(attacker, attackerPlayer, players);

          // ── Sub-fase: Guerra de Talismanes ──────────────────────────────
          if (combat.status === 'talisman_war') {
            const activeId = combat.activePlayer;
            const activePlayer = players[activeId];
            const talismanes = activePlayer.hand.filter((c) => c.tipo === 'talisman');

            // Online: solo el jugador activo ve el panel; el otro espera.
            if (isOnline && activeId !== mySeat) {
              return (
                <motion.div
                  key="war-wait"
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-purple-500/40 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader2 size={13} className="animate-spin text-purple-400" />
                  <span className="text-xs text-slate-300">
                    Guerra de Talismanes: turno de {activePlayer.name}…
                  </span>
                </motion.div>
              );
            }

            return (
              <motion.div
                key="talisman-war"
                className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="w-full max-w-md bg-slate-900 border border-purple-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl"
                >
                  <div className="text-center mb-4">
                    <div className="text-purple-300 text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-1.5">
                      <Sparkles size={13} /> Guerra de Talismanes
                    </div>
                    <div className="text-white text-lg font-black mt-1">
                      Turno de {activePlayer.name}
                    </div>
                    <p className="text-slate-400 text-xs mt-1">
                      Juega un talismán o pasa. La sub-fase termina cuando ambos pasan seguidos.
                    </p>
                  </div>

                  {talismanes.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-2 mb-4 max-h-48 overflow-y-auto">
                      {talismanes.map((tal) => {
                        const affordable = tal.coste <= activePlayer.goldCount;
                        return (
                          <button
                            key={tal.instanceId}
                            disabled={!affordable}
                            onClick={() => playCombatTalisman(tal, activeId)}
                            className={[
                              'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[72px]',
                              affordable
                                ? 'border-slate-700 bg-slate-800/60 hover:border-purple-400 hover:bg-purple-500/10 active:scale-95'
                                : 'border-slate-800 bg-slate-900/60 opacity-40 cursor-not-allowed',
                            ].join(' ')}
                          >
                            <span className="text-xs text-white font-bold text-center leading-tight line-clamp-2 max-w-[80px]">
                              {tal.nombre}
                            </span>
                            <span className="text-[10px] text-yellow-400 font-black">
                              {tal.coste} ◉
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 text-xs mb-4">
                      {activePlayer.name} no tiene talismanes en la mano.
                    </p>
                  )}

                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => passCombat(activeId)}
                    className="text-sm"
                  >
                    Pasar{combat.consecutivePasses === 1 ? ' (ambos pasan → asignar daño)' : ''}
                  </Button>
                </motion.div>
              </motion.div>
            );
          }

          // Online: el panel de defensa solo aparece en el dispositivo del
          // defensor; el atacante ve un aviso de espera.
          if (isOnline && defenderId !== mySeat) {
            return (
              <motion.div
                key="defense-wait"
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-red-500/40 rounded-full px-4 py-2 flex items-center gap-2 shadow-xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Loader2 size={13} className="animate-spin text-red-400" />
                <span className="text-xs text-slate-300">
                  {defenderPlayer.name} decide si defiende…
                </span>
              </motion.div>
            );
          }

          return (
            <motion.div
              key="defense"
              className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl p-4 sm:p-6 shadow-2xl"
              >
                <div className="text-center mb-4">
                  <div className="text-red-400 text-xs uppercase tracking-widest font-bold">
                    ¡{defenderPlayer.name}, te atacan!
                  </div>
                  <div className="text-white text-lg font-black mt-1">
                    {attacker.nombre} — {atkForce} ⚔
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    {hasImbloqueable(attacker)
                      ? `${attacker.nombre} es Imbloqueable: no puedes declararle bloqueador.`
                      : `Elige un aliado para defender o recibe ${atkForce} carta(s) de daño en tu Mazo Castillo.`}
                  </p>
                </div>

                {!hasImbloqueable(attacker) && defenderPlayer.defenseField.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-4 max-h-48 overflow-y-auto">
                    {defenderPlayer.defenseField.map((ally) => {
                      const force = effectiveForce(ally, defenderPlayer, players);
                      return (
                        <button
                          key={ally.instanceId}
                          onClick={() => defendWith(ally.instanceId, defenderId)}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all min-w-[72px]"
                        >
                          <span className="text-xs text-white font-bold text-center leading-tight line-clamp-2 max-w-[80px]">
                            {ally.nombre}
                          </span>
                          <span
                            className={[
                              'text-sm font-black',
                              force > atkForce
                                ? 'text-green-400'
                                : force === atkForce
                                ? 'text-yellow-400'
                                : 'text-red-400',
                            ].join(' ')}
                          >
                            {force} ⚔
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Bloqueador sorpresa: aliados 'relampago' jugables desde la
                    mano en pleno combate (pagan su coste normal) */}
                {(!isOnline || mySeat === defenderId) &&
                  (() => {
                    const flashAllies = defenderPlayer.hand.filter(
                      (c) =>
                        c.tipo === 'aliado' &&
                        hasRelampago(c) &&
                        c.coste <= defenderPlayer.goldCount,
                    );
                    if (flashAllies.length === 0) return null;
                    return (
                      <div className="mb-3">
                        <p className="text-[10px] uppercase tracking-wide text-blue-300 font-bold mb-1.5 text-center">
                          ⚡ Relámpago: puedes bajar un aliado ahora
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {flashAllies.map((c) => (
                            <CardView
                              key={c.instanceId}
                              card={c}
                              size="sm"
                              onClick={() => playCardAction(c, defenderId)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => defendWith(null, defenderId)}
                  className="text-sm"
                >
                  No defender (−{Math.min(atkForce, defenderPlayer.deck.length)} cartas del mazo)
                </Button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

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
        {gameLog.slice(0, 5).map((entry, idx) => (
          <span
            key={entry.id}
            className={[
              'text-[10px] whitespace-nowrap',
              idx > 0 ? 'opacity-50' : '',
              entry.type === 'error'  ? 'text-red-400' :
              entry.type === 'system' ? 'text-blue-400' :
              entry.type === 'combat' ? 'text-orange-400' : 'text-slate-400',
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
              {(() => {
                const iWon = isOnline ? winner === mySeat : winner === 'player';
                return (
                  <>
                    <motion.div
                      className="text-5xl font-black text-yellow-400 drop-shadow-2xl"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.15, type: 'spring' }}
                    >
                      {iWon ? '¡VICTORIA!' : 'DERROTA'}
                    </motion.div>
                    <p className="text-slate-400 mt-3 text-sm">
                      {iWon ? 'Has vencido al oponente' : 'El oponente ha ganado'}
                    </p>
                    {isOnline ? (
                      <Button variant="primary" size="lg" onClick={leaveOnlineGame} className="mt-6">
                        Volver al lobby
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                        <Button variant="secondary" size="lg" onClick={() => navigate('/')}>
                          Menú principal
                        </Button>
                        <Button variant="primary" size="lg" onClick={resetGame}>
                          <RefreshCw size={16} className="inline mr-2" /> Nueva partida
                        </Button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Settings panel ────────────────────────────────────────────── */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onResetGame={resetGame}
        onAbandonGame={
          isOnline && !isGameOver && gameId
            ? () => apiGameSyncService.abandon(gameId)
            : undefined
        }
      />

      {/* ── Drag ghost (pointer drag & drop, mouse + touch) ───────────── */}
      <DragGhost />
    </div>
  );
}
