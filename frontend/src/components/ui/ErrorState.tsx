import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  compact?: boolean;
}

function extractMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as { message?: string; data?: { detail?: string; message?: string }; error?: string };
    return (
      anyErr.data?.detail ||
      anyErr.data?.message ||
      anyErr.message ||
      anyErr.error ||
      null
    );
  }
  return null;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  description,
  error,
  onRetry,
  retryLabel = 'Réessayer',
  action,
  compact = false,
}: ErrorStateProps) {
  const detail = description ?? extractMessage(error) ?? undefined;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed ${
        compact ? 'py-5 px-4' : 'py-10 px-6'
      }`}
      style={{ borderColor: 'rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}
    >
      <div className="mb-3 inline-flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'rgba(239,68,68,0.12)' }}>
        <AlertTriangle className="w-5 h-5" style={{ color: '#fca5a5' }} aria-hidden="true" />
      </div>
      <h4 className="text-sm font-semibold text-default">{title}</h4>
      {detail && <p className="text-xs text-muted mt-1 max-w-md break-words">{detail}</p>}
      {(onRetry || action) && (
        <div className="mt-4 flex items-center gap-2">
          {onRetry && (
            <button type="button" className="btn-secondary focus-ring" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {retryLabel}
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
