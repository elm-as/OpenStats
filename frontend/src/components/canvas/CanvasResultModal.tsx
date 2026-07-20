import React from 'react';
import {
  X, BarChart2, AlertCircle, CheckCircle2, TrendingUp,
  Zap, Database, Hash, Layers, PieChart, ArrowUpRight, ArrowDownRight,
  Activity, Info, Grid3X3, FileText, Download
} from 'lucide-react';
import { ChartRenderer } from '../ChartBuilder';

interface CanvasResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTitle: string;
  nodeType: string;
  resultData: any;
  nodes?: any[];
  pipelineResults?: any;
}

/* ─── Helpers ─── */
const fmt = (v: unknown): string => {
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

const pctBar = (pct: number, color: string) => (
  <div className="flex-1 h-2.5 bg-surface-800 rounded-full overflow-hidden">
    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
  </div>
);

/* ─── Atoms ─── */
const Badge = ({ children, color = '#6366f1' }: { children: React.ReactNode; color?: string }) => (
  <span className="inline-block text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
    style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}>{children}</span>
);

const KpiCard = ({ label, value, icon: Icon, color = '#10b981' }: { label: string; value: string | number; icon?: any; color?: string }) => (
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

const Section = ({ title, icon: Icon, color, children }: { title: string; icon?: any; color?: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2.5 pb-2 border-b border-white/[0.04]">
      {Icon && <Icon size={15} style={{ color }} />}
      <h4 className="text-sm font-bold text-surface-100">{title}</h4>
    </div>
    {children}
  </div>
);

const DataTable = ({ headers, rows }: { headers: string[]; rows: any[][] }) => (
  <div className="overflow-x-auto rounded-xl border border-white/[0.04] bg-surface-900/50">
    <table className="w-full text-xs text-left whitespace-nowrap">
      <thead className="bg-surface-800/80 text-surface-400 uppercase">
        <tr>{headers.map(h => <th key={h} className="px-3 py-2.5 font-bold">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {rows.map((cells, i) => (
          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
            {cells.map((c, j) => <td key={j} className="px-3 py-2 text-surface-200 font-mono">{fmt(c)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ─── SVG Scatter Plot (for PCA, CA, MCA) ─── */
const SvgScatterPlot = ({ points, labelKey, colors, title, xLabel, yLabel, showCircle }: {
  points: { x: number; y: number; label: string; color?: string }[];
  labelKey?: string; colors?: string[]; title: string; xLabel: string; yLabel: string; showCircle?: boolean;
}) => {
  if (points.length === 0) return null;
  const W = 500, H = 360, PAD = 50;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const margin = 0.15;
  const xLo = xMin - xRange * margin, xHi = xMax + xRange * margin;
  const yLo = yMin - yRange * margin, yHi = yMax + yRange * margin;
  const sx = (v: number) => PAD + ((v - xLo) / (xHi - xLo)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - yLo) / (yHi - yLo)) * (H - 2 * PAD);
  const cx = sx(0), cy = sy(0);
  const palette = colors || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto">
      <p className="text-xs font-bold text-surface-300 mb-2">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px]" style={{ minWidth: 400 }}>
        {/* Axes */}
        <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        {/* Correlation circle */}
        {showCircle && <circle cx={cx} cy={cy} r={Math.min(sx(1) - sx(0), sy(0) - sy(1))} fill="none" stroke="#475569" strokeWidth="1" strokeDasharray="3,3" />}
        {/* Axis labels */}
        <text x={W / 2} y={H - 8} fill="#94a3b8" fontSize="11" textAnchor="middle">{xLabel}</text>
        <text x={14} y={H / 2} fill="#94a3b8" fontSize="11" textAnchor="middle" transform={`rotate(-90, 14, ${H / 2})`}>{yLabel}</text>
        {/* Points */}
        {points.map((p, i) => {
          const col = p.color || palette[i % palette.length];
          return (
            <g key={i}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={col} opacity={0.85} />
              {showCircle && <line x1={cx} y1={cy} x2={sx(p.x)} y2={sy(p.y)} stroke={col} strokeWidth="1" opacity={0.4} />}
              {points.length <= 30 && (
                <text x={sx(p.x) + 6} y={sy(p.y) - 6} fill="#cbd5e1" fontSize="9">{p.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/* ─── SVG Bar Chart (for Scree plot) ─── */
const SvgBarChart = ({ values, labels, title, color = '#06b6d4' }: {
  values: number[]; labels: string[]; title: string; color?: string;
}) => {
  if (values.length === 0) return null;
  const W = 500, H = 200, PAD = 50;
  const maxVal = Math.max(...values, 1);
  const barW = Math.min(40, (W - 2 * PAD) / values.length - 4);

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto">
      <p className="text-xs font-bold text-surface-300 mb-2">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px]" style={{ minWidth: 350 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
        {values.map((v, i) => {
          const x = PAD + (i + 0.5) * ((W - 2 * PAD) / values.length) - barW / 2;
          const barH = (v / maxVal) * (H - 2 * PAD);
          const pct = v > 1 ? v : v * 100;
          return (
            <g key={i}>
              <rect x={x} y={H - PAD - barH} width={barW} height={barH} fill={color} rx={3} opacity={0.8} />
              <text x={x + barW / 2} y={H - PAD - barH - 6} fill="#cbd5e1" fontSize="10" textAnchor="middle">{pct.toFixed(1)}%</text>
              <text x={x + barW / 2} y={H - PAD + 14} fill="#94a3b8" fontSize="9" textAnchor="middle">{labels[i]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};


/* ─── SVG Heatmap (for Confusion Matrix) ─── */
const SvgHeatmap = ({ matrix, labels, title, colorStart = '#1e293b', colorEnd = '#3b82f6' }: {
  matrix: number[][]; labels?: string[]; title: string; colorStart?: string; colorEnd?: string;
}) => {
  if (!matrix || matrix.length === 0) return null;
  const W = 300, H = 300, PAD_L = 60, PAD_B = 60, PAD_T = 30, PAD_R = 30;
  const n = matrix.length;
  const m = matrix[0].length;
  const cellW = (W - PAD_L - PAD_R) / m;
  const cellH = (H - PAD_T - PAD_B) / n;
  
  let maxVal = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (matrix[i][j] > maxVal) maxVal = matrix[i][j];
    }
  }

  const interpolateColor = (val: number) => {
    const pct = maxVal > 0 ? val / maxVal : 0;
    // Simple hex interpolation (assumes standard hex colors for start/end)
    const c1 = [parseInt(colorStart.slice(1,3),16), parseInt(colorStart.slice(3,5),16), parseInt(colorStart.slice(5,7),16)];
    const c2 = [parseInt(colorEnd.slice(1,3),16), parseInt(colorEnd.slice(3,5),16), parseInt(colorEnd.slice(5,7),16)];
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * pct);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * pct);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * pct);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto flex flex-col items-center">
      <p className="text-xs font-bold text-surface-300 mb-2 w-full text-left">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[400px]">
        {/* Y Axis Labels (True) */}
        <text x={PAD_L / 2} y={H / 2} fill="#94a3b8" fontSize="11" textAnchor="middle" transform={`rotate(-90, ${PAD_L / 2}, ${H / 2})`}>Réel</text>
        {labels?.map((lbl, i) => (
          <text key={`yl-${i}`} x={PAD_L - 8} y={PAD_T + (i + 0.5) * cellH + 4} fill="#cbd5e1" fontSize="10" textAnchor="end">{lbl}</text>
        ))}

        {/* X Axis Labels (Predicted) */}
        <text x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 10} fill="#94a3b8" fontSize="11" textAnchor="middle">Prédit</text>
        {labels?.map((lbl, j) => (
          <text key={`xl-${j}`} x={PAD_L + (j + 0.5) * cellW} y={H - PAD_B + 16} fill="#cbd5e1" fontSize="10" textAnchor="middle">{lbl}</text>
        ))}

        {/* Cells */}
        {matrix.map((row, i) => row.map((val, j) => (
          <g key={`cell-${i}-${j}`}>
            <rect x={PAD_L + j * cellW} y={PAD_T + i * cellH} width={cellW - 1} height={cellH - 1} fill={interpolateColor(val)} rx={2} />
            <text x={PAD_L + (j + 0.5) * cellW} y={PAD_T + (i + 0.5) * cellH + 4} fill={val > maxVal / 2 ? "#ffffff" : "#94a3b8"} fontSize="11" textAnchor="middle" fontWeight="bold">
              {val}
            </text>
          </g>
        )))}
      </svg>
    </div>
  );
};


/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

const getNodeLabel = (nodeType: string, nodeId: string) => {
  const labels: Record<string, string> = {
    dataset: 'Source de données', typing: 'Détection de types', cleaning: 'Nettoyage', transform: 'Transformation',
    computeVariable: 'Variable calculée', descriptiveNumeric: 'Stats numériques', descriptiveCategorical: 'Stats catégorielles',
    correlation: 'Corrélation', vif: 'VIF', testCompareMeans: 'Comparaison de moyennes', testCorrelation: 'Test de corrélation',
    testIndependence: 'Test d\'indépendance', testStationarity: 'Test de stationnarité',
    pca: 'ACP', ca: 'AFC', mca: 'ACM',
    clustering: 'Clustering', regression: 'Régression', classification: 'Classification',
    timeseries: 'Séries temporelles', multivariateTimeseries: 'Séries temporelles multivariées', simulation: 'Simulation',
    visualization: 'Graphique', ai: 'IA', extension: 'Extension', insights: 'Insights', output: 'Export de rapport',
  };
  return labels[nodeType] || nodeType || nodeId;
};

export default function CanvasResultModal({ isOpen, onClose, nodeTitle, nodeType, resultData, nodes, pipelineResults }: CanvasResultModalProps) {
  if (!isOpen) return null;

  const renderNodeResult = (nodeType: string, resultData: any) => {
    if (!resultData) return <div className="text-surface-400 italic text-sm p-4">Aucun resultat disponible.</div>;
    if (resultData.error) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm text-red-200 font-medium">{resultData.error}</p>
            {resultData.traceback && <pre className="text-[10px] text-red-300/60 mt-2 font-mono whitespace-pre-wrap max-h-40 overflow-auto">{resultData.traceback}</pre>}
          </div>
        </div>
      );
    }

    /* ── Dataset / Source ── */
    if (nodeType === 'dataset') {
      return (
        <div className="space-y-4">
          <Section title="Dataset charge" icon={Database} color="#10b981">
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Nom" value={resultData.name || '\u2014'} icon={Database} color="#10b981" />
              <KpiCard label="Lignes" value={resultData.rows ?? '\u2014'} icon={Hash} color="#3b82f6" />
              <KpiCard label="Colonnes" value={resultData.columns ?? '\u2014'} icon={Layers} color="#8b5cf6" />
            </div>
          </Section>
          {Array.isArray(resultData.head) && resultData.head.length > 0 && (() => {
            const cols = Object.keys(resultData.head[0]);
            return (
              <Section title={`Apercu (.head ${resultData.head.length} lignes)`} icon={Database} color="#8b5cf6">
                <DataTable headers={cols} rows={resultData.head.map((r: any) => cols.map(c => r[c]))} />
              </Section>
            );
          })()}
        </div>
      );
    }

    /* ── Typing ── */
    if (nodeType === 'typing') {
      const types = resultData.types || {};
      const total = resultData.columns || Object.values(types).reduce((a: number, b: any) => a + (b as number), 0);
      const palette = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#94a3b8', '#06b6d4'];
      return (
        <Section title={`${total} colonnes detectees`} icon={PieChart} color="#6366f1">
          <div className="space-y-2.5">
            {Object.entries(types).map(([type, count], idx) => {
              const pct = total > 0 ? ((count as number) / (total as number)) * 100 : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-surface-200 w-36 truncate capitalize">{type.replace(/_/g, ' ')}</span>
                  {pctBar(pct, palette[idx % palette.length])}
                  <span className="text-xs font-mono text-surface-300 w-20 text-right shrink-0">{count as number} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </Section>
      );
    }

    /* ── Cleaning ── */
    if (nodeType === 'cleaning') {
      return (
        <Section title="Resultat du nettoyage" icon={CheckCircle2} color="#f59e0b">
          <div className="grid grid-cols-2 gap-3">
            {resultData.shape_before && <KpiCard label="Avant" value={`${resultData.shape_before.rows} x ${resultData.shape_before.columns}`} icon={Database} color="#6b7280" />}
            {resultData.shape_after && <KpiCard label="Apres" value={`${resultData.shape_after.rows} x ${resultData.shape_after.columns}`} icon={Database} color="#10b981" />}
          </div>
          {Array.isArray(resultData.logs) && resultData.logs.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-bold text-surface-300 uppercase tracking-wider">Operations ({resultData.logs.length})</p>
              {resultData.logs.map((log: any, i: number) => (
                <div key={i} className="bg-surface-800/30 p-2.5 rounded-lg text-xs text-surface-300 flex items-center gap-2">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  {typeof log === 'string' ? log : log.message || log.action || JSON.stringify(log)}
                </div>
              ))}
            </div>
          )}
        </Section>
      );
    }

    /* ── Descriptive Stats ── */
    if (nodeType === 'descriptiveNumeric' || nodeType === 'descriptiveCategorical') {
      if (typeof resultData !== 'object' || resultData === null) return renderJson(resultData);
      const entries = Object.entries(resultData);
      return (
        <div className="space-y-4">
          <p className="text-xs text-surface-400">{entries.length} variable(s) analysee(s)</p>
          {entries.map(([colName, colStats]: [string, any]) => {
            if (typeof colStats !== 'object' || colStats === null) return null;
            const statEntries = Object.entries(colStats).filter(([k]) => k !== 'name' && k !== 'top_values');
            const topValues = colStats.top_values;
            return (
              <div key={colName} className="bg-surface-800/40 rounded-xl border border-white/[0.04] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.04] bg-surface-800/40 flex items-center gap-2">
                  <span className="text-xs font-bold text-surface-100 uppercase tracking-wider">{colName}</span>
                  {colStats.type && <Badge color={colStats.type === 'numeric' ? '#3b82f6' : '#8b5cf6'}>{colStats.type}</Badge>}
                </div>
                <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {statEntries.map(([key, val]) => (
                    <div key={key} className="bg-surface-900/50 rounded-lg px-3 py-2">
                      <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider truncate">{key.replace(/_/g, ' ')}</div>
                      <div className="text-[13px] text-surface-200 font-mono mt-0.5 truncate">
                        {typeof val === 'object' ? JSON.stringify(val) : fmt(val)}
                      </div>
                    </div>
                  ))}
                </div>
                {topValues && typeof topValues === 'object' && Object.keys(topValues).length > 0 && (
                  <div className="p-3 border-t border-white/[0.04]">
                    <SvgBarChart
                      values={Object.values(topValues) as number[]}
                      labels={Object.keys(topValues)}
                      title="Distribution des modalites principales"
                      color="#8b5cf6"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    /* ── Correlation ── */
    if (nodeType === 'correlation') {
      const matrix = resultData.matrix;
      const columns: string[] = resultData.columns || [];
      const method: string = resultData.method || 'pearson';
      const significantPairs: any[] = resultData.significant_pairs || [];
      if (!matrix || typeof matrix !== 'object' || columns.length === 0) return renderJson(resultData);

      return (
        <div className="space-y-5">
          <Section title={`Matrice de correlation ${method} (${columns.length} variables)`} icon={TrendingUp} color="#3b82f6">
            <div className="overflow-x-auto rounded-xl border border-white/[0.04]">
              <table className="w-full text-xs">
                <thead className="bg-surface-800/80 text-surface-400 uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold"></th>
                    {columns.map(c => <th key={c} className="px-3 py-2.5 font-bold text-center">{c}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {columns.map((rowKey, i) => (
                    <tr key={rowKey} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5 font-bold text-surface-200 bg-surface-800/30 sticky left-0">{rowKey}</td>
                      {columns.map((colKey, j) => {
                        const val = matrix[rowKey]?.[colKey];
                        const n = typeof val === 'number' ? val : parseFloat(val);
                        const bad = isNaN(n);
                        const diag = i === j;
                        const bg = bad || diag ? 'transparent' : n >= 0
                          ? `rgba(16,185,129,${Math.abs(n) * 0.4})`
                          : `rgba(239,68,68,${Math.abs(n) * 0.4})`;
                        return (
                          <td key={colKey} className="px-3 py-2.5 text-center font-mono" style={{ backgroundColor: bg }}>
                            <span className={diag ? 'text-surface-500' : 'text-surface-200'}>{bad ? '\u2014' : n.toFixed(2)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {significantPairs.length > 0 && (
            <Section title={`${significantPairs.length} paire(s) significative(s)`} icon={ArrowUpRight} color="#f59e0b">
              <div className="space-y-1.5">
                {significantPairs.slice(0, 15).map((p: any, i: number) => {
                  const r = p.coefficient ?? 0;
                  const c = r >= 0 ? '#10b981' : '#ef4444';
                  return (
                    <div key={i} className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-lg border border-white/[0.03]">
                      {r >= 0 ? <ArrowUpRight size={14} style={{ color: c }} /> : <ArrowDownRight size={14} style={{ color: c }} />}
                      <span className="text-xs text-surface-200 flex-1">{p.var1} / {p.var2}</span>
                      <Badge color={c}>{p.strength}</Badge>
                      <span className="text-xs font-mono font-bold" style={{ color: c }}>{fmt(r)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      );
    }

    /* ── VIF ── */
    if (nodeType === 'vif') {
      const vifData = Array.isArray(resultData) ? resultData : (resultData.vif || resultData);
      if (!Array.isArray(vifData)) return renderJson(resultData);
      return (
        <Section title="Facteur d'inflation de la variance" icon={AlertCircle} color="#f97316">
          <div className="space-y-2">
            {vifData.map((item: any, i: number) => {
              const val = item.vif || item.VIF || 0;
              const name = item.variable || item.feature || `Var ${i}`;
              const severity = val > 10 ? '#ef4444' : val > 5 ? '#f59e0b' : '#10b981';
              return (
                <div key={i} className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-lg border border-white/[0.03]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: severity }} />
                  <span className="text-xs font-semibold text-surface-200 flex-1">{name}</span>
                  <Badge color={severity}>{item.multicollinearity || (val > 10 ? 'severe' : val > 5 ? 'moderate' : 'low')}</Badge>
                  <span className="text-xs font-mono font-bold" style={{ color: severity }}>{fmt(val)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      );
    }

    /* ── Tests ── */
    if (['testCompareMeans', 'testCorrelation', 'testIndependence', 'testStationarity'].includes(nodeType)) {
      if (nodeType === 'testStationarity' && resultData.tests) {
        return (
          <div className="space-y-4">
            {resultData.tests.map((testResult: any, idx: number) => {
              const testName = testResult.test_name || testResult.test || 'Test';
              const pValue = testResult.p_value;
              const stat = testResult.statistic ?? testResult.coefficient;
              const conclusion = testResult.conclusion || testResult.interpretation;
              const significant = testResult.significant;
              return (
                <Section key={idx} title={`Stationnarité: ${testResult.column || `Variable ${idx+1}`}`} icon={Activity} color="#8b5cf6">
                  {conclusion && <div className="p-3 bg-surface-800/40 rounded-xl border border-white/[0.04] text-sm text-surface-200 mb-3 font-medium">{conclusion}</div>}
                  <div className="grid grid-cols-2 gap-3 mb-1">
                    {testResult.adf && (
                      <div className="bg-surface-800/60 p-3 rounded-lg border border-white/[0.04]">
                        <div className="text-xs font-bold text-surface-400 mb-2">Test ADF (Augmented Dickey-Fuller)</div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-surface-400">Statistique</span>
                          <span className="text-xs font-mono text-surface-200">{fmt(testResult.adf.statistic)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-surface-400">p-value</span>
                          <span className={`text-xs font-mono font-bold ${typeof testResult.adf.p_value === 'number' && testResult.adf.p_value < 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {testResult.adf.p_value === 0 ? '< 0.001' : fmt(testResult.adf.p_value)}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-2 pt-2 border-t border-white/[0.04] ${testResult.adf.is_stationary ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {testResult.adf.interpretation}
                        </div>
                      </div>
                    )}
                    {testResult.kpss && (
                      <div className="bg-surface-800/60 p-3 rounded-lg border border-white/[0.04]">
                        <div className="text-xs font-bold text-surface-400 mb-2">Test KPSS</div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-surface-400">Statistique</span>
                          <span className="text-xs font-mono text-surface-200">{fmt(testResult.kpss.statistic)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-surface-400">p-value</span>
                          <span className={`text-xs font-mono font-bold ${typeof testResult.kpss.p_value === 'number' && testResult.kpss.p_value > 0.05 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {testResult.kpss.p_value === 0.1 ? '>= 0.10' : fmt(testResult.kpss.p_value)}
                          </span>
                        </div>
                        <div className={`text-[10px] mt-2 pt-2 border-t border-white/[0.04] ${testResult.kpss.is_stationary ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {testResult.kpss.interpretation}
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              );
            })}
          </div>
        );
      }

      const testName = resultData.test_name || resultData.test || 'Test';
      const pValue = resultData.p_value;
      const stat = resultData.statistic ?? resultData.coefficient;
      const conclusion = resultData.conclusion || resultData.interpretation;
      const significant = resultData.significant;
      const effectSize = resultData.effect_size;
      return (
        <div className="space-y-4">
          <Section title="Resultat du test" icon={CheckCircle2} color="#8b5cf6">
            <div className="grid grid-cols-2 gap-3">
              <KpiCard label="Test" value={testName} color="#8b5cf6" />
              {stat !== undefined && <KpiCard label="Statistique" value={stat} icon={Hash} color="#3b82f6" />}
              {pValue !== undefined && (
                <KpiCard label="p-value" value={typeof pValue === 'number' ? (pValue < 0.001 ? pValue.toExponential(3) : pValue.toFixed(4)) : pValue}
                  icon={TrendingUp} color={typeof pValue === 'number' && pValue < 0.05 ? '#10b981' : '#f59e0b'} />
              )}
              {significant !== undefined && (
                <KpiCard label="Significatif" value={significant ? 'Oui (p < 0.05)' : 'Non (p >= 0.05)'} icon={significant ? CheckCircle2 : AlertCircle} color={significant ? '#10b981' : '#f59e0b'} />
              )}
            </div>
          </Section>
          {conclusion && <div className="p-3 bg-surface-800/40 rounded-xl border border-white/[0.04] text-sm text-surface-200">{conclusion}</div>}
          {resultData.is_stationary !== undefined && (
            <div className={`p-3 rounded-lg border text-sm font-medium ${resultData.is_stationary ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'}`}>
              {resultData.is_stationary ? 'La serie est stationnaire' : 'La serie n\'est pas stationnaire'}
            </div>
          )}
          {effectSize && typeof effectSize === 'object' && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(effectSize).map(([k, v]) => (
                <div key={k} className="bg-surface-800/30 rounded-lg px-3 py-2 border border-white/[0.03]">
                  <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">{k.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-surface-200 font-mono mt-0.5">{fmt(v)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    /* ── PCA / CA / MCA ── */
    if (['pca', 'ca', 'mca'].includes(nodeType)) {
      const evr = resultData.explained_variance_ratio || [];
      const cumVar = resultData.cumulative_variance || [];
      const eigenvalues = resultData.eigenvalues || [];
      const compLabels: string[] = resultData.component_labels || evr.map((_: any, i: number) => `CP${i + 1}`);
      const method = resultData.method || nodeType.toUpperCase();
      const nObs = resultData.n_observations;
      const nVars = resultData.n_variables || resultData.n_modalities;

      // --- Correlation circle / Variables plot ---
      const corrCircle = resultData.correlation_circle || resultData.loadings;
      const variablePoints: { x: number; y: number; label: string }[] = [];
      if (corrCircle && typeof corrCircle === 'object') {
        Object.entries(corrCircle).forEach(([varName, coords]: [string, any]) => {
          const x = coords.x ?? coords.CP1 ?? coords.Dim1 ?? 0;
          const y = coords.y ?? coords.CP2 ?? coords.Dim2 ?? 0;
          variablePoints.push({ x, y, label: varName });
        });
      }

      // --- Modality coords (for MCA) ---
      const modCoords = resultData.modality_coords;
      const modalityPoints: { x: number; y: number; label: string; color?: string }[] = [];
      if (modCoords && typeof modCoords === 'object') {
        const modInfo = resultData.modality_info || [];
        const varColors: Record<string, string> = {};
        const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
        let colorIdx = 0;
        Object.entries(modCoords).forEach(([modName, coords]: [string, any]) => {
          const info = modInfo.find((m: any) => m.full === modName);
          const varName = info?.variable || modName.split(':::')[0];
          if (!varColors[varName]) varColors[varName] = palette[colorIdx++ % palette.length];
          const x = coords.Dim1 ?? coords.CP1 ?? 0;
          const y = coords.Dim2 ?? coords.CP2 ?? 0;
          modalityPoints.push({ x, y, label: info?.modality || modName, color: varColors[varName] });
        });
      }

      // --- Individual scores (first 2 axes) ---
      const scores = resultData.scores || resultData.individual_coords;
      const individualPoints: { x: number; y: number; label: string }[] = [];
      if (Array.isArray(scores)) {
        scores.slice(0, 200).forEach((row: any, i: number) => {
          const x = row.CP1 ?? row.Dim1 ?? 0;
          const y = row.CP2 ?? row.Dim2 ?? 0;
          individualPoints.push({ x, y, label: `${i + 1}` });
        });
      }

      // --- Row/Col coords for CA ---
      const rowCoords = resultData.row_coords;
      const colCoords = resultData.col_coords;
      const caPoints: { x: number; y: number; label: string; color?: string }[] = [];
      if (rowCoords) {
        Object.entries(rowCoords).forEach(([lbl, c]: [string, any]) => {
          caPoints.push({ x: c.Dim1 ?? 0, y: c.Dim2 ?? 0, label: lbl, color: '#3b82f6' });
        });
      }
      if (colCoords) {
        Object.entries(colCoords).forEach(([lbl, c]: [string, any]) => {
          caPoints.push({ x: c.Dim1 ?? 0, y: c.Dim2 ?? 0, label: lbl, color: '#f59e0b' });
        });
      }

      // --- Contributions table (top variables) ---
      const contribVar = resultData.contrib_var;

      const ax1 = compLabels[0] || 'Axe 1';
      const ax2 = compLabels[1] || 'Axe 2';

      return (
        <div className="space-y-5">
          {/* Summary KPIs */}
          <Section title={`${method} - Resume`} icon={BarChart2} color="#06b6d4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {nObs && <KpiCard label="Observations" value={nObs} icon={Hash} color="#3b82f6" />}
              {nVars && <KpiCard label="Variables" value={nVars} icon={Layers} color="#8b5cf6" />}
              <KpiCard label="Composantes" value={resultData.n_components || evr.length} icon={BarChart2} color="#06b6d4" />
              {cumVar.length > 0 && (
                <KpiCard label="Var. cumulee (2 axes)" value={`${((cumVar[1] ?? cumVar[0] ?? 0) > 1 ? (cumVar[1] ?? cumVar[0]) : (cumVar[1] ?? cumVar[0]) * 100).toFixed(1)}%`} icon={TrendingUp} color="#10b981" />
              )}
            </div>
          </Section>

          {/* Scree plot */}
          {evr.length > 0 && (
            <SvgBarChart
              values={evr.map((v: number) => v > 1 ? v : v * 100)}
              labels={compLabels.slice(0, evr.length)}
              title="Eboulis des valeurs propres (% variance)"
              color="#06b6d4"
            />
          )}

          {/* Correlation circle (PCA) */}
          {variablePoints.length > 0 && (
            <SvgScatterPlot
              points={variablePoints}
              title={`Cercle des correlations (${ax1} vs ${ax2})`}
              xLabel={`${ax1} (${evr[0] ? ((evr[0] > 1 ? evr[0] : evr[0] * 100).toFixed(1)) : '?'}%)`}
              yLabel={`${ax2} (${evr[1] ? ((evr[1] > 1 ? evr[1] : evr[1] * 100).toFixed(1)) : '?'}%)`}
              showCircle={nodeType === 'pca'}
            />
          )}

          {/* Individuals plot (PCA) */}
          {individualPoints.length > 0 && (
            <SvgScatterPlot
              points={individualPoints}
              title={`Plan des individus (${ax1} vs ${ax2})`}
              xLabel={ax1}
              yLabel={ax2}
            />
          )}

          {/* CA biplot */}
          {caPoints.length > 0 && (
            <SvgScatterPlot
              points={caPoints}
              title={`Biplot AFC (${ax1} vs ${ax2})`}
              xLabel={ax1}
              yLabel={ax2}
            />
          )}

          {/* MCA modalities plot */}
          {modalityPoints.length > 0 && (
            <SvgScatterPlot
              points={modalityPoints}
              title={`Plan des modalites ACM (${ax1} vs ${ax2})`}
              xLabel={ax1}
              yLabel={ax2}
            />
          )}

          {/* Top contributions */}
          {contribVar && typeof contribVar === 'object' && (
            <Section title="Contributions des variables (%)" icon={BarChart2} color="#f59e0b">
              <DataTable
                headers={['Variable', ...compLabels.slice(0, 3)]}
                rows={Object.entries(contribVar).map(([v, comps]: [string, any]) => [
                  v,
                  ...compLabels.slice(0, 3).map(c => comps[c] ?? '\u2014'),
                ])}
              />
            </Section>
          )}
        </div>
      );
    }

    /* ── Clustering ── */
    if (nodeType === 'clustering') {
      const points = resultData.points || [];
      const hasPoints = Array.isArray(points) && points.length > 0;
      
      return (
        <div className="space-y-5">
          <Section title={`Clustering ${resultData.method || ''}`} icon={Layers} color="#06b6d4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {resultData.k && <KpiCard label="Nombre de clusters" value={resultData.k} icon={Layers} color="#06b6d4" />}
              {resultData.n_clusters !== undefined && <KpiCard label="Clusters detectes" value={resultData.n_clusters} icon={Layers} color="#06b6d4" />}
              {resultData.silhouette !== undefined && (
                <KpiCard label="Score Silhouette" value={resultData.silhouette} icon={BarChart2}
                  color={resultData.silhouette > 0.5 ? '#10b981' : resultData.silhouette > 0.25 ? '#f59e0b' : '#ef4444'} />
              )}
              {resultData.noise_points !== undefined && <KpiCard label="Points de bruit" value={resultData.noise_points} icon={AlertCircle} color="#ef4444" />}
            </div>
            {resultData.cluster_sizes && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(resultData.cluster_sizes).map(([k, v]) => {
                  // Fallback palette if missing
                  const hue = (parseInt(k) * 137.5) % 360; 
                  return (
                    <div key={k} className="flex items-center gap-3 bg-surface-800/40 px-3 py-2 rounded-lg border border-white/[0.04]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: `hsl(${hue}, 70%, 55%)` }} />
                      <span className="text-[11px] font-bold text-surface-200">Cluster {k}</span>
                      <span className="text-[11px] font-mono text-surface-400 ml-auto">{v as number}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
          
          {hasPoints && (
            <SvgScatterPlot
              points={points.map((p: any) => ({
                x: p.x, 
                y: p.y, 
                label: p.cluster === -1 ? 'Bruit' : `C${p.cluster}`,
                color: p.cluster === -1 ? '#64748b' : `hsl(${(p.cluster * 137.5) % 360}, 70%, 55%)`
              }))}
              title={`Projection des clusters (ACP 2D)`}
              xLabel="Composante 1"
              yLabel="Composante 2"
            />
          )}
        </div>
      );
    }

    /* ── Regression / Classification ── */
    if (nodeType === 'regression' || nodeType === 'classification') {
      // Backend returns: ranking (not rankings), best_model_key (not best_model_name), task_type, failed, diagnostics, data_split, shap, feature_names
      const ranking = resultData.ranking || resultData.rankings || [];
      const bestKey = resultData.best_model_key || resultData.best_model_name;
      const bestName = ranking.length > 0 ? ranking[0].model_name : bestKey;
      const taskType = resultData.task_type || nodeType;
      const dataSplit = resultData.data_split;
      const diagnostics = resultData.diagnostics;
      const failed = resultData.failed || [];

      return (
        <div className="space-y-5">
          {/* Best model banner */}
          {bestName && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <div>
                <div className="text-xs text-emerald-300/70 font-bold uppercase tracking-wider">Meilleur modele</div>
                <div className="text-sm font-bold text-emerald-200">{bestName}</div>
              </div>
              <Badge color="#10b981">{taskType}</Badge>
            </div>
          )}

          {/* Diagnostics warning */}
          {diagnostics?.quality_flag === 'critical' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
              {diagnostics.message || 'Qualite de prediction faible.'}
            </div>
          )}

          {/* Data split info */}
          {dataSplit && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Train" value={dataSplit.train_size ?? '\u2014'} icon={Database} color="#3b82f6" />
              <KpiCard label="Test" value={dataSplit.test_size ?? '\u2014'} icon={Database} color="#f59e0b" />
              <KpiCard label="Features" value={dataSplit.features?.length ?? '\u2014'} icon={Layers} color="#8b5cf6" />
              <KpiCard label="Strategie" value={dataSplit.strategy ?? 'random'} color="#06b6d4" />
            </div>
          )}

          {/* Ranking table */}
          {ranking.length > 0 && (() => {
            const metrics = ranking[0].metrics || {};
            const metricKeys = Object.keys(metrics).filter(k => k !== 'confusion_matrix' && k !== 'classification_report');
            const bestMetrics = ranking[0].metrics || {};
            const cm = bestMetrics.confusion_matrix;
            const labels = bestMetrics.classification_report ? 
              Object.keys(bestMetrics.classification_report).filter(k => !['accuracy', 'macro avg', 'weighted avg'].includes(k)) : undefined;

            return (
              <>
                <Section title={`Classement (${ranking.length} modeles)`} icon={TrendingUp} color="#8b5cf6">
                  <DataTable
                    headers={['#', 'Modele', ...metricKeys.map(k => k.toUpperCase())]}
                    rows={ranking.map((r: any, i: number) => [
                      i + 1,
                      r.model_name || r.model_key,
                      ...metricKeys.map(k => r.metrics?.[k]),
                    ])}
                  />
                </Section>
                {cm && Array.isArray(cm) && (
                  <Section title={`Matrice de confusion (Meilleur Modele)`} icon={Grid3X3} color="#ec4899">
                    <SvgHeatmap matrix={cm} labels={labels} title="Matrice de confusion" colorStart="#1e293b" colorEnd="#ec4899" />
                  </Section>
                )}
              </>
            );
          })()}

          {/* Feature importance of best model */}
          {ranking.length > 0 && ranking[0].feature_importance && ranking[0].feature_importance.length > 0 && (
            <Section title="Importance des features" icon={BarChart2} color="#f59e0b">
              <div className="space-y-1.5">
                {ranking[0].feature_importance.slice(0, 10).map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-surface-200 w-32 truncate">{f.feature}</span>
                    {pctBar((f.importance / (ranking[0].feature_importance[0]?.importance || 1)) * 100, '#f59e0b')}
                    <span className="text-xs font-mono text-surface-300 w-16 text-right">{fmt(f.importance)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Failed models */}
          {failed.length > 0 && (
            <Section title={`${failed.length} modele(s) echoue(s)`} icon={AlertCircle} color="#ef4444">
              <div className="space-y-1">
                {failed.map((f: any, i: number) => (
                  <div key={i} className="text-xs text-red-300/80 bg-red-500/5 p-2 rounded-lg">
                    <strong>{f.model_name || f.model_key}</strong>: {f.error}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      );
    }

    /* ── Insights ── */
    if (nodeType === 'insights') {
      const insights = resultData.insights || [];
      const severityColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981', info: '#3b82f6' };
      return (
        <Section title={`${insights.length} insight(s)`} icon={Zap} color="#a855f7">
          <div className="space-y-3">
            {Array.isArray(insights) ? insights.map((ins: any, idx: number) => {
              const sev = ins.severity || ins.type || 'info';
              const col = severityColors[sev] || '#6b7280';
              return (
                <div key={idx} className="bg-surface-800/40 rounded-xl p-4 border-l-[3px] border border-white/[0.03]" style={{ borderLeftColor: col }}>
                  <div className="flex items-start gap-3">
                    <Info size={16} className="shrink-0 mt-0.5" style={{ color: col }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-surface-100">{ins.title || 'Insight'}</span>
                        <Badge color={col}>{sev}</Badge>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{ins.description || ins.text}</p>
                    </div>
                  </div>
                </div>
              );
            }) : renderJson(resultData)}
          </div>
        </Section>
      );
    }

    /* ── Visualization ── */
    if (nodeType === 'visualization') {
      if (resultData.data && resultData.chart_type) {
        return (
          <Section title="Graphique généré" icon={BarChart2} color="#8b5cf6">
            <div className="bg-surface-900/50 rounded-xl border border-white/[0.04] p-1 overflow-hidden">
              <ChartRenderer 
                data={resultData} 
                chartType={resultData.chart_type as any} 
                yCols={resultData.series || (resultData.y_col ? [resultData.y_col] : [])} 
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <KpiCard label="Type" value={resultData.chart_type} icon={BarChart2} color="#8b5cf6" />
              {resultData.x_col && <KpiCard label="Axe X" value={resultData.x_col} color="#3b82f6" />}
              {resultData.y_col && <KpiCard label="Axe Y" value={resultData.y_col} color="#10b981" />}
              {resultData.color_col && <KpiCard label="Couleur" value={resultData.color_col} color="#ec4899" />}
            </div>
          </Section>
        );
      }
      return (
        <Section title="Configuration du graphique" icon={BarChart2} color="#8b5cf6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-sm text-amber-200">
            <AlertCircle className="text-amber-400 shrink-0" size={18} />
            <p>Le nœud n'a pas renvoyé de données graphiques. Vérifiez la configuration de vos colonnes.</p>
          </div>
        </Section>
      );
    }

    /* ── Output / Report ── */
    if (nodeType === 'output') {
      const format = resultData.format || 'pdf';
      const dsId = resultData.dataset_id;
      return (
        <Section title="Rapport d'analyse" icon={FileText} color="#10b981">
          <div className="bg-surface-800/40 p-4 rounded-xl border border-white/[0.04] text-center">
            <p className="text-sm text-surface-200 mb-6">
              Votre rapport au format <strong>{format.toUpperCase()}</strong> est prêt à être téléchargé.
            </p>
            {dsId ? (
              <a 
                href={`${import.meta.env.VITE_API_URL || ''}/api/v1/datasets/${dsId}/report/professional/${format}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Download size={18} />
                Télécharger le rapport
              </a>
            ) : (
              <div className="text-sm text-amber-400">Dataset ID introuvable. Impossible de générer le lien de téléchargement.</div>
            )}
          </div>
        </Section>
      );
    }

    /* ── Generic Fallback ── */
    return renderJson(resultData);
  };

  const renderContent = () => {
    if (nodeType === 'global') {
      const executedNodes = Object.entries(pipelineResults || {})
        .filter(([k, r]: any) => k !== '_global' && r.status === 'success');

      if (executedNodes.length === 0) {
        return <div className="text-surface-400 italic text-sm p-4 text-center">Aucun résultat d'analyse disponible pour le moment.</div>;
      }

      return (
        <div className="space-y-10 divide-y divide-white/[0.06]">
          {executedNodes.map(([nodeId, r]: any, idx) => {
            const node = nodes?.find(n => n.id === nodeId);
            const type = node?.type || '';
            const title = getNodeLabel(type, nodeId);
            
            return (
              <div key={nodeId} className={idx > 0 ? 'pt-8' : ''}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-1.5 h-5 bg-accent-500 rounded-full" />
                  <h3 className="text-sm font-bold text-strong uppercase tracking-wider">{title}</h3>
                </div>
                {renderNodeResult(type, r.result)}
              </div>
            );
          })}
        </div>
      );
    }
    return renderNodeResult(nodeType, resultData);
  };

  const renderJson = (data: any) => (
    <div className="bg-surface-900/80 rounded-xl border border-white/[0.04] p-4 overflow-auto max-h-[500px]">
      <pre className="text-xs font-mono text-surface-300 whitespace-pre-wrap break-all leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );

  const renderInsightsBlock = () => {
    const insights = resultData.insights || [];
    if (!Array.isArray(insights) || insights.length === 0) return null;
    
    const severityColors: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981', info: '#3b82f6', methodological: '#8b5cf6' };
    
    return (
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <Section title={`${insights.length} insight(s) genere(s)`} icon={Zap} color="#a855f7">
          <div className="space-y-3">
            {insights.map((ins: any, idx: number) => {
              const sev = ins.severity || ins.type || 'info';
              const col = severityColors[sev] || '#6b7280';
              const isTutorial = ins.tags?.includes('tutorial');
              const bgClass = isTutorial ? 'bg-indigo-900/40 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-surface-800/40 border-white/[0.03]';
              return (
                <div key={idx} className={`rounded-xl p-4 border-l-[3px] border ${bgClass}`} style={{ borderLeftColor: col }}>
                  <div className="flex items-start gap-3">
                    <Info size={16} className="shrink-0 mt-0.5" style={{ color: col }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-surface-100">{ins.title || 'Insight'}</span>
                        <Badge color={col}>{sev}</Badge>
                        {isTutorial && <Badge color="#8b5cf6">TUTORIEL</Badge>}
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">{ins.description || ins.text || ins.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-surface-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-surface-900 rounded-2xl shadow-[0_25px_80px_-12px_rgba(0,0,0,0.8)] border border-white/[0.08] flex flex-col max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-gradient-to-r from-surface-800/50 to-surface-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center border border-accent-500/20">
              <BarChart2 className="text-accent-400" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-surface-50">{nodeTitle}</h2>
              <p className="text-[11px] text-surface-400">Resultats detailles du bloc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-surface-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {renderContent()}
          {nodeType !== 'insights' && nodeType !== 'global' && renderInsightsBlock()}
        </div>
      </div>
    </div>
  );
}
