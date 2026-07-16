import type { ReactNode } from 'react';

interface SectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ title, subtitle, icon, actions, children, className = '' }: SectionProps) {
  return (
    <section className={`section ${className}`}>
      {(title || subtitle || actions) && (
        <SectionHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
      )}
      {children}
    </section>
  );
}

export function SectionHeader({ title, subtitle, icon, actions }: Omit<SectionProps, 'children' | 'className'>) {
  return (
    <div className="section-header">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-accent-400 flex-shrink-0">{icon}</span>}
        <div className="min-w-0">
          {title && <h3 className="section-title truncate">{title}</h3>}
          {subtitle && <p className="section-subtitle truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
