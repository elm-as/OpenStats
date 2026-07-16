import type { ReactNode, HTMLAttributes } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: 'badge',
  success: 'badge badge-success',
  warning: 'badge badge-warning',
  danger: 'badge badge-danger',
  info: 'badge badge-info',
  neutral: 'badge badge-neutral',
};

const DOT_COLOR: Record<BadgeVariant, string> = {
  default: 'bg-accent-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-blue-400',
  neutral: 'bg-slate-400',
};

export function Badge({ variant = 'default', dot = false, className = '', children, ...rest }: BadgeProps) {
  return (
    <span className={`${VARIANT_CLASS[variant]} ${className}`} {...rest}>
      {dot && <span className={`dot ${DOT_COLOR[variant]}`} />}
      {children}
    </span>
  );
}

interface StatusBadgeProps {
  status: 'success' | 'error' | 'pending' | 'running' | 'idle';
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const map = {
    success: { variant: 'success' as const, text: label ?? 'Réussi' },
    error: { variant: 'danger' as const, text: label ?? 'Erreur' },
    pending: { variant: 'warning' as const, text: label ?? 'En attente' },
    running: { variant: 'info' as const, text: label ?? 'En cours' },
    idle: { variant: 'neutral' as const, text: label ?? 'Inactif' },
  };
  const { variant, text } = map[status];
  return <Badge variant={variant} dot>{text}</Badge>;
}
