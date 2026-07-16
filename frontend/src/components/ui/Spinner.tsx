import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE = { sm: 'w-3 h-3', md: 'w-4 h-4', lg: 'w-6 h-6' };

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className={`${SIZE[size]} animate-spin text-accent-400`} />
      {label && <span className="text-xs text-muted">{label}</span>}
    </span>
  );
}

interface LoadingOverlayProps {
  show: boolean;
  label?: string;
  children?: ReactNode;
}

export function LoadingOverlay({ show, label, children }: LoadingOverlayProps) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative">
      {children}
      <div className="absolute inset-0 flex items-center justify-center bg-surface-900/60 backdrop-blur-sm rounded-xl z-10">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-accent-400" />
          {label && <span className="text-xs text-muted">{label}</span>}
        </div>
      </div>
    </div>
  );
}
