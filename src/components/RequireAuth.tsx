import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/services/interfaces';

function FullScreenSpinner() {
  return (
    <div className="min-h-screen bg-[#0a1520] flex items-center justify-center">
      <Loader2 size={32} className="text-yellow-500 animate-spin" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <FullScreenSpinner />;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Route gate by role. Security lives in the backend; this only hides UI. */
export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[];
  children: ReactNode;
}) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  if (status === 'loading') return <FullScreenSpinner />;
  if (status === 'anon') return <Navigate to="/login" replace />;
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
