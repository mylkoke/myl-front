import { useNavigate } from 'react-router-dom';
import { Sword, BookOpen, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_VERSION } from '@/version';

export function LobbyPage() {
  const navigate = useNavigate();

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
          onClick={() => navigate('/game')}
          className="flex items-center justify-center gap-2 text-base"
        >
          <Sword size={18} />
          Jugar partida
        </Button>

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
