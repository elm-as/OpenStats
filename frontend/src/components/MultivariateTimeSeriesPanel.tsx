import { useMemo, useState } from 'react';
import { useRunMultivariateTimeSeriesMutation } from '../store/api';

import type { MultivariateTimeSeriesResults, DataCapabilities } from '../types';
import { IRFGrid, FEVDStacked, GrangerHeatmap } from './viz';
import {
  TrendingUp, Activity, ArrowLeft, Play, CheckCircle2,
  AlertTriangle, BarChart3, GitCompare, Layers, Info, Wand2, RefreshCw,
} from 'lucide-react';
import { COLORS, FORECAST_COLORS, MODEL_DEFS } from './multivariateTS/constants';
import { InfoCard } from './multivariateTS/InfoCard';
import { MultiForecastChart } from './multivariateTS/MultiForecastChart';
import { PerModelExploration } from './multivariateTS/PerModelExploration';
import { usePerModelExploration } from './multivariateTS/usePerModelExploration';

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  configValues: Record<string, string>;
  onBack: () => void;
}

export default function MultivariateTimeSeriesPanel({
  datasetId,
  capabilities,
  configValues,
  onBack,
}: Props) {
  const [runMVTS, { isLoading }] = useRunMultivariateTimeSeriesMutation();
  const [results, setResults] = useState<MultivariateTimeSeriesResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'granger' | 'johansen' | 'models' | 'irf' | 'fevd' | 'diagnostics'>('overview');
  const [forcedModel, setForcedModel] = useState<'auto' | 'var' | 'vecm' | 'ardl' | 'bvar' | 'pairwise_var' | 'varmax'>('auto');
  const [targetCol, setTargetCol] = useState<string>('');
  const [bvarLambda1, setBvarLambda1] = useState(0.2);
  const [bvarLambda2, setBvarLambda2] = useState(0.5);
  const [varDataMode, setVarDataMode] = useState<'auto' | 'levels' | 'diff'>('auto');
  const [varTrend, setVarTrend] = useState<'c' | 'ct' | 'ctt' | 'n'>('c');
  const [grangerDataMode, setGrangerDataMode] = useState<'auto' | 'levels' | 'diff'>('auto');
  const [useCustomForecastDates, setUseCustomForecastDates] = useState(false);
  const [forecastDatesText, setForecastDatesText] = useState('');
  const [grangerMaxLag, setGrangerMaxLag] = useState(4);
  const [displayGranularity, setDisplayGranularity] = useState<'auto' | 'day' | 'month' | 'year'>('auto');

  // ── Advanced Parameters ──
  const [maxLag, setMaxLag] = useState(12);
  const [icCriterion, setIcCriterion] = useState<'aic' | 'bic' | 'hqic' | 'fpe'>('aic');
  const [irfPeriods, setIrfPeriods] = useState(20);
  const [fevdPeriods, setFevdPeriods] = useState(20);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [bootstrapIrf, setBootstrapIrf] = useState(false);
  const [irfOrth, setIrfOrth] = useState(true);
  const [vecmDetOrder, setVecmDetOrder] = useState(0);
  const [maxDiffOrder, setMaxDiffOrder] = useState(2);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  // ── Per-model exploration ──
  const [explorationMode, setExplorationMode] = useState<'unified' | 'per_model'>('unified');

  const dateCol = configValues.date_col || '';
  const valueCols = configValues.value_cols ? configValues.value_cols.split(',').filter(Boolean) : [];
  const forecastSteps = parseInt(configValues.forecast_steps || '10', 10);

  const parsedForecastDates = useMemo(() => {
    if (!useCustomForecastDates) return undefined;
    const lines = forecastDatesText
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    return lines.length ? lines : undefined;
  }, [forecastDatesText, useCustomForecastDates]);

  const perModelExploration = usePerModelExploration({
    datasetId,
    dateCol,
    valueCols,
    forecastSteps,
    parsedForecastDates,
    grangerDataMode,
    maxLag,
    icCriterion,
    irfPeriods,
    fevdPeriods,
    confidenceLevel,
    bootstrapIrf,
    irfOrth,
    vecmDetOrder,
    maxDiffOrder,
  });

  const handleRun = async () => {
    if (!dateCol || valueCols.length < 2) {
      setError('Sélectionnez une colonne date et au moins 2 colonnes numériques');
      return;
    }
    if (useCustomForecastDates && (!parsedForecastDates || parsedForecastDates.length !== forecastSteps)) {
      setError(`Ajoutez exactement ${forecastSteps} dates de prévision (une par ligne)`);
      return;
    }
    setError(null);
    try {
      const res = await runMVTS({
        id: datasetId,
        date_col: dateCol,
        value_cols: valueCols,
        forecast_steps: forecastSteps,
        granger_max_lag: grangerMaxLag,
        forced_model: forcedModel === 'auto' ? undefined : forcedModel,
        var_data_mode: varDataMode,
        var_trend: varTrend,
        granger_data_mode: grangerDataMode,
        forecast_dates: parsedForecastDates,
        target_col: targetCol || undefined,
        bvar_lambda1: bvarLambda1,
        bvar_lambda2: bvarLambda2,
        max_lag: maxLag,
        ic_criterion: icCriterion,
        irf_periods: irfPeriods,
        fevd_periods: fevdPeriods,
        confidence_level: confidenceLevel,
        bootstrap_irf: bootstrapIrf,
        irf_orth: irfOrth,
        vecm_det_order: vecmDetOrder,
        max_diff_order: maxDiffOrder,
      }).unwrap();

      if (res.error) {
        setError(res.error);
      } else {
        setResults(res);
        setSelectedModel(res.best_model || null);
        setActiveTab('overview');
      }
    } catch (err: any) {
      setError(err?.data?.error || "Erreur lors de l'analyse multivariée");
    }
  };

  // ── Relance rapide avec overrides ──
  const quickRerun = async (overrides: {
    var_data_mode?: 'auto' | 'levels' | 'diff';
    granger_data_mode?: 'auto' | 'levels' | 'diff';
    forced_model?: 'var' | 'vecm' | 'ardl' | 'bvar' | 'pairwise_var' | 'varmax';
    var_trend?: 'c' | 'ct' | 'ctt' | 'n';
  }) => {
    const newVarDataMode = overrides.var_data_mode ?? varDataMode;
    const newGrangerDataMode = overrides.granger_data_mode ?? grangerDataMode;
    const newForcedModel = overrides.forced_model ?? (forcedModel === 'auto' ? undefined : forcedModel);
    const newVarTrend = overrides.var_trend ?? varTrend;
    if (overrides.var_data_mode) setVarDataMode(overrides.var_data_mode);
    if (overrides.granger_data_mode) setGrangerDataMode(overrides.granger_data_mode);
    if (overrides.forced_model) setForcedModel(overrides.forced_model);
    if (overrides.var_trend) setVarTrend(overrides.var_trend);
    setError(null);
    try {
      const res = await runMVTS({
        id: datasetId,
        date_col: dateCol,
        value_cols: valueCols,
        forecast_steps: forecastSteps,
        granger_max_lag: grangerMaxLag,
        forced_model: newForcedModel,
        var_data_mode: newVarDataMode,
        var_trend: newVarTrend,
        granger_data_mode: newGrangerDataMode,
        forecast_dates: parsedForecastDates,
        target_col: targetCol || undefined,
        bvar_lambda1: bvarLambda1,
        bvar_lambda2: bvarLambda2,
        max_lag: maxLag,
        ic_criterion: icCriterion,
        irf_periods: irfPeriods,
        fevd_periods: fevdPeriods,
        confidence_level: confidenceLevel,
        bootstrap_irf: bootstrapIrf,
        irf_orth: irfOrth,
        vecm_det_order: vecmDetOrder,
        max_diff_order: maxDiffOrder,
      }).unwrap();
      if (res.error) {
        setError(res.error);
      } else {
        setResults(res);
        setSelectedModel(res.best_model || null);
      }
    } catch (err: any) {
      setError(err?.data?.error || "Erreur lors de la relance");
    }
  };

  // ── Per-model rendering ──
  if (explorationMode === 'per_model') {
    return (
      <PerModelExploration
        datasetId={datasetId}
        dateCol={dateCol}
        valueCols={valueCols}
        forecastSteps={forecastSteps}
        onBack={onBack}
        onSwitchToUnified={() => setExplorationMode('unified')}
        {...perModelExploration}
      />
    );
  }

  // ── Écran de lancement ──
  if (!results && !isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Séries Temporelles Multivariées
          </h3>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>

        <div className="card">
          <p className="text-sm text-gray-600 mb-2">
            Variables : <strong>{valueCols.join(', ')}</strong>
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Date : <strong>{dateCol}</strong> — Horizon : <strong>{forecastSteps}</strong> pas
          </p>

          <div className="mb-4 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
            <p className="text-xs font-semibold text-indigo-800 mb-2">Preset académique</p>
            <p className="text-xs text-indigo-700 mb-3">
              Reproduit l'approche "Bodjong" : VAR forcé en niveaux avec constante + tendance (trend=ct),
              et Granger en niveaux.
            </p>
            <button
              onClick={() => {
                setForcedModel('var');
                setVarDataMode('levels');
                setVarTrend('ct');
                setGrangerDataMode('levels');
                setTimeout(() => handleRun(), 0);
              }}
              className="btn-primary text-sm"
            >
              Appliquer preset académique et lancer
            </button>
          </div>

          {/* Exploration mode toggle */}
          <div className="mb-4 p-3 rounded-lg border border-surface-700 bg-surface-800/50">
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-surface-200">Mode exploration par modèle</p>
                <p className="text-xs text-surface-400 mb-2">
                  Lancez chaque modèle individuellement avec ses propres paramètres et comparez les résultats.
                </p>
                <button
                  onClick={() => setExplorationMode('per_model')}
                  className="btn-secondary text-sm"
                >
                  Passer en mode exploration
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-600">
              Forçage de modèle
              <select
                value={forcedModel}
                onChange={(e) => setForcedModel(e.target.value as any)}
                className="mt-1 w-full"
              >
                <option value="auto">Auto (sélection par critères d'information)</option>
                <option value="var">VAR</option>
                <option value="vecm">VECM</option>
                <option value="ardl">ARDL</option>
                <option value="bvar">BVAR</option>
                <option value="pairwise_var">Pairwise VAR</option>
                <option value="varmax">VARMAX</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <label className="text-sm text-gray-600">
              Régime des données (VAR/VECM)
              <select
                value={varDataMode}
                onChange={(e) => setVarDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
                className="mt-1 w-full"
              >
                <option value="auto">Auto</option>
                <option value="levels">Niveaux</option>
                <option value="diff">Différences</option>
              </select>
            </label>

            <label className="text-sm text-gray-600">
              Trend VAR
              <select
                value={varTrend}
                onChange={(e) => setVarTrend(e.target.value as 'c' | 'ct' | 'ctt' | 'n')}
                className="mt-1 w-full"
              >
                <option value="c">c (constante)</option>
                <option value="ct">ct (constante + tendance)</option>
                <option value="ctt">ctt (constante + tendance + quadratique)</option>
                <option value="n">n (sans constante)</option>
              </select>
            </label>

            <label className="text-sm text-gray-600">
              Régime des données (Granger)
              <select
                value={grangerDataMode}
                onChange={(e) => setGrangerDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
                className="mt-1 w-full"
              >
                <option value="auto">Auto</option>
                <option value="levels">Niveaux</option>
                <option value="diff">Différences</option>
              </select>
            </label>
          </div>

          {/* ARDL target column */}
          {forcedModel === 'ardl' && valueCols.length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-gray-600">
                Variable dépendante (ARDL)
                <select
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="mt-1 w-full"
                >
                  <option value="">Première variable par défaut</option>
                  {valueCols.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* BVAR hyperparameters */}
          {forcedModel === 'bvar' && (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">
                λ₁ (tightness)
                <input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.05}
                  value={bvarLambda1}
                  onChange={(e) => setBvarLambda1(Number(e.target.value) || 0.2)}
                  className="mt-1 w-full"
                />
              </label>
              <label className="text-sm text-gray-600">
                λ₂ (cross-variable)
                <input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.05}
                  value={bvarLambda2}
                  onChange={(e) => setBvarLambda2(Number(e.target.value) || 0.5)}
                  className="mt-1 w-full"
                />
              </label>
            </div>
          )}
          {/* Advanced Parameters */}
          <div className="mb-4">
            <button
              onClick={() => setShowAdvancedParams(!showAdvancedParams)}
              className="text-sm font-semibold text-primary-600 flex items-center gap-2 mb-2 hover:text-primary-700"
            >
              {showAdvancedParams ? '▼ Paramètres Avancés (Masquer)' : '► Paramètres Avancés (Afficher)'}
            </button>
            
            {showAdvancedParams && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="text-sm text-gray-600">
                  Lag Max (VAR/VECM)
                  <input
                    type="number"
                    min={1} max={60}
                    value={maxLag}
                    onChange={(e) => setMaxLag(Number(e.target.value) || 12)}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Critère d'information
                  <select
                    value={icCriterion}
                    onChange={(e) => setIcCriterion(e.target.value as any)}
                    className="mt-1 w-full"
                  >
                    <option value="aic">AIC</option>
                    <option value="bic">BIC</option>
                    <option value="hqic">HQIC</option>
                    <option value="fpe">FPE</option>
                  </select>
                </label>
                <label className="text-sm text-gray-600">
                  Périodes IRF
                  <input
                    type="number"
                    min={1} max={100}
                    value={irfPeriods}
                    onChange={(e) => setIrfPeriods(Number(e.target.value) || 20)}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Périodes FEVD
                  <input
                    type="number"
                    min={1} max={100}
                    value={fevdPeriods}
                    onChange={(e) => setFevdPeriods(Number(e.target.value) || 20)}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Niveau de confiance
                  <select
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(Number(e.target.value))}
                    className="mt-1 w-full"
                  >
                    <option value={0.9}>90%</option>
                    <option value={0.95}>95%</option>
                    <option value={0.99}>99%</option>
                  </select>
                </label>
                <label className="text-sm text-gray-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bootstrapIrf}
                    onChange={(e) => setBootstrapIrf(e.target.checked)}
                  />
                  Bootstrap IRF
                </label>
                <label className="text-sm text-gray-600 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={irfOrth}
                    onChange={(e) => setIrfOrth(e.target.checked)}
                  />
                  IRF orthogonalisées
                </label>
                <label className="text-sm text-gray-600">
                  Ordre déterministe VECM
                  <input
                    type="number"
                    min={0} max={2}
                    value={vecmDetOrder}
                    onChange={(e) => setVecmDetOrder(Number(e.target.value) || 0)}
                    className="mt-1 w-full"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Ordre max différenciation
                  <input
                    type="number"
                    min={1} max={5}
                    value={maxDiffOrder}
                    onChange={(e) => setMaxDiffOrder(Number(e.target.value) || 2)}
                    className="mt-1 w-full"
                  />
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={isLoading}
            className="btn-primary flex items-center gap-2 w-full justify-center"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isLoading ? 'Analyse en cours…' : "Lancer l'analyse multivariée"}
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!results) return null;

  const currentModel = selectedModel ? results.models[selectedModel] : undefined;
  const integrationOrders = results.methodological_pivot?.diff_orders
    ? Object.entries(results.methodological_pivot.diff_orders)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Résultats de l'analyse multivariée
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setResults(null)} className="btn-secondary text-sm">
            Nouvelle analyse
          </button>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {[
          { key: 'overview', label: 'Vue d\'ensemble', icon: Activity },
          { key: 'granger', label: 'Granger', icon: GitCompare },
          { key: 'johansen', label: 'Johansen', icon: Layers },
          { key: 'models', label: 'Modèles', icon: BarChart3 },
          { key: 'irf', label: 'IRF', icon: TrendingUp },
          { key: 'fevd', label: 'FEVD', icon: Info },
          { key: 'diagnostics', label: 'Diagnostics', icon: CheckCircle2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Overview ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Best model banner */}
          <div className="card bg-gradient-to-r from-primary-50 to-accent-50 border-primary-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-primary-600 font-semibold uppercase tracking-wide">Modèle sélectionné</p>
                <h4 className="text-xl font-bold text-gray-900 mt-1">
                  {results.best_model?.toUpperCase() || 'Aucun'}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {results.best_model && MODEL_DEFS.find(m => m.key === results.best_model)?.desc}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-primary-600" />
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard label="Observations" value={String(results.n_observations)} />
            <InfoCard
              label="Stationnarité"
              value={results.all_stationary ? 'Oui' : 'Non'}
              color={results.all_stationary ? 'text-green-600' : 'text-amber-600'}
            />
            <InfoCard label="Variables" value={String(results.n_variables)} />
            <InfoCard label="Forçage" value={forcedModel === 'auto' ? 'Auto' : forcedModel.toUpperCase()} />
          </div>

          {/* Model comparison */}
          {results.ranking && results.ranking.length > 0 && (
            <div className="card">
              <h4 className="font-semibold text-gray-900 mb-3">Comparaison des modèles</h4>
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">Modèle</th>
                      <th className="p-2 text-right">AIC</th>
                      <th className="p-2 text-right">BIC</th>
                      <th className="p-2 text-right">HQIC</th>
                      <th className="p-2 text-center">Lag</th>
                      <th className="p-2 text-center">Sélectionné</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.ranking.map((model) => (
                      <tr key={model.model} className="border-t border-gray-100">
                        <td className="p-2 font-medium">{model.model.toUpperCase()}</td>
                        <td className="p-2 text-right font-mono">{model.aic?.toFixed(1) ?? '—'}</td>
                        <td className="p-2 text-right font-mono">{model.bic?.toFixed(1) ?? '—'}</td>
                        <td className="p-2 text-right font-mono">{'hqic' in model ? (model as any).hqic?.toFixed(1) : '—'}</td>
                        <td className="p-2 text-center">{'lag_order' in model ? (model as any).lag_order : '—'}</td>
                        <td className="p-2 text-center">
                          {model.model === results.best_model ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Model suitability */}
          {results.model_suitability && Object.keys(results.model_suitability).length > 0 && (
            <div className="card">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                Adéquation des modèles
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(results.model_suitability).map(([name, suit]) => (
                  <div
                    key={name}
                    className={`p-3 rounded-lg border text-sm ${
                      suit.recommended
                        ? 'border-green-300 bg-green-50'
                        : suit.suitable
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-red-200 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{name.toUpperCase()}</span>
                      {suit.recommended && <span className="text-xs text-green-700 font-bold">Recommandé</span>}
                      {!suit.suitable && <span className="text-xs text-red-600">Non adapté</span>}
                    </div>
                    <p className="text-xs text-gray-600">{suit.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.johansen_cointegration.assumption_valid === false && results.johansen_cointegration.assumption_message && (
            <div className="card bg-amber-50 border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{results.johansen_cointegration.assumption_message}</p>
              </div>
            </div>
          )}

          {results.methodological_pivot && (
            <div className="card bg-indigo-50 border-indigo-200">
              <p className="text-xs font-medium text-indigo-800 mb-2">Pivot méthodologique appliqué</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-indigo-900">
                <p>VAR: mode demandé <strong>{results.methodological_pivot.var_data_mode}</strong> → régime appliqué <strong>{results.methodological_pivot.applied_var_regime}</strong></p>
                <p>Trend VAR: <strong>{results.methodological_pivot.var_trend || 'c'}</strong></p>
                <p>Granger: mode demandé <strong>{results.methodological_pivot.granger_data_mode}</strong> → régime appliqué <strong>{results.methodological_pivot.applied_granger_regime}</strong></p>
                <p>Forçage modèle: <strong>{results.methodological_pivot.forced_model || 'aucun'}</strong></p>
                <p>Ordres d'intégration: <strong>{integrationOrders.map(([k, v]) => `${k}=I(${v})`).join(', ') || 'n/a'}</strong></p>
              </div>
              {results.methodological_pivot.integration_interpretation && (
                <p className="text-xs text-indigo-700 mt-2">{results.methodological_pivot.integration_interpretation}</p>
              )}
              {results.methodological_pivot.reason && (
                <p className="text-xs text-indigo-700 mt-2">{results.methodological_pivot.reason}</p>
              )}
            </div>
          )}

          {/* Stationarity per variable */}
          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Stationnarité par variable
            </h4>
            <div className="space-y-2">
              {results.value_cols.map((col) => {
                const st = results.stationarity[col];
                if (!st) return null;
                return (
                  <div key={col} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">{col}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={st.is_stationary ? 'text-green-600' : 'text-amber-600'}>
                        {st.is_stationary ? 'Stationnaire' : 'Non-stationnaire'}
                      </span>
                      <span className="text-gray-400 text-xs">{st.conclusion}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick-action buttons */}
            {!results.all_stationary && results.methodological_pivot?.applied_var_regime !== 'diff' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => quickRerun({ var_data_mode: 'diff', granger_data_mode: 'diff' })}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-all disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  Rendre stationnaire (différencier)
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                </button>
              </div>
            )}
            {results.all_stationary && results.methodological_pivot?.applied_var_regime === 'diff' && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => quickRerun({ var_data_mode: 'levels', granger_data_mode: 'levels' })}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 text-green-800 border border-green-200 hover:bg-green-100 transition-all disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  Revenir en niveaux (déjà stationnaire)
                  {isLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Granger ── */}
      {activeTab === 'granger' && results.granger_causality && (
        <div className="space-y-4">
          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-purple-500" />
              Causalité de Granger (max lag = {results.granger_causality.max_lag})
            </h4>

            <p className="text-xs text-gray-500 mb-3">
              Régime utilisé pour Granger : <strong>{results.granger_causality.data_regime || 'levels'}</strong>
            </p>

            {/* Quick-action: switch Granger data regime */}
            {!results.all_stationary && results.granger_causality.data_regime === 'levels' && (
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => quickRerun({ granger_data_mode: 'diff' })}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 transition-all disabled:opacity-50"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Relancer Granger en différences (stationnarité)
                  {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                </button>
              </div>
            )}
            {results.granger_causality.data_regime === 'diff' && (
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  onClick={() => quickRerun({ granger_data_mode: 'levels' })}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Revenir en niveaux
                  {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                </button>
              </div>
            )}

            {/* Heatmap Plotly */}
            <GrangerHeatmap
              pvalues={results.granger_causality.matrix as Record<string, Record<string, number>>}
              alpha={0.05}
              title=""
            />

            {/* Significant pairs */}
            {results.granger_causality.details.filter((d) => d.significant).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Relations significatives (p &lt; 0.05) :</p>
                <div className="flex flex-wrap gap-2">
                  {results.granger_causality.details
                    .filter((d) => d.significant)
                    .map((d, i) => (
                      <span key={i} className="badge bg-green-100 text-green-700">
                        {d.cause} → {d.effect} (p={d.p_value != null && d.p_value < 0.001 ? '< 0.001' : d.p_value?.toFixed(3)})
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Johansen ── */}
      {activeTab === 'johansen' && results.johansen_cointegration && (
        <div className="space-y-4">
          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-500" />
              Test de cointégration de Johansen
            </h4>

            {'error' in results.johansen_cointegration && results.johansen_cointegration.error ? (
              <p className="text-red-600 text-sm">{results.johansen_cointegration.error}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <InfoCard
                    label="Rang exploitable"
                    value={String(results.johansen_cointegration.cointegration_rank)}
                  />
                  <InfoCard
                    label="Cointégration exploitable"
                    value={results.johansen_cointegration.has_cointegration ? 'Oui' : 'Non'}
                    color={results.johansen_cointegration.has_cointegration ? 'text-green-600' : 'text-gray-600'}
                  />
                </div>

                {/* Eigenvalues - extracted from max_eigenvalue_tests */}
                {results.johansen_cointegration.max_eigenvalue_tests && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">Tests valeur propre maximale :</p>
                    <div className="flex flex-wrap gap-2">
                      {results.johansen_cointegration.max_eigenvalue_tests.map((t, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                          {t.hypothesis}: stat={t.statistic?.toFixed(3) ?? '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trace test results */}
                {results.johansen_cointegration.trace_tests && (
                  <div className="overflow-x-auto">
                    <table className="text-sm w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left">H0</th>
                          <th className="p-2 text-right">Stat trace</th>
                          <th className="p-2 text-right">Critique 5%</th>
                          <th className="p-2 text-center">Rejet H0</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.johansen_cointegration.trace_tests.map((test, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="p-2">{test.hypothesis}</td>
                            <td className="p-2 text-right font-mono">{test.statistic?.toFixed(2)}</td>
                            <td className="p-2 text-right font-mono">{test.critical_value_95?.toFixed(2)}</td>
                            <td className="p-2 text-center">
                              {test.reject ? (
                                <span className="text-green-600 font-bold">Oui</span>
                              ) : (
                                <span className="text-gray-500">Non</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Models ── */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          {/* Model selector */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(results.models).map(([key, model]) => (
              <button
                key={key}
                onClick={() => setSelectedModel(key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedModel === key
                    ? 'bg-primary-600 text-white'
                    : model.error
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {key.toUpperCase()}
                {model.error && <span className="ml-1">WARN</span>}
              </button>
            ))}
          </div>

          {/* Selected model details */}
          {currentModel && (
            <div className="space-y-4">
              {currentModel.error && (
                <div className="card bg-red-50 border-red-200">
                  <p className="text-red-700 text-sm">{currentModel.error}</p>
                </div>
              )}

              {!currentModel.error && (
                <>
                  <div className="card">
                    <h4 className="font-semibold text-gray-900 mb-3">
                      {selectedModel?.toUpperCase()} — Détails
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <InfoCard label="AIC" value={currentModel.aic?.toFixed(1) ?? '—'} />
                      <InfoCard label="BIC" value={currentModel.bic?.toFixed(1) ?? '—'} />
                      <InfoCard label="HQIC" value={currentModel.hqic?.toFixed(1) ?? '—'} />
                      <InfoCard label="Ordre de lag" value={String(currentModel.lag_order ?? '—')} />
                    </div>

                    {/* Cointegration rank for VECM */}
                    {currentModel.coint_rank != null && (
                      <div className="mb-4">
                        <span className="badge bg-cyan-100 text-cyan-800">
                          Rang de cointégration : {currentModel.coint_rank}
                        </span>
                      </div>
                    )}

                    {/* Data regime */}
                    {currentModel.data_regime && (
                      <div className="mb-4">
                        <span className="text-sm text-gray-600">
                          Régime de données : <strong>{currentModel.data_regime}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Cointegration vectors (VECM) */}
                  {currentModel.cointegration_vectors && Object.keys(currentModel.cointegration_vectors).length > 0 && (
                    <div className="card">
                      <h4 className="font-semibold text-gray-900 mb-3">Vecteurs de cointégration</h4>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="p-2 text-left">Vecteur</th>
                              {currentModel.variables.map((v) => (
                                <th key={v} className="p-2 text-right">{v}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(currentModel.cointegration_vectors).map(([name, vec]: [string, Record<string, number | null>]) => (
                              <tr key={name} className="border-t border-gray-100">
                                <td className="p-2 font-medium">{name}</td>
                                {currentModel.variables.map((v) => (
                                  <td key={v} className="p-2 text-right font-mono">{vec[v]?.toFixed(4)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ARDL Bounds Test */}
                  {currentModel.bounds_test && !currentModel.bounds_test.error && (
                    <div className="mb-4 p-3 rounded-lg border border-teal-200 bg-teal-50">
                      <p className="text-xs font-semibold text-teal-800 mb-2">Bounds Test (Pesaran, Shin & Smith)</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                        <div className="text-xs"><span className="text-gray-500">F-stat:</span> <span className="font-mono font-bold">{currentModel.bounds_test.f_statistic?.toFixed(3)}</span></div>
                        <div className="text-xs"><span className="text-gray-500">p-value:</span> <span className="font-mono font-bold">{currentModel.bounds_test.p_value != null ? currentModel.bounds_test.p_value.toFixed(4) : 'n/a'}</span></div>
                        <div className={`text-xs font-bold ${currentModel.bounds_test.cointegration_detected ? 'text-green-700' : 'text-amber-700'}`}>
                          {currentModel.bounds_test.cointegration_detected ? 'Cointégration détectée' : 'Pas de cointégration'}
                        </div>
                      </div>
                      <p className="text-xs text-teal-700">{currentModel.bounds_test.conclusion}</p>
                    </div>
                  )}

                  {/* BVAR hyperparameters */}
                  {currentModel.bvar_hyperparameters && (
                    <div className="mb-4 flex gap-3">
                      <span className="badge bg-orange-100 text-orange-700">λ₁ = {currentModel.bvar_hyperparameters.lambda1}</span>
                      <span className="badge bg-orange-100 text-orange-700">λ₂ = {currentModel.bvar_hyperparameters.lambda2}</span>
                    </div>
                  )}

                  {/* Pairwise VAR pairs */}
                  {currentModel.pairs && currentModel.pairs.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Paires bivariées ({currentModel.n_pairs} paires) :</p>
                      <div className="overflow-x-auto">
                        <table className="text-xs w-full">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="p-2 text-left">Paire</th>
                              <th className="p-2 text-right">Lag</th>
                              <th className="p-2 text-right">AIC</th>
                              <th className="p-2 text-left">Granger significatif</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentModel.pairs.map((p, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="p-2 font-medium">{p.variables.join(' ↔ ')}</td>
                                <td className="p-2 text-right font-mono">{p.lag_order ?? '—'}</td>
                                <td className="p-2 text-right font-mono">{p.aic?.toFixed(1) ?? '—'}</td>
                                <td className="p-2">
                                  {p.error ? (
                                    <span className="text-red-500">{p.error}</span>
                                  ) : p.granger_significant?.length ? (
                                    p.granger_significant.map((g, j) => (
                                      <span key={j} className="badge bg-green-100 text-green-700 mr-1">{g}</span>
                                    ))
                                  ) : (
                                    <span className="text-gray-400">aucun</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Multivariate forecast chart */}
                  <MultiForecastChart model={currentModel} granularity={displayGranularity} />
                </>
              )}
            </div>
          )}

          {currentModel?.error && (
            <div className="card bg-red-50 border-red-200 p-4">
              <p className="text-red-700 text-sm">{currentModel.error}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: IRF (Plotly) ── */}
      {activeTab === 'irf' && currentModel?.irf && !currentModel.irf.error && (() => {
        const cells = currentModel.irf.variables.flatMap((impulse) =>
          currentModel.irf!.variables.map((response) => {
            const values = currentModel.irf!.data[impulse]?.[response];
            return values ? { shock: impulse, response, values: values.map(v => v ?? 0) } : null;
          })
        ).filter((c): c is { shock: string; response: string; values: number[] } => c !== null);
        return (
          <div className="space-y-4">
            <div className="card">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-400" />
                Fonctions de réponse impulsionnelle (IRF) — {currentModel.irf.periods} périodes
              </h4>
              <p className="text-xs text-muted mb-4">
                Chaque cellule montre la réponse d'une variable à un choc unitaire d'une autre variable.
              </p>
              <IRFGrid cells={cells} title="" />
            </div>
          </div>
        );
      })()}

      {activeTab === 'irf' && (!currentModel?.irf || currentModel.irf.error) && (
        <div className="card p-6 text-center text-gray-500">
          <p>{currentModel?.irf?.error || 'Sélectionnez un modèle dans l\'onglet Modèles pour voir les IRF.'}</p>
        </div>
      )}

      {/* ── TAB: FEVD (Plotly) ── */}
      {activeTab === 'fevd' && currentModel && 'fevd' in currentModel && currentModel.fevd && !currentModel.fevd.error && (() => {
        const fevdData = currentModel.fevd!.variables.map((targetVar) => {
          const decomp = currentModel.fevd!.data[targetVar];
          const contributions: Record<string, number[]> = {};
          if (decomp) {
            for (const src of Object.keys(decomp)) {
              contributions[src] = decomp[src].map(v => v ?? 0);
            }
          }
          return { variable: targetVar, contributions };
        }).filter(r => Object.keys(r.contributions).length > 0);
        return (
          <div className="space-y-4">
            <div className="card">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                Décomposition de la variance de l'erreur de prévision (FEVD)
              </h4>
              <p className="text-xs text-muted mb-4">
                Proportion de la variance de chaque variable expliquée par les chocs de chaque source.
              </p>
              <FEVDStacked fevd={fevdData} title="" />
            </div>
          </div>
        );
      })()}

      {activeTab === 'fevd' && (!currentModel || !('fevd' in currentModel) || !currentModel.fevd || currentModel.fevd.error) && (
        <div className="card p-6 text-center text-gray-500">
          <p>{(currentModel as any)?.fevd?.error || 'FEVD disponible uniquement pour le modèle VAR. Sélectionnez VAR dans l\'onglet Modèles.'}</p>
        </div>
      )}
      {/* ── TAB: Diagnostics ── */}
      {activeTab === 'diagnostics' && currentModel && (
        <div className="space-y-4">
          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-500" />
              Diagnostics des Résidus
            </h4>

            {!currentModel.diagnostics ? (
              <p className="text-gray-500 italic text-sm">Les diagnostics ne sont pas disponibles pour ce modèle.</p>
            ) : currentModel.diagnostics.error ? (
              <p className="text-red-500 text-sm">Erreur: {currentModel.diagnostics.error}</p>
            ) : (
              <div className="space-y-6">
                {/* Résumé Global */}
                <div className={`p-4 border rounded-lg ${currentModel.diagnostics.summary.model_adequate ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <h5 className={`font-bold mb-2 ${currentModel.diagnostics.summary.model_adequate ? 'text-green-800' : 'text-red-800'}`}>
                    Verdict Global: {currentModel.diagnostics.summary.model_adequate ? 'Modèle Adéquat' : 'Modèle Inadéquat'}
                  </h5>
                  <p className="text-sm text-gray-700 mb-3">{currentModel.diagnostics.summary.interpretation}</p>
                  
                  {currentModel.diagnostics.summary.issues.length > 0 && (
                    <ul className="list-disc pl-5 text-sm text-red-700">
                      {currentModel.diagnostics.summary.issues.map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Diagnostics par Variable */}
                <div>
                  <h5 className="font-semibold text-gray-800 mb-3">Détails par variable</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(currentModel.diagnostics.per_variable).map(([varName, diag]) => (
                      <div key={varName} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <h6 className="font-semibold text-primary-700 border-b pb-2 mb-3">{varName}</h6>
                        
                        {diag.error ? (
                          <p className="text-red-500 text-xs">{diag.error}</p>
                        ) : (
                          <div className="space-y-3">
                            {/* Ljung-Box */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">Autocorrélation (Ljung-Box)</span>
                                <span className={diag.ljung_box?.ok ? 'text-green-600 font-bold text-xs' : 'text-red-600 font-bold text-xs'}>
                                  {diag.ljung_box?.ok ? 'OK' : 'ÉCHEC'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">p-value: {diag.ljung_box?.p_value?.toFixed(4)}</p>
                            </div>
                            
                            {/* Jarque-Bera */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">Normalité (Jarque-Bera)</span>
                                <span className={diag.jarque_bera?.ok ? 'text-green-600 font-bold text-xs' : 'text-amber-600 font-bold text-xs'}>
                                  {diag.jarque_bera?.ok ? 'OK' : 'ÉCHEC (Non-critique)'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">p-value: {diag.jarque_bera?.p_value?.toFixed(4)}</p>
                            </div>

                            {/* Durbin-Watson */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-medium text-gray-700">Autocorrélation Lag-1 (Durbin-Watson)</span>
                                <span className={diag.durbin_watson?.ok ? 'text-green-600 font-bold text-xs' : 'text-red-600 font-bold text-xs'}>
                                  {diag.durbin_watson?.ok ? 'OK' : 'ÉCHEC'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">Statistique: {diag.durbin_watson?.statistic?.toFixed(2)}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}