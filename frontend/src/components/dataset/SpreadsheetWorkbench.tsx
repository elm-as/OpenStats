import { useMemo, useState } from 'react';
import { Loader2, Database } from 'lucide-react';
import { usePreviewDatasetQuery } from '../../store/api';
import type { ColumnProfile } from '../../types';

interface Props {
  datasetId: string;
  dictionary: ColumnProfile[];
  selectedColumn: string | null;
  onSelectColumn: (colName: string) => void;
}

const SHORT_SCALE: Record<string, string> = {
  continu: 'Cont.',
  discret: 'Disc.',
  temporel: 'Date',
  catégoriel_nominal: 'Nom.',
  binaire: 'Bin.',
};

function isNumericValue(val: unknown, statType?: string): boolean {
  if (typeof val === 'number') return true;
  return statType === 'continu' || statType === 'discret';
}

function formatCellValue(val: unknown, statType?: string): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return String(val);
    if (statType === 'temporel') return String(val);
    return Number.isInteger(val) ? val.toLocaleString('fr-FR') : val.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
  }
  return String(val);
}

/**
 * Grille tableur haute densité inspirée des logiciels statistiques de bureau.
 * Affiche les observations avec index figé, en-têtes typés et chiffres tabulaires alignés.
 */
export default function SpreadsheetWorkbench({
  datasetId,
  dictionary,
  selectedColumn,
  onSelectColumn,
}: Props) {
  const [cleaned, setCleaned] = useState(true);
  const [rowLimit, setRowLimit] = useState<number>(100);

  const { data: preview, isLoading, isFetching, error } = usePreviewDatasetQuery({
    id: datasetId,
    n: rowLimit,
    cleaned,
  });

  const typeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const col of dictionary) {
      map[col.nom_brut] = col.type_statistique;
    }
    return map;
  }, [dictionary]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 ui-t-muted">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ui-accent)' }} />
        <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Chargement de la grille de données…</span>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 ui-t-muted p-6">
        <Database className="w-6 h-6 ui-t-faint" />
        <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Aperçu du tableur indisponible pour ce dataset.</span>
      </div>
    );
  }

  const columns = preview.columns ?? [];
  const rows = preview.data ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto ui-scroll">
        <table className="ui-table w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                className="ui-num text-right select-none"
                style={{
                  position: 'sticky',
                  left: 0,
                  top: 0,
                  zIndex: 3,
                  width: 52,
                  minWidth: 52,
                  background: 'var(--ui-bg-sunken)',
                  borderRight: '1px solid var(--ui-border-strong)',
                }}
              >
                #
              </th>
              {columns.map(col => {
                const statType = typeMap[col];
                const isSelected = selectedColumn === col;
                return (
                  <th
                    key={col}
                    onClick={() => onSelectColumn(isSelected ? '' : col)}
                    className="cursor-pointer select-none transition-colors"
                    style={{
                      minWidth: 120,
                      borderRight: '1px solid var(--ui-border)',
                      background: isSelected ? 'var(--ui-accent-soft)' : 'var(--ui-bg-panel)',
                      color: isSelected ? 'var(--ui-accent-text)' : 'var(--ui-text)',
                    }}
                    title={`${col} (${statType ?? preview.dtypes[col] ?? 'inconnu'})`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold normal-case" style={{ fontSize: 'var(--ui-fs-sm)' }}>
                        {col}
                      </span>
                      <span
                        className="ui-mono shrink-0 px-1 rounded"
                        style={{
                          fontSize: 9.5,
                          background: 'var(--ui-bg-sunken)',
                          color: 'var(--ui-text-faint)',
                          border: '1px solid var(--ui-border)',
                        }}
                      >
                        {SHORT_SCALE[statType] ?? preview.dtypes[col] ?? 'var'}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td
                  className="ui-mono ui-num text-right select-none"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: 'var(--ui-bg-sunken)',
                    color: 'var(--ui-text-faint)',
                    borderRight: '1px solid var(--ui-border-strong)',
                  }}
                >
                  {idx + 1}
                </td>
                {columns.map(col => {
                  const val = row[col];
                  const isMissing = val === null || val === undefined || val === '';
                  const statType = typeMap[col];
                  const numeric = isNumericValue(val, statType);
                  const isSelected = selectedColumn === col;

                  return (
                    <td
                      key={col}
                      className={`truncate max-w-[260px] ${numeric ? 'ui-td-num' : ''}`}
                      style={{
                        borderRight: '1px solid var(--ui-border)',
                        background: isSelected ? 'var(--ui-accent-soft)' : undefined,
                        color: isMissing ? 'var(--ui-text-faint)' : undefined,
                      }}
                      title={isMissing ? 'Valeur manquante (NA)' : String(val)}
                    >
                      {isMissing ? <span className="italic opacity-65">NA</span> : formatCellValue(val, statType)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barre de pied du tableur */}
      <div
        className="px-3 flex items-center justify-between gap-3 shrink-0"
        style={{
          height: 30,
          background: 'var(--ui-bg-sunken)',
          borderTop: '1px solid var(--ui-border)',
          fontSize: 'var(--ui-fs-xs)',
          color: 'var(--ui-text-muted)',
        }}
      >
        <div className="flex items-center gap-2 ui-num">
          <span>
            Lignes <strong className="ui-t">1–{rows.length.toLocaleString('fr-FR')}</strong> sur{' '}
            <strong className="ui-t">{(preview.total_rows ?? rows.length).toLocaleString('fr-FR')}</strong>
          </span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--ui-accent)' }} />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center shrink-0 rounded-[var(--ui-radius-sm)] overflow-hidden" style={{ border: '1px solid var(--ui-border)' }}>
            <button
              type="button"
              onClick={() => setCleaned(true)}
              className="px-2 py-0.5 transition-colors whitespace-nowrap shrink-0"
              style={{
                background: cleaned ? 'var(--ui-accent-soft)' : 'transparent',
                color: cleaned ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
                fontWeight: cleaned ? 700 : 500,
              }}
            >
              Nettoyées
            </button>
            <button
              type="button"
              onClick={() => setCleaned(false)}
              className="px-2 py-0.5 transition-colors whitespace-nowrap shrink-0"
              style={{
                background: !cleaned ? 'var(--ui-accent-soft)' : 'transparent',
                color: !cleaned ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
                fontWeight: !cleaned ? 700 : 500,
              }}
            >
              Brutes
            </button>
          </div>

          <select
            value={rowLimit}
            onChange={e => setRowLimit(Number(e.target.value))}
            className="ui-select ui-num shrink-0"
            style={{ width: 'auto', minWidth: 96, height: 22, padding: '0 6px', fontSize: 'var(--ui-fs-xs)' }}
            aria-label="Nombre de lignes affichées"
          >
            <option value={50}>50 lignes</option>
            <option value={100}>100 lignes</option>
            <option value={250}>250 lignes</option>
          </select>
        </div>
      </div>
    </div>
  );
}
