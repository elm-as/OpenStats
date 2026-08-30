import React from 'react';

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
  <div className="flex-1 h-2.5 bg-surface-800 rounded-full overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }}
    />
  </div>
);

export const Badge = ({ children, color = '#6366f1' }: { children: React.ReactNode; color?: string }) => (
  <span
    className="inline-block text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
    style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
  >
    {children}
  </span>
);

export const KpiCard = ({
  label,
  value,
  icon: Icon,
  color = '#10b981',
}: {
  label: string;
  value: string | number;
  icon?: any;
  color?: string;
}) => (
  <div className="bg-surface-800/60 rounded-xl p-3 border border-white/[0.04] flex items-start gap-3">
    {Icon && (
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
        <Icon size={14} style={{ color }} />
      </div>
    )}
    <div className="min-w-0 flex-1">
      <div className="text-[10px] text-surface-400 uppercase font-bold tracking-wider mb-0.5 truncate">{label}</div>
      <div className="text-sm font-bold text-surface-100 font-mono break-words">{fmt(value)}</div>
    </div>
  </div>
);

export const Section = ({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon?: any;
  color?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
      {Icon && <Icon size={15} style={{ color }} />}
      <h4 className="text-sm font-bold text-surface-100">{title}</h4>
    </div>
    {children}
  </div>
);

export const DataTable = ({ headers, rows }: { headers: string[]; rows: any[][] }) => (
  <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-surface-900/50">
    <table className="w-full text-xs text-left whitespace-nowrap">
      <thead className="bg-surface-800/80 text-surface-400 uppercase">
        <tr>
          {headers.map(h => (
            <th key={h} className="px-3 py-2.5 font-bold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {rows.map((cells, i) => (
          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
            {cells.map((c, j) => (
              <td key={j} className="px-3 py-2 text-surface-200 font-mono">
                {fmt(c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const RenderJson = ({ data }: { data: any }) => (
  <div className="bg-surface-900/80 rounded-xl border border-white/[0.04] p-4 overflow-auto max-h-[500px]">
    <pre className="text-xs font-mono text-surface-300 whitespace-pre-wrap break-all leading-relaxed">
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

