import type { ReactNode } from 'react';

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  iconColor?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  hint?: ReactNode;
}

export function Stat({ label, value, icon, iconColor = 'ui-t-accent', delta, hint }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-label">
        {icon && <span className={iconColor}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="stat-value ui-num">{value}</div>
      {delta && (
        <div className={`stat-delta ${delta.direction === 'up' ? 'stat-delta-up' : delta.direction === 'down' ? 'stat-delta-down' : 'ui-t-muted'}`}>
          {delta.direction === 'up' && '↑ '}
          {delta.direction === 'down' && '↓ '}
          {delta.value}
        </div>
      )}
      {hint && <div className="text-xs ui-t-faint mt-1">{hint}</div>}
    </div>
  );
}

interface StatGridProps {
  children: ReactNode;
  columns?: 'sm' | 'md' | 'lg';
}

export function StatGrid({ children, columns = 'md' }: StatGridProps) {
  const cls = columns === 'sm' ? 'grid-auto-fit-sm' : columns === 'lg' ? 'grid-auto-fit-lg' : 'grid-auto-fit-sm';
  return <div className={cls}>{children}</div>;
}
