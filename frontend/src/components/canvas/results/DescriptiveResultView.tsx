import React from 'react';
import {
  Database,
  Hash,
  Layers,
  PieChart,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Section, KpiCard, DataTable, Badge, pctBar, fmt, RenderJson } from './ResultAtoms';
import { SvgBarChart } from './ResultCharts';

export const DatasetResultView = ({ resultData }: { resultData: any }) => {
  return (
    <div className="space-y-4">
      <Section title="Dataset chargé" icon={Database} color="#10b981">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Nom" value={resultData.name || '\u2014'} icon={Database} color="#10b981" />
          <KpiCard label="Lignes" value={resultData.rows ?? '\u2014'} icon={Hash} color="#3b82f6" />
          <KpiCard label="Colonnes" value={resultData.columns ?? '\u2014'} icon={Layers} color="#8b5cf6" />
        </div>
      </Section>
      {Array.isArray(resultData.head) && resultData.head.length > 0 && (() => {
        const cols = Object.keys(resultData.head[0]);
        return (
          <Section title={`Aperçu (.head ${resultData.head.length} lignes)`} icon={Database} color="#8b5cf6">
            <DataTable headers={cols} rows={resultData.head.map((r: any) => cols.map(c => r[c]))} />
          </Section>
        );
      })()}
    </div>
  );
};

