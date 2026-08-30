import React, { useState, useMemo } from 'react';
import {
  useCreatePresetScenariosMutation,
  useRunScenariosMutation,
  useGetTornadoMutation,
  useRunMonteCarloMutation,
  useRunStressTestMutation,
  useGetSensitivityMutation,
} from '../store/api';
import {
  ArrowLeft,
  Play,
  BarChart2,
  Activity,
  Zap,
  TrendingUp,
  AlertOctagon,
} from 'lucide-react';
import { TornadoChart } from './viz';
import { Card, Badge, Button } from './ui';
import {
  SensitivityCurve,
  PresetScenariosResults,
  StressTestResultsTable,
  MonteCarloResultsView,
} from './scenarios/ScenarioTabViews';

interface Props {
  datasetId: string;
  onBack: () => void;
}

type Tab = 'scenarios' | 'tornado' | 'sensitivity' | 'montecarlo' | 'stress';

export default function ScenarioBuilder({ datasetId, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('scenarios');
  const [createPresets, { isLoading: creatingPresets }] = useCreatePresetScenariosMutation();
  const [runScenarios, { isLoading: runningScenarios, data: scenarioResults }] =
    useRunScenariosMutation();
  const [getTornado, { isLoading: loadingTornado, data: tornadoData }] =
    useGetTornadoMutation();
  const [runMonteCarlo, { isLoading: loadingMC, data: mcData }] =
    useRunMonteCarloMutation();
  const [runStressTest, { isLoading: loadingStress, data: stressData }] =
    useRunStressTestMutation();
  const [getSensitivity, { isLoading: loadingSensitivity, data: sensitivityData }] =
    useGetSensitivityMutation();
  const [error, setError] = useState<string | null>(null);
  const [mcConfig, setMcConfig] = useState({ n_simulations: 1000, noise_scale: 1.0 });

  const handleRunPresets = async () => {
    setError(null);
    try {
      await createPresets({ id: datasetId }).unwrap();
      const result = await runScenarios({
        id: datasetId,
        scenario_names: ['pessimiste', 'central', 'optimiste'],
      }).unwrap();
      if (!result) setError('Pas de résultats');
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleTornado = async () => {
    setError(null);
    try {
      await getTornado({ id: datasetId, sigma: 1.0 }).unwrap();
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleSensitivity = async () => {
    setError(null);
    try {
      await getSensitivity({ id: datasetId, n_points: 25 }).unwrap();
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleMonteCarlo = async () => {
    setError(null);
    try {
      await runMonteCarlo({ id: datasetId, ...mcConfig }).unwrap();
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const handleStressTest = async () => {
    setError(null);
    try {
      await runStressTest({ id: datasetId, sigmas: [1.0, 2.0] }).unwrap();
    } catch (e: any) {
      setError(e?.data?.error || e?.message || 'Erreur');
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'scenarios', label: 'Scénarios', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'tornado', label: 'Tornado', icon: <Activity className="w-4 h-4" /> },
    { key: 'sensitivity', label: 'Sensibilité', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'montecarlo', label: 'Monte Carlo', icon: <Zap className="w-4 h-4" /> },
    { key: 'stress', label: 'Stress Test', icon: <AlertOctagon className="w-4 h-4" /> },
  ];

  const tornadoVariables = useMemo(() => {
    if (!tornadoData?.bars) return [];
    return tornadoData.bars.map((b: any) => ({
      name: b.variable,
      low: b.low ?? tornadoData.baseline_prediction - b.swing,
      high: b.high ?? tornadoData.baseline_prediction + b.swing,
    }));
  }, [tornadoData]);

  const mcValues = useMemo<number[]>(() => {
    if (!mcData?.histogram) return [];
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
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
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

      {/* Scénarios prédéfinis */}
      {activeTab === 'scenarios' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">
              Comparaison pessimiste / central / optimiste
            </h4>
            <p className="text-muted text-sm">
              Crée 3 scénarios basés sur les quantiles Q10, Q50, Q90 de chaque variable et
              compare les prédictions du modèle.
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
          {scenarioResults && <PresetScenariosResults scenarioResults={scenarioResults} />}
        </Card>
      )}

      {/* Tornado */}
      {activeTab === 'tornado' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Diagramme Tornado</h4>
            <p className="text-muted text-sm">
              Impact de chaque variable lorsqu'elle varie de ±1 écart-type autour de sa moyenne.
            </p>
          </div>
          <Button
            onClick={handleTornado}
            disabled={loadingTornado}
            loading={loadingTornado}
            icon={<Play className="w-4 h-4" />}
          >
            {loadingTornado ? 'Calcul…' : 'Générer le tornado'}
          </Button>

          {tornadoData && (
            <div className="mt-5 space-y-3">
              <Badge variant="info">
                Prédiction de base :{' '}
                <span className="num ml-1">{tornadoData.baseline_prediction.toFixed(3)}</span>
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

      {/* Analyse de sensibilité */}
      {activeTab === 'sensitivity' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Analyse de sensibilité</h4>
            <p className="text-muted text-sm">
              Fait varier chaque variable individuellement et observe l'impact sur la
              prédiction.
            </p>
          </div>
          <Button
            onClick={handleSensitivity}
            disabled={loadingSensitivity}
            loading={loadingSensitivity}
            icon={<Play className="w-4 h-4" />}
          >
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

      {/* Monte Carlo */}
      {activeTab === 'montecarlo' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Simulation Monte Carlo</h4>
            <p className="text-muted text-sm">
              Perturbe aléatoirement toutes les variables pour estimer la distribution des
              prédictions.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Simulations
              </label>
              <input
                type="number"
                className="w-32"
                value={mcConfig.n_simulations}
                onChange={e =>
                  setMcConfig(prev => ({
                    ...prev,
                    n_simulations: Math.min(10000, Math.max(100, +e.target.value)),
                  }))
                }
                min={100}
                max={10000}
                title="Nombre de simulations"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Bruit (σ)
              </label>
              <input
                type="number"
                className="w-24"
                value={mcConfig.noise_scale}
                onChange={e =>
                  setMcConfig(prev => ({
                    ...prev,
                    noise_scale: Math.max(0.1, +e.target.value),
                  }))
                }
                min={0.1}
                max={5}
                step={0.1}
                title="Amplitude du bruit"
              />
            </div>
            <Button
              onClick={handleMonteCarlo}
              disabled={loadingMC}
              loading={loadingMC}
              icon={<Play className="w-4 h-4" />}
            >
              {loadingMC ? 'Simulation…' : 'Lancer'}
            </Button>
          </div>

          {mcData && <MonteCarloResultsView mcData={mcData} mcValues={mcValues} />}
        </Card>
      )}

      {/* Stress Test */}
      {activeTab === 'stress' && (
        <Card>
          <div className="mb-4">
            <h4 className="text-strong font-semibold mb-1">Stress Test</h4>
            <p className="text-muted text-sm">
              Applique des chocs de ±1σ et ±2σ sur chaque variable et mesure l'impact sur la
              prédiction.
            </p>
          </div>
          <Button
            onClick={handleStressTest}
            disabled={loadingStress}
            loading={loadingStress}
            icon={<Play className="w-4 h-4" />}
          >
            {loadingStress ? 'Calcul…' : 'Lancer'}
          </Button>

          {stressData && <StressTestResultsTable stressData={stressData} />}
        </Card>
      )}
    </div>
  );
}
