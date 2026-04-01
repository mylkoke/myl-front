import type { ReactNode } from 'react';

type BadgeVariant = 'gold' | 'blue' | 'red' | 'green' | 'gray' | 'purple';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  red: 'bg-red-500/20 text-red-300 border-red-500/40',
  green: 'bg-green-500/20 text-green-300 border-green-500/40',
  gray: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
