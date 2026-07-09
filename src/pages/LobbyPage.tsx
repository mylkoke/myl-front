import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sword, BookOpen, Trophy, LogOut, UserCircle, Layers, Wand2, ShieldCheck,
  Globe, LogIn, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useOnlineStore } from '@/store/onlineStore';
import { apiGameSyncService } from '@/services/api/gameSyncService';
import { APP_VERSION } from '@/version';

export function LobbyPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const startOnline = useOnlineStore((s) => s.startOnline);

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleCreateRoom = async () => {
    setBusy('create');
    setError(null);
    try {
      const { gameId, roomCode } = await apiGameSyncService.createRoom();
      startOnline({ gameId, roomCode, mySeat: 'player' });
      navigate(`/game/${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la sala');
    } finally {
      setBusy(null);
    }
  };

  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('El código tiene 6 caracteres');
      return;
    }
    setBusy('join');
    setError(null);
    try {
      const res = await apiGameSyncService.joinRoom(code);
      startOnline({ gameId: res.gameId, roomCode: code, mySeat: res.seat });
      navigate(`/game/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar a la sala');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1520] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 70%)',
        }}
      />

      {/* User bar */}
      {user && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-3 bg-slate-900/70 border border-slate-700/50 rounded-full pl-3 pr-1.5 py-1.5">
          <span className="flex items-center gap-1.5 text-sm text-slate-300">
            <UserCircle size={16} className="text-yellow-500" />
            {user.username}
            {user.role !== 'comun' && (
              <span className="text-[9px] uppercase tracking-wider text-yellow-400/70 border border-yellow-500/30 rounded-full px-1.5 py-0.5">
                {user.role}
              </span>
            )}
          </span>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-1.5 rounded-full text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}

      {/* Logo / Title */}
      <div className="text-center mb-12 relative z-10">
        <div className="text-yellow-500/30 text-[100px] font-black leading-none select-none mb-2">
          M&L
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Mitos y Leyendas
        </h1>
      </div>

      {/* Menu */}
      <div className="flex flex-col gap-4 w-72 relative z-10">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleCreateRoom}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 text-base"
        >
          {busy === 'create' ? <Loader2 size={18} className="animate-spin" /> : <Globe size={18} />}
          Crear sala online
        </Button>

        {!joinOpen ? (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => setJoinOpen(true)}
            className="flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            Unirse a sala
          </Button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              placeholder="CÓDIGO"
              maxLength={6}
              autoFocus
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-center text-lg font-black tracking-[0.25em] text-yellow-400 uppercase placeholder:text-slate-600 placeholder:tracking-normal placeholder:font-normal placeholder:text-sm focus:outline-none focus:border-yellow-500/60"
            />
            <Button
              variant="primary"
              onClick={handleJoinRoom}
              disabled={busy !== null || joinCode.trim().length !== 6}
              className="flex items-center gap-1.5"
            >
              {busy === 'join' ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Entrar
            </Button>
          </div>
        )}

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => navigate('/game')}
          className="flex items-center justify-center gap-2"
        >
          <Sword size={18} />
          Partida local (2 en 1 pantalla)
        </Button>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => navigate('/deck')}
          className="flex items-center justify-center gap-2"
        >
          <Layers size={18} />
          Mi mazo
        </Button>

        {(user?.role === 'admin' || user?.role === 'supervisor') && (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => navigate('/editor')}
            className="flex items-center justify-center gap-2"
          >
            <Wand2 size={18} />
            Modo editor
          </Button>
        )}

        {user?.role === 'admin' && (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => navigate('/admin')}
            className="flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} />
            Administración
          </Button>
        )}

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          className="flex items-center justify-center gap-2"
          disabled
        >
          <Trophy size={18} />
          Colección
          <span className="text-xs opacity-50 ml-1">(próximamente)</span>
        </Button>

        <Button
          variant="ghost"
          size="lg"
          fullWidth
          className="flex items-center justify-center gap-2"
          disabled
        >
          <BookOpen size={18} />
          Manual de reglas
          <span className="text-xs opacity-50 ml-1">(próximamente)</span>
        </Button>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 text-slate-700 text-xs text-center">
        MVP Frontend — Fase 1 · Hijos de Daana
        <span className="absolute bottom-4 right-4 text-slate-700 text-xs font-mono select-none">
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
}
