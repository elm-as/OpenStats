import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="text-faint mb-3 [&>svg]:w-10 [&>svg]:h-10">{icon}</div>}
      <h4 className="text-sm font-semibold text-default">{title}</h4>
      {description && <p className="text-xs text-muted mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
