import { useState, useMemo } from 'react';
import { useRunAnalysisMutation } from '../store/api';
import type { DescriptiveStats, CorrelationResult } from '../types';
import { TrendingUp, Activity, BarChart3 as BarIcon, AlertTriangle, Play } from 'lucide-react';
import { CorrelationHeatmap } from './viz';
import { Card, Badge, Button, Section } from './ui';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from './viz/PlotlyBase';

interface Props {
  datasetId: string;
}

export default function AnalysisPanel({ datasetId }: Props) {
  const [runAnalysis, { isLoading }] = useRunAnalysisMutation();
  const [stats, setStats] = useState<DescriptiveStats | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult | null>(null);
  const [vif, setVif] = useState<{ variable: string; vif: number; multicollinearity: string }[]>([]);

  const handleAnalyze = async () => {
    try {
      const result = await runAnalysis(datasetId).unwrap();
      setStats(result.descriptive_stats as DescriptiveStats);
      setCorrelations((result.correlations as Record<string, CorrelationResult>)?.pearson || null);
      setVif(result.vif as typeof vif);
    } catch (err) {
      console.error(err);
    }
  };

  const nullityData = useMemo(() => {
    if (!stats) return null;
    const entries = Object.entries(stats).filter(([, s]) => (s as any).null_rate > 0);
    if (entries.length === 0) return null;
    return {
      x: entries.map(([col]) => (col.length > 18 ? col.slice(0, 18) + '…' : col)),
      y: entries.map(([, s]) => (s as any).null_rate * 100),
      colors: entries.map(([, s]) => {
        const r = (s as any).null_rate;
        if (r >= 0.5) return '#ef4444';
        if (r >= 0.2) return '#f59e0b';
        return '#06b6d4';
      }),
    };
  }, [stats]);

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h2 className="text-strong">Analyse exploratoire</h2>
          <p className="text-muted text-sm mt-1">Statistiques descriptives, corrélations et diagnostics</p>
        </div>
        <Button onClick={handleAnalyze} disabled={isLoading} loading={isLoading} icon={<Play className="w-4 h-4" />}>
          {isLoading ? 'Calcul en cours…' : "Lancer l'analyse"}
        </Button>
      </div>

      {stats && (
        <>
          {/* Statistiques descriptives */}
          <Section title="Statistiques descriptives" icon={<Activity className="w-4 h-4 text-accent-400" />}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th className="text-right">Moyenne</th>
                    <th className="text-right">Médiane</th>
                    <th className="text-right">Écart-type</th>
                    <th className="text-right">Asymétrie</th>
                    <th className="text-right">Kurtosis</th>
                    <th className="text-right">Manquants</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(stats)
                    .filter(([, s]) => (s as any).type === 'numeric')
                    .map(([col, s]) => (
                      <tr key={col}>
                        <td className="font-medium text-strong">{col}</td>
                        <td className="text-right num">{fmt((s as any).mean)}</td>
                        <td className="text-right num">{fmt((s as any).median)}</td>
                        <td className="text-right num">{fmt((s as any).std)}</td>
                        <td className="text-right num">{fmt((s as any).skewness)}</td>
                        <td className="text-right num">{fmt((s as any).kurtosis)}</td>
                        <td className="text-right num text-muted">{((s as any).null_rate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Graphique nullité Plotly */}
          {nullityData && (
            <Card>
              <h3 className="text-strong mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Taux de valeurs manquantes
              </h3>
              <Plot
                data={[{
                  x: nullityData.x,
                  y: nullityData.y,
                  type: 'bar',
                  marker: { color: nullityData.colors, line: { color: 'rgba(255,255,255,0.1)', width: 0.5 } },
                  hovertemplate: '<b>%{x}</b><br>%{y:.1f}% manquants<extra></extra>',
                }]}
                layout={{
                  ...DARK_TEMPLATE,
                  height: 320,
                  autosize: true,
                  xaxis: { ...DARK_TEMPLATE.xaxis, tickangle: -30 },
                  yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: 'Taux (%)', font: { color: '#dfe3ee' } }, range: [0, 100] },
                  margin: { l: 50, r: 10, t: 10, b: 80 },
                  shapes: [
                    { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 50, y1: 50, line: { color: '#ef4444', width: 1, dash: 'dot' } },
                    { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 20, y1: 20, line: { color: '#f59e0b', width: 1, dash: 'dot' } },
                  ],
                }}
                config={DEFAULT_CONFIG}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </Card>
          )}
        </>
      )}

      {/* Heatmap corrélations */}
      {correlations && correlations.matrix && Object.keys(correlations.matrix).length >= 2 && (
        <Section
          title="Matrice de corrélation"
          subtitle={`Méthode ${correlations.method}, clustering hiérarchique`}
          icon={<TrendingUp className="w-4 h-4 text-accent-400" />}
        >
          <Card>
            <CorrelationHeatmap matrix={correlations.matrix} cluster showValues />
          </Card>
        </Section>
      )}

      {/* Corrélations significatives */}
      {correlations && correlations.significant_pairs.length > 0 && (
        <Section
          title="Corrélations significatives"
          subtitle={`${correlations.significant_pairs.length} paire(s) — méthode ${correlations.method}`}
          icon={<TrendingUp className="w-4 h-4 text-accent-400" />}
        >
          <div className="space-y-1.5">
            {correlations.significant_pairs.slice(0, 20).map((pair, i) => {
              const strength = pair.strength === 'fort' ? 'danger' : pair.strength === 'modéré' ? 'warning' : 'info';
              return (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <span className="font-medium text-strong truncate">{pair.var1}</span>
                    <span className="text-muted text-xs">↔</span>
                    <span className="font-medium text-strong truncate">{pair.var2}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <CorrelationBar value={pair.coefficient} />
                    <span className="num text-sm w-16 text-right text-default">{pair.coefficient.toFixed(3)}</span>
                    <Badge variant={strength as any}>{pair.strength}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* VIF */}
      {vif.length > 0 && (
        <Section
          title="Multicolinéarité (VIF)"
          subtitle="Variance Inflation Factor — seuil critique ≥ 10"
          icon={<BarIcon className="w-4 h-4 text-accent-400" />}
        >
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th className="text-right">VIF</th>
                  <th>Diagnostic</th>
                </tr>
              </thead>
              <tbody>
                {vif.map((v) => (
                  <tr key={v.variable}>
                    <td className="font-medium text-strong">{v.variable}</td>
                    <td className="text-right num">{v.vif.toFixed(2)}</td>
                    <td>
                      <Badge variant={
                        v.multicollinearity === 'severe' ? 'danger'
                          : v.multicollinearity === 'moderate' ? 'warning'
                          : 'success'
                      }>
                        {v.multicollinearity}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

function CorrelationBar({ value }: { value: number }) {
  const width = Math.abs(value) * 100;
  const color = value >= 0 ? '#22d3ee' : '#f87171';
  return (
    <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

function fmt(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(3);
}
