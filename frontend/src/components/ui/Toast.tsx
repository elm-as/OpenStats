import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number; // ms ; 0 = persistant
  action?: { label: string; onClick: () => void };
}

export interface ToastItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (variant: ToastVariant, opts: ToastOptions | string) => string;
  success: (opts: ToastOptions | string) => string;
  error: (opts: ToastOptions | string) => string;
  warning: (opts: ToastOptions | string) => string;
  info: (opts: ToastOptions | string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 4000,
  warning: 5500,
  error: 7000,
};

let counter = 0;
const newId = () => `t_${Date.now()}_${++counter}`;

function normalize(opts: ToastOptions | string): ToastOptions {
  return typeof opts === 'string' ? { description: opts } : opts;
}

export function ToastProvider({ children, max = 5 }: { children: ReactNode; max?: number }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, opts: ToastOptions | string) => {
      const o = normalize(opts);
      const id = newId();
      const item: ToastItem = {
        id,
        variant,
        createdAt: Date.now(),
        duration: o.duration ?? DEFAULT_DURATION[variant],
        title: o.title,
        description: o.description,
        action: o.action,
      };
      setToasts((prev) => {
        const next = [...prev, item];
        if (next.length > max) next.splice(0, next.length - max);
        return next;
      });
      if (item.duration && item.duration > 0) {
        const handle = window.setTimeout(() => dismiss(id), item.duration);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss, max],
  );

  const clear = useCallback(() => {
    timers.current.forEach((h) => window.clearTimeout(h));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach((h) => window.clearTimeout(h));
      timers.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      push,
      success: (o) => push('success', o),
      error: (o) => push('error', o),
      warning: (o) => push('warning', o),
      info: (o) => push('info', o),
      dismiss,
      clear,
    }),
    [toasts, push, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

/* ─────────── viewport & item ─────────── */

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.35)', color: '#6ee7b7' },
  error:   { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)',  color: '#fca5a5' },
  warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', color: '#fcd34d' },
  info:    { bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.35)',  color: '#67e8f9' },
};

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="region"
      aria-label="Notifications"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icon = ICONS[toast.variant];
  const style = VARIANT_STYLE[toast.variant];
  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto rounded-xl border backdrop-blur-md shadow-lg animate-slide-in-right"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-start gap-3 p-3">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: style.color }} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="text-[13px] font-semibold text-strong leading-snug">{toast.title}</div>
          )}
          {toast.description && (
            <div className="text-xs text-default mt-0.5 break-words">{toast.description}</div>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                onDismiss();
              }}
              className="mt-2 text-xs font-semibold underline-offset-2 hover:underline focus-ring rounded"
              style={{ color: style.color }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer la notification"
          className="text-faint hover:text-default transition-colors p-0.5 rounded focus-ring"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
