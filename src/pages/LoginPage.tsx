import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { APP_VERSION } from '@/version';

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = mode === 'login'
      ? await signIn(username.trim(), password)
      : await signUp(username.trim(), password);
    setBusy(false);
    if (ok) navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0a1520] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(251,191,36,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="text-center mb-8 relative z-10">
        <div className="text-yellow-500/30 text-[80px] font-black leading-none select-none mb-2">
          M&L
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Mitos y Leyendas</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-slate-900/70 border border-slate-700/50 rounded-xl p-6 flex flex-col gap-4 relative z-10"
      >
        <h2 className="text-lg font-bold text-yellow-400 text-center">
          {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Usuario
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-500/50"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            className="bg-slate-800 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-yellow-500/50"
          />
        </label>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <Button type="submit" variant="primary" size="lg" fullWidth disabled={busy}
          className="flex items-center justify-center gap-2">
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : mode === 'login' ? (
            <LogIn size={16} />
          ) : (
            <UserPlus size={16} />
          )}
          {mode === 'login' ? 'Entrar' : 'Registrarme'}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-xs text-slate-400 hover:text-yellow-400 transition-colors"
        >
          {mode === 'login'
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>

      <div className="absolute bottom-4 right-4 text-slate-700 text-xs font-mono select-none">
        v{APP_VERSION}
      </div>
    </div>
  );
}
