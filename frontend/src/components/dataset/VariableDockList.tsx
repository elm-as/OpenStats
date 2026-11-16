import { useMemo, useState } from 'react';
import { Hash, Layers, Calendar, Tag, ToggleLeft, Search } from 'lucide-react';
import type { ColumnProfile } from '../../types';

interface Props {
  columns: ColumnProfile[];
  selectedColumn: string | null;
  onSelectColumn: (colName: string) => void;
}

const SCALE_META: Record<string, { code: string; icon: typeof Hash; tone: string }> = {
  continu: { code: 'CONT', icon: Hash, tone: 'var(--ui-accent-text)' },
  discret: { code: 'DISC', icon: Layers, tone: 'var(--ui-info)' },
  temporel: { code: 'DATE', icon: Calendar, tone: 'var(--ui-accent)' },
  catégoriel_nominal: { code: 'CAT', icon: Tag, tone: 'var(--ui-warning)' },
  binaire: { code: 'BIN', icon: ToggleLeft, tone: 'var(--ui-success)' },
};

/**
 * Volet latéral des variables (ergonomie type Jamovi).
 * Liste les colonnes détectées avec leur échelle de mesure et leur taux de valeurs manquantes.
 */
export default function VariableDockList({ columns, selectedColumn, onSelectColumn }: Props) {
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter(
      col => col.nom_brut.toLowerCase().includes(q) || col.nom_lisible.toLowerCase().includes(q),
    );
  }, [columns, filter]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className="px-2.5 flex items-center justify-between shrink-0"
        style={{ height: 30, borderBottom: '1px solid var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
      >
        <span className="ui-label">Variables</span>
        <span className="ui-tag ui-tag-neutral ui-num">{columns.length}</span>
      </div>

      {columns.length > 6 && (
        <div className="p-1.5 shrink-0" style={{ borderBottom: '1px solid var(--ui-border)' }}>
          <div className="relative">
            <Search
              className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ui-text-faint)' }}
            />
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filtrer les variables…"
              className="ui-input w-full"
              style={{ paddingLeft: 24, height: 26, fontSize: 'var(--ui-fs-xs)' }}
            />
          </div>
        </div>
      )}

      <ul className="flex-1 overflow-y-auto ui-scroll py-1 px-1 space-y-0.5">
        {filtered.map(col => {
          const meta = SCALE_META[col.type_statistique] ?? { code: 'VAR', icon: Tag, tone: 'var(--ui-text-muted)' };
          const Icon = meta.icon;
          const active = selectedColumn === col.nom_brut;
          const missingPct = Math.round((col.taux_nullite || 0) * 100);

          return (
            <li key={col.nom_brut}>
              <button
                type="button"
                onClick={() => onSelectColumn(active ? '' : col.nom_brut)}
                className="ui-focusable w-full flex items-center gap-2 px-2 rounded-[var(--ui-radius-sm)] text-left transition-colors"
                style={{
                  height: 26,
                  background: active ? 'var(--ui-accent-soft)' : 'transparent',
                  color: active ? 'var(--ui-text)' : 'var(--ui-text-secondary)',
                }}
                title={`${col.nom_lisible} (${col.type_statistique}) — Cardinalité : ${col.cardinalite}`}
              >
                <Icon className="w-3 h-3 shrink-0" style={{ color: meta.tone }} />
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: active ? 700 : 500 }}>
                  {col.nom_brut}
                </span>
                {missingPct > 0 && (
                  <span
                    className="ui-num shrink-0 px-1 rounded"
                    style={{ fontSize: 10, color: 'var(--ui-warning)', background: 'var(--ui-warning-soft)' }}
                  >
                    {missingPct}% NA
                  </span>
                )}
                <span className="ui-mono shrink-0" style={{ fontSize: 9.5, color: meta.tone }}>
                  {meta.code}
                </span>
              </button>
            </li>
          );
        })}

        {filtered.length === 0 && (
          <li className="px-2 py-4 text-center ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
            Aucune variable correspondante
          </li>
        )}
      </ul>
    </div>
  );
}
