import React from 'react';
import { TrendingUp } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import { PlotlyChart } from '../viz/PlotlyBase';

export function CorrelationsTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de résultats de corrélation disponibles" />;

  const matrix = result.matrix || result.correlations || {};
  const cols = Object.keys(matrix);

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Matrice de corrélation
        </h3>

        {cols.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-2 text-surface-300"></th>
                  {cols.map(c => (
                    <th
                      key={c}
                      className="text-right py-2 px-1 text-surface-300 text-xs uppercase max-w-[80px] truncate"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map(row => (
                  <tr key={row} className="border-t border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-2 text-surface-200 text-xs font-medium truncate max-w-[80px]">
                      {row}
                    </td>
                    {cols.map(col => {
                      const val = matrix[row]?.[col];
                      const v = val !== undefined ? Number(val) : null;
                      const abs = v !== null ? Math.abs(v) : 0;
                      const isDiag = row === col;

                      return (
                        <td
                          key={col}
                          className={`py-2 px-1 text-center font-mono text-xs ${
                            isDiag ? 'text-surface-500' : abs > 0.7 ? 'font-semibold' : ''
                          }`}
                          style={{
                            backgroundColor: isDiag
                              ? 'transparent'
                              : v !== null
                              ? v > 0
                                ? `rgba(249,115,22,${abs * 0.25})`
                                : `rgba(37,99,235,${abs * 0.25})`
                              : 'transparent',
                            color: isDiag
                              ? '#6b7280'
                              : v !== null
                              ? v > 0
                                ? '#fb923c'
                                : '#60a5fa'
                              : '#9ca3af',
                          }}
                        >
                          {v !== null ? v.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Aucune variable numérique pour la corrélation" />
        )}

        {result.significant_pairs && result.significant_pairs.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-surface-200 mb-3">
              Corrélations significatives
            </h4>
            <div className="space-y-2">
              {result.significant_pairs.slice(0, 10).map((pair: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-surface-700/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">
                      {pair.var1}
                    </code>
                    <span className="text-surface-400">↔</span>
                    <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">
                      {pair.var2}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pair.coefficient > 0 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.abs(pair.coefficient) * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs font-mono font-bold ${
                        pair.coefficient > 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                    >
                      r = {pair.coefficient > 0 ? `+${pair.coefficient.toFixed(3)}` : pair.coefficient.toFixed(3)}
                    </span>
                    {pair.p_value !== undefined && (
                      <span className="text-[11px] font-mono text-surface-400">
                        (p {pair.p_value < 0.001 ? '< 0.001' : `= ${pair.p_value.toFixed(3)}`})
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-surface-400">{pair.strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.temporal_trends && result.temporal_trends.length > 0 && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <h4 className="text-sm font-medium text-surface-200 mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Tendances Temporelles (Évolution au fil du temps — non causale)
            </h4>
            <p className="text-xs text-surface-400 mb-3">
              Corrélation de chaque indicateur avec l'index chronologique <code className="text-cyan-300 bg-surface-700 px-1 py-0.5 rounded">{result.temporal_trends[0]?.time_col}</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {result.temporal_trends.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-surface-700/40 rounded-lg border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-surface-200">{t.variable}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      t.direction === 'croissante' ? 'bg-emerald-500/20 text-emerald-300' :
                      t.direction === 'décroissante' ? 'bg-rose-500/20 text-rose-300' : 'bg-surface-600 text-surface-300'
                    }`}>
                      {t.direction}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    r = {t.coefficient > 0 ? `+${t.coefficient.toFixed(3)}` : t.coefficient.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {cols.length > 1 && (
        <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
          <h4 className="text-sm font-medium text-surface-200 mb-4">Heatmap</h4>
          <PlotlyChart
            data={[
              {
                z: cols.map(row => cols.map(col => matrix[row]?.[col] || 0)),
                x: cols,
                y: cols,
                type: 'heatmap',
                colorscale: [
                  [0, '#2563eb'],
                  [0.5, '#1e293b'],
                  [1, '#f97316'],
                ],
                zmin: -1,
                zmax: 1,
                zmid: 0,
                showscale: true,
                hovertemplate: '<b>%{y} ↔ %{x}</b><br>r = %{z:.3f}<extra></extra>',
                colorbar: {
                  tickfont: { color: '#a3adc8' },
                  outlinecolor: 'rgba(255,255,255,0.1)',
                  outlinewidth: 1,
                },
              } as any,
            ]}
            layout={{
              margin: { t: 20, r: 80, b: 80, l: 100 },
              xaxis: { tickfont: { size: 10 }, tickangle: -45 },
              yaxis: { tickfont: { size: 10 } },
            }}
            config={{ displayModeBar: false }}
            height={400}
          />
        </div>
      )}
    </div>
  );
}
