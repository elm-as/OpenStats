import { Link } from 'react-router-dom';
import { Database, Upload, Trash2 } from 'lucide-react';
import type { DatasetSummary } from '../../types';

export interface DatasetSessionListProps {
  datasets: DatasetSummary[];
  activeId: string | null;
  isLoading: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => Promise<void>;
}

export default function DatasetSessionList(props: DatasetSessionListProps) {
  return (
    <div className="flex flex-col max-h-[42%] shrink-0">
      <div
        className="px-2.5 flex items-center justify-between shrink-0"
        style={{ height: 30, borderBottom: '1px solid var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
      >
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3" style={{ color: 'var(--ui-accent)' }} />
          <span className="ui-label">Jeux de données</span>
          <span className="ui-tag ui-tag-neutral ui-num">{props.datasets.length}</span>
        </div>
        <Link to="/workflow" className="text-[11px] font-bold ui-t-accent hover:underline flex items-center gap-1">
          <Upload className="w-3 h-3" /> Ouvrir
        </Link>
      </div>

      <ul className="overflow-y-auto ui-scroll p-1 space-y-0.5">
        {props.isLoading && (
          <li className="px-2 py-3 text-center ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
            Lecture du catalogue…
          </li>
        )}

        {!props.isLoading && props.datasets.length === 0 && (
          <li className="px-2 py-4 text-center ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
            Aucun jeu chargé en mémoire
          </li>
        )}

        {props.datasets.map(ds => {
          const isCurrent = ds.id === props.activeId;
          return (
            <li key={ds.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => props.onSelect(ds.id)}
                className="ui-focusable flex-1 min-w-0 flex items-center gap-2 px-2 rounded-[var(--ui-radius-sm)] text-left"
                style={{
                  height: 28,
                  background: isCurrent ? 'var(--ui-accent-soft)' : 'transparent',
                  color: isCurrent ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                  borderLeft: isCurrent ? '2px solid var(--ui-accent)' : '2px solid transparent',
                }}
              >
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: isCurrent ? 700 : 500 }}>
                  {ds.name}
                </span>
                <span className="ui-mono ui-num shrink-0" style={{ fontSize: 10, color: 'var(--ui-text-faint)' }}>
                  {ds.shape.rows.toLocaleString('fr-FR')}×{ds.shape.columns}
                </span>
              </button>
              <button
                type="button"
                onClick={() => props.onDelete(ds.id, ds.name)}
                disabled={props.isDeleting}
                className="opacity-0 group-hover:opacity-100 p-1 rounded ui-t-faint hover:text-[var(--ui-danger)] transition-opacity ui-focusable"
                title={`Supprimer ${ds.name}`}
                aria-label={`Supprimer ${ds.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
