import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Copy, Wifi, WifiOff } from 'lucide-react';
import { GameBoard } from '@/components/board/GameBoard';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/store/gameStore';
import { useOnlineStore, getStoredOnlineGame } from '@/store/onlineStore';
import { useGameSync } from '@/hooks/useGameSync';
import { getServices } from '@/services';
import { apiGameSyncService } from '@/services/api/gameSyncService';

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0a1520] flex items-center justify-center">
      <Loader2 size={32} className="text-yellow-500 animate-spin" />
    </div>
  );
}

/** Waiting room: big code + connection status (mobile-first). */
function RoomWaiting({ roomCode }: { roomCode: string }) {
  const navigate = useNavigate();
  const connection = useOnlineStore((s) => s.connection);
  const reset = useOnlineStore((s) => s.reset);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="min-h-screen bg-[#0a1520] flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center">
        <p className="text-slate-400 text-sm mb-2">Comparte este código con tu rival</p>
        <button
          onClick={copy}
          className="flex items-center gap-3 bg-slate-900 border border-yellow-500/40 rounded-2xl px-6 py-4 hover:border-yellow-400 transition-colors"
        >
          <span className="text-4xl sm:text-5xl font-black tracking-[0.3em] text-yellow-400">
            {roomCode}
          </span>
          <Copy size={20} className="text-slate-500" />
        </button>
        {copied && <p className="text-green-400 text-xs mt-2">¡Copiado!</p>}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={16} className="animate-spin text-yellow-500" />
        Esperando rival…
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        {connection === 'connected' ? (
          <><Wifi size={12} className="text-green-500" /><span className="text-green-500">Conectado</span></>
        ) : (
          <><WifiOff size={12} className="text-orange-400" /><span className="text-orange-400">Conectando…</span></>
        )}
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          apiGameSyncService.disconnect();
          reset();
          navigate('/');
        }}
      >
        Cancelar sala
      </Button>
    </div>
  );
}

export function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const initGame = useGameStore((s) => s.initGame);
  const online = useOnlineStore();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Online setup ──
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    const setup = async () => {
      const store = useOnlineStore.getState();
      // Came from the lobby with the session already started.
      if (store.mode === 'online' && store.roomCode === roomCode && store.gameId) {
        setReady(true);
        return;
      }
      // Page reload mid-game.
      const stored = getStoredOnlineGame();
      if (stored?.roomCode === roomCode) {
        store.startOnline(stored);
        if (!cancelled) setReady(true);
        return;
      }
      // Direct URL: join (also covers rejoining an ongoing game).
      try {
        const res = await apiGameSyncService.joinRoom(roomCode);
        store.startOnline({ gameId: res.gameId, roomCode, mySeat: res.seat });
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudo entrar a la sala');
      }
    };
    void setup();

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  // ── Local setup ──
  useEffect(() => {
    if (roomCode) return;
    let cancelled = false;
    useOnlineStore.getState().reset();
    getServices()
      .decks.getActiveDeckCards()
      .then((deck) => {
        if (!cancelled) initGame(deck.length > 0 ? deck : undefined);
      })
      .catch(() => {
        if (!cancelled) initGame();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initGame, roomCode]);

  // Realtime subscription (no-op while gameId is null).
  useGameSync(roomCode && ready ? online.gameId : null);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a1520] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400 text-sm text-center">{error}</p>
        <Button variant="secondary" onClick={() => navigate('/')}>Volver al lobby</Button>
      </div>
    );
  }
  if (!ready) return <Spinner />;

  // Online: wait until the initial state arrives (version ≥ 1).
  if (roomCode && online.version === 0) {
    return <RoomWaiting roomCode={roomCode} />;
  }

  return <GameBoard />;
}
