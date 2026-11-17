import React from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return '\u2014';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'number') {
    if (Number.isNaN(v) || !Number.isFinite(v)) return '\u2014';
    if (Number.isInteger(v)) return v.toLocaleString('fr-FR');
    if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(3);
    return v.toFixed(4);
  }
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(fmt).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export const pctBar = (pct: number, color: string) => (
  <div
    className="flex-1 h-1.5 rounded-[var(--ui-radius-sm)] overflow-hidden"
    style={{ background: 'var(--ui-bg-raised)' }}
  >
    <div
      className="h-full rounded-[var(--ui-radius-sm)] transition-all duration-300"
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }}
    />
  </div>
);

function resolveToneFromColor(color?: string): BadgeTone {
  if (!color) return 'neutral';
  const c = color.toLowerCase();
  if (c.includes('#10b981') || c.includes('#059669') || c.includes('#34d399') || c.includes('success') || c.includes('emerald')) return 'success';
  if (c.includes('#ef4444') || c.includes('#dc2626') || c.includes('#f43f5e') || c.includes('danger') || c.includes('red')) return 'danger';
  if (c.includes('#f59e0b') || c.includes('#f97316') || c.includes('#d97706') || c.includes('warning') || c.includes('amber')) return 'warning';
  if (c.includes('#3b82f6') || c.includes('#0284c7') || c.includes('#06b6d4') || c.includes('info') || c.includes('cyan')) return 'info';
  if (c.includes('#8b5cf6') || c.includes('#a855f7') || c.includes('accent') || c.includes('violet')) return 'accent';
  return 'neutral';
}

export const Badge = ({
  children,
  tone,
  color,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  color?: string;
}) => {
  const finalTone = tone ?? resolveToneFromColor(color);
  return <span className={`ui-tag ui-tag-${finalTone}`}>{children}</span>;
};

export const KpiCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<any>;
  color?: string;
}) => {
  const formatted = fmt(value);
  return (
    <div className="ui-panel px-3 py-2 flex items-start gap-2 min-w-0">
      {Icon && (
        <Icon size={13} className="shrink-0 mt-0.5" style={{ color: 'var(--ui-text-faint)' }} />
      )}
      <div className="min-w-0 flex-1">
        <div className="ui-label truncate">{label}</div>
        <div className="ui-num text-sm font-bold truncate" style={{ color: 'var(--ui-text)' }} title={formatted}>
          {formatted}
        </div>
      </div>
    </div>
  );
};

