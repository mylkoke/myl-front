import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import type { User, UserRole } from '@/services/interfaces';
import { getServices } from '@/services';
import { useAuthStore } from '@/store/authStore';

const ROLES: UserRole[] = ['comun', 'supervisor', 'admin'];

export function AdminPage() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getServices()
      .admin.listUsers()
      .then(setUsers)
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Error cargando usuarios'))
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (user: User, role: UserRole) => {
    try {
      const updated = await getServices().admin.setRole(user.id, role);
      setUsers((list) => list.map((u) => (u.id === user.id ? updated : u)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error cambiando el rol');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1520] flex items-center justify-center">
        <Loader2 size={32} className="text-yellow-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1520] flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/40">
        <button
          onClick={() => navigate('/')}
          className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
          <ShieldCheck size={15} className="text-yellow-500" /> Administración de usuarios
        </h1>
      </header>

      {message && (
        <div className="px-4 py-2 text-xs text-center text-red-300 bg-red-500/10 border-b border-red-500/20">
          {message}
        </div>
      )}

      <div className="flex-1 p-3 sm:p-4 max-w-2xl w-full mx-auto">
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2.5"
            >
              <span className="flex-1 text-sm text-slate-200 truncate">
                {user.username}
                {user.id === me?.id && (
                  <span className="text-slate-500 text-xs ml-1">(tú)</span>
                )}
              </span>
              <select
                value={user.role}
                disabled={user.id === me?.id}
                onChange={(e) => changeRole(user, e.target.value as UserRole)}
                className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-yellow-500/50 disabled:opacity-40"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
