import { useState } from 'react';
import type { DataCapabilities } from '../types';
import {
  TrendingUp,
  Activity,
  ArrowLeft,
  RefreshCw,
  GitCompare,
  Layers,
  Brain,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { PerModelExploration } from './multivariateTS/PerModelExploration';
import { usePerModelExploration } from './multivariateTS/usePerModelExploration';
import { MultivariateConfigForm } from './multivariateTS/MultivariateConfigForm';
import { MultivariateOverviewTab } from './multivariateTS/MultivariateOverviewTab';
import {
  MultivariateGrangerTab,
  MultivariateJohansenTab,
} from './multivariateTS/MultivariateGrangerJohansenTabs';
import { MultivariateModelsTab } from './multivariateTS/MultivariateModelsTab';
import { MultivariateDiagnosticsTab } from './multivariateTS/MultivariateDiagnosticsTab';
import { useMultivariateRun } from './multivariateTS/useMultivariateRun';

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  configValues: Record<string, string>;
  onBack: () => void;
}

export default function MultivariateTimeSeriesPanel({
  datasetId,
  configValues,
  onBack,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'granger' | 'johansen' | 'models' | 'irf' | 'fevd' | 'diagnostics'
  >('overview');
  const [displayGranularity, setDisplayGranularity] = useState<
    'auto' | 'day' | 'month' | 'year'
  >('auto');
  const [explorationMode, setExplorationMode] = useState<'unified' | 'per_model'>('unified');

  const dateCol = configValues.date_col || '';
  const valueCols = configValues.value_cols
    ? configValues.value_cols.split(',').filter(Boolean)
    : [];
  const forecastSteps = parseInt(configValues.forecast_steps || '10', 10);

  const mvRun = useMultivariateRun(datasetId, dateCol, valueCols, forecastSteps);

  const perModelExploration = usePerModelExploration({
    datasetId,
    dateCol,
    valueCols,
    forecastSteps,
    parsedForecastDates: undefined,
    grangerDataMode: mvRun.grangerDataMode,
    maxLag: mvRun.maxLag,
    icCriterion: mvRun.icCriterion,
    irfPeriods: mvRun.irfPeriods,
    fevdPeriods: mvRun.fevdPeriods,
    confidenceLevel: mvRun.confidenceLevel,
    bootstrapIrf: mvRun.bootstrapIrf,
    irfOrth: mvRun.irfOrth,
    vecmDetOrder: mvRun.vecmDetOrder,
    maxDiffOrder: mvRun.maxDiffOrder,
  });

  if (explorationMode === 'per_model') {
    return (
      <PerModelExploration
        dateCol={dateCol}
        valueCols={valueCols}
        forecastSteps={forecastSteps}
        onBack={onBack}
        onSwitchToUnified={() => setExplorationMode('unified')}
        {...perModelExploration}
      />
    );
  }

  if (!mvRun.results && !mvRun.isLoading) {
    return (
      <MultivariateConfigForm
        onBack={onBack}
        valueCols={valueCols}
        dateCol={dateCol}
        forecastSteps={forecastSteps}
        onApplyAcademicPreset={() => {
          mvRun.setForcedModel('var');
          mvRun.setVarDataMode('levels');
          mvRun.setVarTrend('ct');
          mvRun.setGrangerDataMode('levels');
          setTimeout(
            () =>
              mvRun.handleRun({
                forced_model: 'var',
                var_data_mode: 'levels',
                var_trend: 'ct',
                granger_data_mode: 'levels',
              }),
            0
          );
        }}
        onSwitchToExploration={() => setExplorationMode('per_model')}
        forcedModel={mvRun.forcedModel}
        setForcedModel={mvRun.setForcedModel}
        varDataMode={mvRun.varDataMode}
        setVarDataMode={mvRun.setVarDataMode}
        varTrend={mvRun.varTrend}
        setVarTrend={mvRun.setVarTrend}
        grangerDataMode={mvRun.grangerDataMode}
        setGrangerDataMode={mvRun.setGrangerDataMode}
        targetCol={mvRun.targetCol}
        setTargetCol={mvRun.setTargetCol}
        bvarLambda1={mvRun.bvarLambda1}
        setBvarLambda1={mvRun.setBvarLambda1}
        bvarLambda2={mvRun.bvarLambda2}
        setBvarLambda2={mvRun.setBvarLambda2}
        maxLag={mvRun.maxLag}
        setMaxLag={mvRun.setMaxLag}
        icCriterion={mvRun.icCriterion}
        setIcCriterion={mvRun.setIcCriterion}
        irfPeriods={mvRun.irfPeriods}
        setIrfPeriods={mvRun.setIrfPeriods}
        fevdPeriods={mvRun.fevdPeriods}
        setFevdPeriods={mvRun.setFevdPeriods}
        confidenceLevel={mvRun.confidenceLevel}
        setConfidenceLevel={mvRun.setConfidenceLevel}
        bootstrapIrf={mvRun.bootstrapIrf}
        setBootstrapIrf={mvRun.setBootstrapIrf}
        irfOrth={mvRun.irfOrth}
        setIrfOrth={mvRun.setIrfOrth}
        vecmDetOrder={mvRun.vecmDetOrder}
        setVecmDetOrder={mvRun.setVecmDetOrder}
        maxDiffOrder={mvRun.maxDiffOrder}
        setMaxDiffOrder={mvRun.setMaxDiffOrder}
        error={mvRun.error}
        isLoading={mvRun.isLoading}
        onRun={() => mvRun.handleRun()}
      />
    );
  }

  if (mvRun.isLoading) {
    return (
      <div className="card p-12 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
        <p className="text-gray-600 mt-4 font-medium">
          Estimation des modèles multivariés (VAR, VECM, ARDL, BVAR)…
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Tests de stationnarité, cointégration et sélection optimale
        </p>
      </div>
    );
  }

  if (!mvRun.results) return null;
  const currentModel = mvRun.selectedModel ? mvRun.results.models[mvRun.selectedModel] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary text-sm flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Séries Temporelles Multivariées
            </h3>
            <p className="text-xs text-gray-500">
              {mvRun.results.n_variables} variables • {mvRun.results.n_observations} observations •
              Horizon {forecastSteps}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExplorationMode('per_model')}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5 text-accent-400" />
            Mode exploration
          </button>
          <button
            onClick={() => mvRun.handleRun()}
            disabled={mvRun.isLoading}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${mvRun.isLoading ? 'animate-spin' : ''}`} />
            Recalculer
          </button>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-surface-400">Granularité:</span>
            <select
              value={displayGranularity}
              onChange={e => setDisplayGranularity(e.target.value as any)}
              className="text-xs"
            >
              <option value="auto">Auto</option>
              <option value="day">Jour</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-px overflow-x-auto">
        {[
          { key: 'overview', label: "Vue d'ensemble", icon: TrendingUp },
          { key: 'granger', label: 'Causalité de Granger', icon: GitCompare },
          { key: 'johansen', label: 'Cointégration', icon: Layers },
          { key: 'models', label: 'Modèles & Prévisions', icon: Brain },
          { key: 'irf', label: 'Réponses Impulsionnelles (IRF)', icon: TrendingUp },
          { key: 'fevd', label: 'Décomposition Variance (FEVD)', icon: BarChart3 },
          { key: 'diagnostics', label: 'Diagnostics Résidus', icon: CheckCircle2 },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <MultivariateOverviewTab
          results={mvRun.results}
          forcedModel={mvRun.forcedModel}
          integrationOrders={mvRun.integrationOrders}
          isLoading={mvRun.isLoading}
          onQuickRerun={mvRun.handleRun}
        />
      )}

      {activeTab === 'granger' && (
        <MultivariateGrangerTab
          results={mvRun.results}
          isLoading={mvRun.isLoading}
          onQuickRerun={mvRun.handleRun}
        />
      )}

      {activeTab === 'johansen' && <MultivariateJohansenTab results={mvRun.results} />}

      {activeTab === 'models' && (
        <MultivariateModelsTab
          results={mvRun.results}
          selectedModel={mvRun.selectedModel}
          setSelectedModel={mvRun.setSelectedModel}
          currentModel={currentModel}
          displayGranularity={displayGranularity}
        />
      )}

      {(activeTab === 'irf' || activeTab === 'fevd' || activeTab === 'diagnostics') && (
        <MultivariateDiagnosticsTab activeTab={activeTab} currentModel={currentModel} />
      )}
    </div>
  );
}