export interface SummaryStripItem {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

const TONE_COLOR: Record<NonNullable<SummaryStripItem['tone']>, string> = {
  success: 'var(--ui-success)',
  warning: 'var(--ui-warning)',
  danger: 'var(--ui-danger)',
  neutral: 'var(--ui-text)',
};

export const SummaryStrip = ({ items }: { items: SummaryStripItem[] }) => (
  <div className="ui-panel flex flex-wrap divide-x divide-[var(--ui-border)] overflow-hidden">
    {items.map((item, idx) => {
      const formatted = fmt(item.value);
      const color = item.tone ? TONE_COLOR[item.tone] : 'var(--ui-text)';
      return (
        <div key={`${item.label}-${idx}`} className="px-3.5 py-2 min-w-[120px] flex-1">
          <div className="ui-label truncate">{item.label}</div>
          <div className="ui-num text-sm font-bold truncate" style={{ color }} title={formatted}>
            {formatted}
          </div>
          {item.hint && (
            <div className="ui-t-faint text-[11px] truncate" title={item.hint}>
              {item.hint}
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export const Section = ({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon?: React.ComponentType<any>;
  color?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-2.5">
    <div className="flex items-center gap-2 pb-1.5" style={{ borderBottom: '1px solid var(--ui-border)' }}>
      {Icon && <Icon size={14} style={{ color: color || 'var(--ui-text-muted)' }} />}
      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ui-text)' }}>
        {title}
      </h4>
    </div>
    {children}
  </div>
);

function isEmptyCell(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '\u2014' || trimmed === '-' || trimmed === 'N/A';
}

function isNumericCell(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (isEmptyCell(trimmed)) return false;
  return /^[+-]?(\d[\d\s\u00a0]*([.,]\d+)?([eE][+-]?\d+)?)\s*%?$/.test(trimmed)
    || /^<\s*0([.,]\d+)?$/.test(trimmed);
}

function isColumnNumeric(rows: any[][], colIdx: number): boolean {
  let hasValue = false;
  for (const row of rows) {
    const cell = row?.[colIdx];
    if (isEmptyCell(cell)) continue;
    hasValue = true;
    if (!isNumericCell(cell)) return false;
  }
  return hasValue;
}

function resolveNumericColumns(
  cols: string[],
  rows: any[][],
  numericColumns?: boolean[] | number[],
): boolean[] {
  if (!Array.isArray(numericColumns)) {
    return cols.map((_, idx) => isColumnNumeric(rows, idx));
  }
  if (numericColumns.length > 0 && typeof numericColumns[0] === 'number') {
    const indices = new Set(numericColumns as number[]);
    return cols.map((_, idx) => indices.has(idx));
  }
  return cols.map((_, idx) => Boolean((numericColumns as boolean[])[idx]));
}

export const DataTable = ({
  headers,
  columns,
  rows,
  numericColumns,
}: {
  headers?: string[];
  columns?: string[];
  rows: any[][];
  numericColumns?: boolean[] | number[];
}) => {
  const cols = headers ?? columns ?? [];
  const numCols = resolveNumericColumns(cols, rows, numericColumns);
  return (
    <div className="ui-panel ui-scroll overflow-x-auto">
      <table className="ui-table">
        <thead>
          <tr>
            {cols.map((h, idx) => (
              <th
                key={`${h}-${idx}`}
                className={numCols[idx] ? 'ui-th-num text-right' : undefined}
                style={numCols[idx] ? { textAlign: 'right' } : undefined}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} className={numCols[j] ? 'ui-td-num ui-num' : undefined}>
                  {fmt(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const RenderJson = ({ data }: { data: any }) => (
  <div className="ui-panel ui-scroll p-3 overflow-auto max-h-[500px]">
    <pre className="ui-mono ui-t-secondary whitespace-pre-wrap break-all leading-relaxed">
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);

export const getNodeLabel = (nodeType: string, nodeId: string) => {
  const labels: Record<string, string> = {
    dataset: 'Source de données',
    typing: 'Détection de types',
    cleaning: 'Nettoyage',
    transform: 'Transformation',
    computeVariable: 'Variable calculée',
    descriptiveNumeric: 'Stats numériques',
    descriptiveCategorical: 'Stats catégorielles',
    correlation: 'Corrélation',
    vif: 'VIF',
    testCompareMeans: 'Comparaison de moyennes',
    testCorrelation: 'Test de corrélation',
    testIndependence: "Test d'indépendance",
    testStationarity: 'Test de stationnarité',
    testNormality: 'Test de normalité',
    testAnova: 'ANOVA & Kruskal-Wallis',
    pca: 'ACP',
    ca: 'AFC',
    mca: 'ACM',
    clustering: 'Clustering',
    regression: 'Régression',
    classification: 'Classification',
    timeseries: 'Séries temporelles',
    multivariateTimeseries: 'Séries temporelles multivariées',
    simulation: 'Simulation',
    survival: 'Analyse de Survie',
    causal: 'Inférence Causale',
    manifold: 't-SNE & DBSCAN',
    garch: 'Volatilité GARCH',
    visualization: 'Graphique',
    ai: 'IA',
    extension: 'Extension',
    insights: 'Insights',
    output: 'Export de rapport',
  };
  return labels[nodeType] || nodeType || nodeId;
};
