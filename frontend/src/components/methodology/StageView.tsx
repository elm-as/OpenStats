import { useMemo, useState } from 'react';
import { ArrowUpDown, Search, Info } from 'lucide-react';
import StageCharts from './StageCharts';
import IterationTimeline from './IterationTimeline';
import type { CorrectionReport, Stage, StageTable } from './methodologyTypes';

const ROWS_PER_PAGE = 25;

/** Tableau triable et filtrable — un outil affiche des tableaux, pas des cartes. */
function DataTable({ table }: { table: StageTable }) {
  const [sort, setSort] = useState<{ column: number; asc: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const rows = useMemo(() => {
    let out = table.rows;
    const q = query.trim().toLowerCase();
    if (q) out = out.filter(row => row.some(cell => String(cell ?? '').toLowerCase().includes(q)));

    if (sort) {
      out = [...out].sort((a, b) => {
        const va = a[sort.column];
        const vb = b[sort.column];
        const na = typeof va === 'number' ? va : parseFloat(String(va).replace(/[^\d.,-]/g, '').replace(',', '.'));
        const nb = typeof vb === 'number' ? vb : parseFloat(String(vb).replace(/[^\d.,-]/g, '').replace(',', '.'));
        const comparison = (!Number.isNaN(na) && !Number.isNaN(nb))
          ? na - nb
          : String(va ?? '').localeCompare(String(vb ?? ''), 'fr');
        return sort.asc ? comparison : -comparison;
      });
    }
    return out;
  }, [table.rows, sort, query]);

  const visible = expanded ? rows : rows.slice(0, ROWS_PER_PAGE);
  const hidden = rows.length - visible.length;

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span>{table.title}</span>
        <span className="flex items-center gap-2">
          {table.rows.length > 8 && (
            <span className="relative">
              <Search
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5"
                style={{ color: 'var(--ui-text-faint)' }}
              />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="filtrer"
                className="ui-input"
                style={{ height: 22, width: 132, paddingLeft: 18, fontSize: 'var(--ui-fs-xs)' }}
              />
            </span>
          )}
          <span className="ui-num" style={{ fontWeight: 600 }}>{rows.length}</span>
        </span>
      </header>

      <div className="ui-scroll" style={{ overflowX: 'auto', maxHeight: expanded ? 620 : undefined, overflowY: 'auto' }}>
        <table className="ui-table">
          <thead>
            <tr>
              {table.columns.map((column, index) => (
                <th key={column}>
                  <button
                    onClick={() => setSort(s =>
                      s && s.column === index ? { column: index, asc: !s.asc } : { column: index, asc: true })}
                    className="ui-focusable flex items-center gap-1"
                    style={{ font: 'inherit', color: 'inherit', letterSpacing: 'inherit' }}
                  >
                    {column}
                    <ArrowUpDown
                      className="w-2.5 h-2.5"
                      style={{ opacity: sort?.column === index ? 1 : 0.3 }}
                    />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={typeof cell === 'number' ? 'ui-td-num' : undefined}
                    title={String(cell ?? '')}
                  >
                    {cell === null || cell === undefined ? '—' : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="ui-btn ui-btn-ghost ui-focusable"
          style={{ width: '100%', borderTop: '1px solid var(--ui-border)', borderRadius: 0 }}
        >
          Afficher les {hidden} lignes restantes
        </button>
      )}
    </section>
  );
}

export default function StageView({ stage }: { stage: Stage }) {
  const correction = stage.key === 'correction'
    ? (stage.data as unknown as CorrectionReport)
    : null;

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-3)' }}>
      {stage.headline && (
        <p style={{ fontSize: 'var(--ui-fs-md)', lineHeight: 1.55 }}>{stage.headline}</p>
      )}

      {stage.status === 'skipped' && (
        <div
          className="ui-panel flex items-start gap-2"
          style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}
        >
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ui-text-muted)' }} />
          <span className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)' }}>
            Étape non exécutée — les conditions n’étaient pas réunies.
          </span>
        </div>
      )}

      {/* La boucle de correction a son propre affichage : les itérations priment
          sur le tableau brut des corrections. */}
      {correction && correction.iterations !== undefined && (
        <IterationTimeline report={correction} />
      )}

      {stage.charts.length > 0 && <StageCharts charts={stage.charts} />}

      {stage.tables.map((table, index) => (
        <DataTable key={`${table.title}-${index}`} table={table} />
      ))}

      {stage.notes.length > 0 && (
        <ul className="flex flex-col" style={{ gap: 3 }}>
          {stage.notes.map((note, index) => (
            <li key={index} className="ui-t-faint flex gap-1.5" style={{ fontSize: 'var(--ui-fs-xs)' }}>
              <span>·</span>{note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