export const TypingResultView = ({ resultData }: { resultData: any }) => {
  const types = resultData.types || {};
  const total = resultData.columns || Object.values(types).reduce((a: number, b: any) => a + (b as number), 0);
  const palette = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#94a3b8', '#06b6d4'];
  return (
    <Section title={`${total} colonnes détectées`} icon={PieChart} color="#6366f1">
      <div className="space-y-2.5">
        {Object.entries(types).map(([type, count], idx) => {
          const pct = total > 0 ? ((count as number) / (total as number)) * 100 : 0;
          return (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-surface-200 w-36 truncate capitalize">
                {type.replace(/_/g, ' ')}
              </span>
              {pctBar(pct, palette[idx % palette.length])}
              <span className="text-xs font-mono text-surface-300 w-20 text-right shrink-0">
                {count as number} ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
};

export const CleaningResultView = ({ resultData }: { resultData: any }) => {
  return (
    <Section title="Résultat du nettoyage" icon={CheckCircle2} color="#f59e0b">
      <div className="grid grid-cols-2 gap-3">
        {resultData.shape_before && (
          <KpiCard
            label="Avant"
            value={`${resultData.shape_before.rows} x ${resultData.shape_before.columns}`}
            icon={Database}
            color="#6b7280"
          />
        )}
        {resultData.shape_after && (
          <KpiCard
            label="Après"
            value={`${resultData.shape_after.rows} x ${resultData.shape_after.columns}`}
            icon={Database}
            color="#10b981"
          />
        )}
      </div>
      {Array.isArray(resultData.logs) && resultData.logs.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-bold text-surface-300 uppercase tracking-wider">
            Opérations ({resultData.logs.length})
          </p>
          {resultData.logs.map((log: any, i: number) => (
            <div
              key={i}
              className="bg-surface-800/30 p-2.5 rounded-lg text-xs text-surface-300 flex items-center gap-2"
            >
              <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
              {typeof log === 'string' ? log : log.message || log.action || JSON.stringify(log)}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

export const DescriptiveStatsResultView = ({ resultData }: { resultData: any }) => {
  if (typeof resultData !== 'object' || resultData === null) return <RenderJson data={resultData} />;

  const cols = Object.keys(resultData);
  if (cols.length === 0) return <div className="text-surface-400 text-sm">Aucune donnée trouvée.</div>;

  const allMetrics = new Set<string>();
  cols.forEach(c => {
    if (typeof resultData[c] === 'object' && resultData[c] !== null) {
      Object.keys(resultData[c]).forEach(k => {
        if (k !== 'name' && k !== 'type' && k !== 'top_values') {
          allMetrics.add(k);
        }
      });
    }
  });

  const orderedMetrics = [
    'count', 'mean', 'median', 'std', 'min', 'q1', 'q3', 'max', 'iqr',
    'null_count', 'null_rate', 'unique_values', 'mode'
  ];
  const metricsList = Array.from(allMetrics).sort((a, b) => {
    const ia = orderedMetrics.indexOf(a);
    const ib = orderedMetrics.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-4 overflow-hidden">
      <p className="text-xs font-semibold text-surface-400">{cols.length} variable(s) analysée(s)</p>
      <div className="overflow-x-auto custom-scrollbar bg-surface-800/40 border border-white/[0.04] rounded-xl">
        <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-white/[0.04] bg-surface-800/80">
              <th className="p-3 font-semibold text-surface-300">Variable</th>
              {metricsList.map(m => (
                <th key={m} className="p-3 font-semibold text-surface-300 text-right capitalize">
                  {m.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {cols.map(colName => {
              const colStats = resultData[colName];
              if (typeof colStats !== 'object' || colStats === null) return null;
              return (
                <tr key={colName} className="hover:bg-surface-800/50 transition-colors">
                  <td className="p-3 text-surface-100 font-bold sticky left-0 bg-surface-800/80 shadow-[1px_0_0_0_rgba(255,255,255,0.02)]">
                    {colName}
                    {colStats.type && (
                      <span className="ml-2 text-[9px] text-surface-500 uppercase bg-surface-900/50 px-1 py-0.5 rounded">
                        {colStats.type}
                      </span>
                    )}
                  </td>
                  {metricsList.map(m => (
                    <td key={m} className="p-3 text-surface-300 text-right font-mono text-[11px]">
                      {colStats[m] !== undefined && colStats[m] !== null
                        ? typeof colStats[m] === 'object'
                          ? JSON.stringify(colStats[m])
                          : fmt(colStats[m])
                        : '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {cols.map(colName => {
          const topValues = resultData[colName]?.top_values;
          if (!topValues || typeof topValues !== 'object' || Object.keys(topValues).length === 0) return null;
          return (
            <div key={`${colName}-top`} className="bg-surface-800/40 rounded-xl p-3 border border-white/[0.04]">
              <p className="text-xs font-bold text-surface-200 mb-2 truncate">Top modalités : {colName}</p>
              <SvgBarChart
                values={Object.values(topValues) as number[]}
                labels={Object.keys(topValues)}
                title=""
                color="#8b5cf6"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const CorrelationResultView = ({ resultData }: { resultData: any }) => {
  const matrix = resultData.matrix;
  const columns: string[] = resultData.columns || [];
  const method: string = resultData.method || 'pearson';
  const significantPairs: any[] = resultData.significant_pairs || [];
  if (!matrix || typeof matrix !== 'object' || columns.length === 0) return <RenderJson data={resultData} />;

  return (
    <div className="space-y-5">
      <Section title={`Matrice de corrélation ${method} (${columns.length} variables)`} icon={TrendingUp} color="#3b82f6">
        <div className="overflow-x-auto rounded-xl border border-white/[0.04]">
          <table className="w-full text-xs">
            <thead className="bg-surface-800/80 text-surface-400 uppercase">
              <tr>
                <th className="px-3 py-2.5 text-left font-bold" />
                {columns.map(c => (
                  <th key={c} className="px-3 py-2.5 font-bold text-center">
                    {c}
                  </th>
                ))}
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
                    const bg =
                      bad || diag
                        ? 'transparent'
                        : n >= 0
                        ? `rgba(16,185,129,${Math.abs(n) * 0.4})`
                        : `rgba(239,68,68,${Math.abs(n) * 0.4})`;
                    return (
                      <td key={colKey} className="px-3 py-2.5 text-center font-mono" style={{ backgroundColor: bg }}>
                        <span className={diag ? 'text-surface-500' : 'text-surface-200'}>
                          {bad ? '\u2014' : n.toFixed(2)}
                        </span>
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
                <div
                  key={i}
                  className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-lg border border-white/[0.03]"
                >
                  {r >= 0 ? <ArrowUpRight size={14} style={{ color: c }} /> : <ArrowDownRight size={14} style={{ color: c }} />}
                  <span className="text-xs text-surface-200 flex-1">
                    {p.var1} / {p.var2}
                  </span>
                  <Badge color={c}>{p.strength}</Badge>
                  <span className="text-xs font-mono font-bold" style={{ color: c }}>
                    {fmt(r)}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
};

export const VifResultView = ({ resultData }: { resultData: any }) => {
  const vifData = Array.isArray(resultData) ? resultData : resultData.vif || resultData;
  if (!Array.isArray(vifData)) return <RenderJson data={resultData} />;
  return (
    <Section title="Facteur d'inflation de la variance" icon={AlertCircle} color="#f97316">
      <div className="space-y-2">
        {vifData.map((item: any, i: number) => {
          const val = item.vif || item.VIF || 0;
          const name = item.variable || item.feature || `Var ${i}`;
          const severity = val > 10 ? '#ef4444' : val > 5 ? '#f59e0b' : '#10b981';
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-lg border border-white/[0.03]"
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: severity }} />
              <span className="text-xs font-semibold text-surface-200 flex-1">{name}</span>
              <Badge color={severity}>
                {item.multicollinearity || (val > 10 ? 'severe' : val > 5 ? 'moderate' : 'low')}
              </Badge>
              <span className="text-xs font-mono font-bold" style={{ color: severity }}>
                {fmt(val)}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
  );
};
