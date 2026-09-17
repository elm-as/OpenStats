import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Circle, Loader2 } from 'lucide-react';

export interface StatusItem {
  id: string;
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}

interface StatusContextValue {
  busy: boolean;
  message: string | null;
  items: StatusItem[];
  /** Publie l'état courant depuis un écran (progression, compteurs, résumés). */
  setStatus: (next: { busy?: boolean; message?: string | null; items?: StatusItem[] }) => void;
}

const StatusContext = createContext<StatusContextValue | null>(null);

// Identité stable, pour que le no-op ne relance pas les effets qui en dépendent.
const FALLBACK_STATUS: StatusContextValue = {
  busy: false, message: null, items: [], setStatus: () => {},
};

/** Permet à n'importe quel écran d'alimenter la barre de statut. */
export function useStatus(): StatusContextValue {
  const ctx = useContext(StatusContext);
  if (!ctx) {
    // Hors du châssis (tests unitaires, page de partage) : no-op silencieux.
    return FALLBACK_STATUS;
  }
  return ctx;
}

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [items, setItems] = useState<StatusItem[]>([]);

  /**
   * `setStatus` doit avoir une identité stable : les écrans l'appellent depuis
   * un `useEffect` qui la liste en dépendance. Si elle changeait à chaque mise
   * à jour de statut, l'effet se relancerait indéfiniment.
   *
   * Les comparaisons évitent en outre de re-rendre pour une valeur identique.
   */
  const setStatus = useCallback<StatusContextValue['setStatus']>(next => {
    if (next.busy !== undefined) setBusy(prev => (prev === next.busy ? prev : next.busy!));
    if (next.message !== undefined) {
      setMessage(prev => (prev === next.message ? prev : next.message!));
    }
    if (next.items !== undefined) {
      setItems(prev => (sameItems(prev, next.items!) ? prev : next.items!));
    }
  }, []);

  const value = useMemo<StatusContextValue>(
    () => ({ busy, message, items, setStatus }),
    [busy, message, items, setStatus],
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

/** Deux listes de statut équivalentes ne doivent pas provoquer de rendu. */
function sameItems(a: StatusItem[], b: StatusItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) =>
    item.id === b[index].id && item.label === b[index].label && item.tone === b[index].tone);
}

const TONE_COLORS: Record<NonNullable<StatusItem['tone']>, string> = {
  neutral: 'var(--ui-text-muted)',
  accent: 'var(--ui-accent-text)',
  success: 'var(--ui-success)',
  warning: 'var(--ui-warning)',
  danger: 'var(--ui-danger)',
};

interface Props {
  datasetLabel: string | null;
  rows?: number;
  columns?: number;
}

/** Barre de statut : contexte technique permanent, en bas de l'écran. */
export default function StatusBar({ datasetLabel, rows, columns }: Props) {
  const { busy, message, items } = useStatus();

  return (
    <footer
      className="flex items-center gap-3 px-2.5 shrink-0 select-none"
      style={{
        height: 'var(--ui-statusbar-h)',
        background: 'var(--ui-bg-sunken)',
        borderTop: '1px solid var(--ui-border)',
        fontSize: 'var(--ui-fs-xs)',
        color: 'var(--ui-text-faint)',
      }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-1.5 shrink-0">
        {busy ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: 'var(--ui-accent)' }} />
        ) : (
          <Circle className="w-2 h-2" style={{ color: 'var(--ui-success)', fill: 'var(--ui-success)' }} />
        )}
        <span>{busy ? 'Calcul en cours' : 'Prêt'}</span>
      </span>

      {message && (
        <>
          <span className="ui-sep" style={{ height: 12 }} aria-hidden />
          <span className="truncate" style={{ color: 'var(--ui-text-muted)' }}>{message}</span>
        </>
      )}

      {items.map(item => (
        <span key={item.id} className="flex items-center gap-3 shrink-0">
          <span className="ui-sep" style={{ height: 12 }} aria-hidden />
          <span className="ui-num" style={{ color: TONE_COLORS[item.tone ?? 'neutral'] }}>
            {item.label}
          </span>
        </span>
      ))}

      <span className="flex-1" />

      {datasetLabel && (
        <span className="truncate max-w-[280px]" title={datasetLabel}>
          {datasetLabel}
          {rows != null && columns != null && (
            <span className="ui-num" style={{ marginLeft: 8 }}>
              {rows.toLocaleString('fr-FR')} × {columns}
            </span>
          )}
        </span>
      )}
    </footer>
  );
}
