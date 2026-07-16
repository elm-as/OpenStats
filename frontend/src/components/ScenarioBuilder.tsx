import { useState, useMemo } from 'react';
import {
  useCreatePresetScenariosMutation,
  useRunScenariosMutation,
  useGetTornadoMutation,
  useRunMonteCarloMutation,
  useRunStressTestMutation,
  useGetSensitivityMutation,
} from '../store/api';
import { ArrowLeft, Play, BarChart2, Activity, Zap, TrendingUp, AlertOctagon } from 'lucide-react';
import { TornadoChart, MonteCarloDistribution } from './viz';
import { Card, Badge, Button, Section, Stat, StatGrid } from './ui';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from './viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  datasetId: string;
  onBack: () => void;
}

type Tab = 'scenarios' | 'tornado' | 'sensitivity' | 'montecarlo' | 'stress';

export default function ScenarioBuilder({ datasetId, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [createPresets, { isLoading: creatingPresets }] = useCreatePresetScenariosMutation();
  const [runScenarios, { isLoading: runningScenarios, data: scenarioResults }] = useRunScenariosMutation();
  const [getTornado, { isLoading: loadingTornado, data: tornadoData }] = useGetTornadoMutation();
  const [runMonteCarlo, { isLoading: loadingMC, data: mcData }] = useRunMonteCarloMutation();
  const [runStressTest, { isLoading: loadingStress, data: stressData }] = useRunStressTestMutation();
  const [getSensitivity, { isLoading: loadingSensitivity, data: sensitivityData }] = useGetSensitivityMutation();
  const [error, setError] = useState<string | null>(null);
  const [mcConfig, setMcConfig] = useState({ n_simulations: 1000, noise_scale: 1.0 });

  const handleRunPresets = async () => {
    setError(null);
    try {
      await createPresets({ id: datasetId }).unwrap();
      const result = await runScenarios({ id: datasetId, scenario_names: ['pessimiste', 'central', 'optimiste'] }).unwrap();
      if (!result) setError('Pas de résultats');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleTornado = async () => {
    setError(null);
    try { await getTornado({ id: datasetId, sigma: 1.0 }).unwrap(); }
    catch (e: any) { setError(e?.data?.error || e?.message || 'Erreur'); }
  };

  const handleSensitivity = async () => {
    setError(null);
    try { await getSensitivity({ id: datasetId, n_points: 25 }).unwrap(); }
    catch (e: any) { setError(e?.data?.error || e?.message || 'Erreur'); }
  };

  const handleMonteCarlo = async () => {
    setError(null);
    try { await runMonteCarlo({ id: datasetId, ...mcConfig }).unwrap(); }
    catch (e: any) { setError(e?.data?.error || e?.message || 'Erreur'); }
  };

  const handleStressTest = async () => {
    setError(null);
    try { await runStressTest({ id: datasetId, sigmas: [1.0, 2.0] }).unwrap(); }
    catch (e: any) { setError(e?.data?.error || e?.message || 'Erreur'); }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'scenarios',   label: 'Scénarios',    icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'tornado',     label: 'Tornado',      icon: <Activity className="w-4 h-4" /> },
    { key: 'sensitivity', label: 'Sensibilité',  icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'montecarlo',  label: 'Monte Carlo',  icon: <Zap className="w-4 h-4" /> },
    { key: 'stress',      label: 'Stress Test',  icon: <AlertOctagon className="w-4 h-4" /> },
  ];

  // Construire les données Tornado pour le composant
  const tornadoVariables = useMemo(() => {
    if (!tornadoData?.bars) return [];
    return tornadoData.bars.map((b: any) => ({
      name: b.variable,
      low: b.low ?? (tornadoData.baseline_prediction - b.swing),
      high: b.high ?? (tornadoData.baseline_prediction + b.swing),
    }));
  }, [tornadoData]);

  // MC values
  const mcValues = useMemo<number[]>(() => {
    if (!mcData?.histogram) return [];
    // Reconstituer une "distribution" approximative à partir de l'histogramme
    const out: number[] = [];
    mcData.histogram.bin_centers.forEach((c, i) => {
      const n = mcData.histogram.counts[i];
      for (let k = 0; k < n; k++) out.push(c);
    });
    return out;
  }, [mcData]);

  return (
    <div className="section">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-accent-400" />
          <h3 className="section-title">Scénarios &amp; simulation</h3>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Retour
        </Button>
      </div>

      {error && (
        <Card variant="flat" className="!bg-red-500/5 !border-red-500/30">
          <p className="text-red-300 text-sm">{error}</p>
        </Card>
      )}

      {/* Onglets */}
      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/8">
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors focus-ring ${
                active
                  ? 'bg-accent-500/15 text-accent-200 shadow-[0_0_0_1px_rgba(6,182,212,0.25)]'
                  : 'text-muted hover:text-default hover:bg-white/5'
              }`}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Scénarios prédéfinis ─── */}
      {activeTab === 'scenarios' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Comparaison pessimiste / central / optimiste</h4>
            <p className="text-muted text-sm">
              Crée 3 scénarios basés sur les quantiles Q10, Q50, Q90 de chaque variable et compare les prédictions du modèle.
            </p>
          </div>
          <Button
            onClick={handleRunPresets}
            disabled={creatingPresets || runningScenarios}
            loading={creatingPresets || runningScenarios}
            icon={<Play className="w-4 h-4" />}
          >
            {creatingPresets || runningScenarios ? 'Exécution…' : 'Lancer la comparaison'}
          </Button>

          {scenarioResults && (
            <div className="mt-5 space-y-3">
              <h5 className="text-strong text-sm font-medium">Résultats</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {scenarioResults.comparison.scenarios.map(sc => {
                  const tone =
                    sc.name === 'pessimiste' ? 'border-red-500/30 bg-red-500/5'
                    : sc.name === 'optimiste' ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-accent-500/30 bg-accent-500/5';
                  return (
                    <div key={sc.name} className={`rounded-lg p-4 border ${tone}`}>
                      <div className="text-xs uppercase tracking-wider text-muted mb-1">{sc.name}</div>
                      <div className="text-2xl font-bold text-strong num">{sc.predictions_mean.toFixed(2)}</div>
                      {!sc.is_baseline && sc.pct_change !== null && (
                        <div className={`text-sm mt-1 num ${sc.pct_change > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                          {sc.pct_change > 0 ? '+' : ''}{sc.pct_change.toFixed(1)}% vs central
                        </div>
                      )}
                      {sc.is_baseline && (
                        <Badge variant="info" className="mt-1">Référence</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted flex gap-3">
                <span>Amplitude : <span className="text-default num">{scenarioResults.comparison.spread.toFixed(2)}</span></span>
                <span>Type : <span className="text-default">{scenarioResults.task_type}</span></span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ─── Tornado Plotly ─── */}
      {activeTab === 'tornado' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Diagramme Tornado</h4>
            <p className="text-muted text-sm">
              Impact de chaque variable lorsqu'elle varie de ±1 écart-type autour de sa moyenne.
            </p>
          </div>
          <Button onClick={handleTornado} disabled={loadingTornado} loading={loadingTornado} icon={<Play className="w-4 h-4" />}>
            {loadingTornado ? 'Calcul…' : 'Générer le tornado'}
          </Button>

          {tornadoData && (
            <div className="mt-5 space-y-3">
              <Badge variant="info">
                Prédiction de base : <span className="num ml-1">{tornadoData.baseline_prediction.toFixed(3)}</span>
              </Badge>
              <TornadoChart
                variables={tornadoVariables}
                baseline={tornadoData.baseline_prediction}
                title=""
              />
            </div>
          )}
        </Card>
      )}

      {/* ─── Analyse de sensibilité ─── */}
      {activeTab === 'sensitivity' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Analyse de sensibilité</h4>
            <p className="text-muted text-sm">
              Fait varier chaque variable individuellement et observe l'impact sur la prédiction.
            </p>
          </div>
          <Button onClick={handleSensitivity} disabled={loadingSensitivity} loading={loadingSensitivity} icon={<Play className="w-4 h-4" />}>
            {loadingSensitivity ? 'Calcul…' : 'Lancer'}
          </Button>

          {sensitivityData && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {sensitivityData.analyses.map((analysis, idx) => (
                <SensitivityCurve key={idx} analysis={analysis} colorIdx={idx} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ─── Monte Carlo Plotly ─── */}
      {activeTab === 'montecarlo' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Simulation Monte Carlo</h4>
            <p className="text-muted text-sm">
              Perturbe aléatoirement toutes les variables pour estimer la distribution des prédictions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Simulations</label>
              <input
                type="number"
                className="w-32"
                value={mcConfig.n_simulations}
                onChange={e => setMcConfig(prev => ({ ...prev, n_simulations: Math.min(10000, Math.max(100, +e.target.value)) }))}
                min={100}
                max={10000}
                title="Nombre de simulations"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Bruit (σ)</label>
              <input
                type="number"
                className="w-24"
                value={mcConfig.noise_scale}
                onChange={e => setMcConfig(prev => ({ ...prev, noise_scale: Math.max(0.1, +e.target.value) }))}
                min={0.1}
                max={5}
                step={0.1}
                title="Amplitude du bruit"
              />
            </div>
            <Button onClick={handleMonteCarlo} disabled={loadingMC} loading={loadingMC} icon={<Play className="w-4 h-4" />}>
              {loadingMC ? 'Simulation…' : 'Lancer'}
            </Button>
          </div>

          {mcData && (
            <div className="space-y-4">
              <StatGrid>
                <Stat label="Moyenne" value={mcData.distribution.mean.toFixed(3)} />
                <Stat label="Écart-type" value={mcData.distribution.std.toFixed(3)} />
                <Stat label="Médiane" value={mcData.distribution.median.toFixed(3)} />
                <Stat label="IC 90%" value={`[${mcData.distribution.q05.toFixed(2)} ; ${mcData.distribution.q95.toFixed(2)}]`} />
              </StatGrid>
              <MonteCarloDistribution
                values={mcValues}
                quantiles={[0.05, 0.5, 0.95]}
                title={`Distribution des prédictions (${mcData.n_simulations} simulations)`}
              />
            </div>
          )}
        </Card>
      )}

      {/* ─── Stress Test ─── */}
      {activeTab === 'stress' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Stress Test</h4>
            <p className="text-muted text-sm">
              Applique des chocs de ±1σ et ±2σ sur chaque variable et mesure l'impact sur la prédiction.
            </p>
          </div>
          <Button onClick={handleStressTest} disabled={loadingStress} loading={loadingStress} icon={<Play className="w-4 h-4" />}>
            {loadingStress ? 'Calcul…' : 'Lancer'}
          </Button>

          {stressData && (
            <div className="mt-5 space-y-3">
              <Badge variant="info">
                Prédiction de base : <span className="num ml-1">{stressData.baseline_prediction.toFixed(3)}</span>
              </Badge>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Variable</th>
                      {stressData.sigmas_tested.flatMap(s => [
                        <th key={`-${s}`} className="text-center text-red-300">−{s}σ</th>,
                        <th key={`+${s}`} className="text-center text-emerald-300">+{s}σ</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {stressData.variables.map((v, i) => (
                      <tr key={i}>
                        <td className="font-medium text-strong">{v.variable}</td>
                        {v.shocks.map((shock, j) => (
                          <td key={j} className="text-center">
                            <div className={`text-xs num font-medium ${shock.impact > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                              {shock.impact > 0 ? '+' : ''}{shock.impact.toFixed(3)}
                            </div>
                            {shock.impact_pct !== null && (
                              <div className="text-xs text-muted num">
                                ({shock.impact_pct > 0 ? '+' : ''}{shock.impact_pct.toFixed(1)}%)
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Courbe de sensibilité Plotly ──
function SensitivityCurve({ analysis, colorIdx }: { analysis: any; colorIdx: number }) {
  const color = SCI_COLORS[colorIdx % SCI_COLORS.length];
  const traces: Data[] = [{
    x: analysis.points.map((p: any) => p.value),
    y: analysis.points.map((p: any) => p.prediction_mean),
    type: 'scatter',
    mode: 'lines+markers',
    line: { color, width: 2 },
    marker: { size: 4, color },
    name: analysis.variable,
    hovertemplate: `<b>${analysis.variable}</b>=%{x:.3f}<br>pred=%{y:.4f}<extra></extra>`,
  } as Data];

  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 50, r: 15, t: 10, b: 35 },
    xaxis: { ...DARK_TEMPLATE.xaxis, title: { text: analysis.variable, font: { color: '#dfe3ee', size: 10 } } },
    yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: 'Prédiction', font: { color: '#dfe3ee', size: 10 } } },
    showlegend: false,
    shapes: [{
      type: 'line', xref: 'x', yref: 'paper',
      x0: analysis.base_mean, x1: analysis.base_mean, y0: 0, y1: 1,
      line: { color: 'rgba(255,255,255,0.3)', width: 1, dash: 'dot' },
    }],
  };

  return (
    <div className="rounded-lg p-3 bg-white/[0.02] border border-white/8">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-strong">{analysis.variable}</span>
        {analysis.elasticity !== null && (
          <Badge variant="warning">η = {analysis.elasticity.toFixed(3)}</Badge>
        )}
      </div>
      <div className="flex gap-4 text-xs text-muted mb-2 num">
        <span>μ = {analysis.base_mean.toFixed(3)}</span>
        <span>σ = {analysis.base_std.toFixed(3)}</span>
      </div>
      <Plot data={traces} layout={layout} config={DEFAULT_CONFIG} style={{ width: '100%', height: 180 }} useResizeHandler />
    </div>
  );
}
