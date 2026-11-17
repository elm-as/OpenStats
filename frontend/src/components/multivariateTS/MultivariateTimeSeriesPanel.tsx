import { useState } from 'react';
import type { DataCapabilities } from '../../types';
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
import { PerModelExploration } from './PerModelExploration';
import { usePerModelExploration } from './usePerModelExploration';
import { MultivariateConfigForm } from './MultivariateConfigForm';
import { MultivariateOverviewTab } from './MultivariateOverviewTab';
import {
  MultivariateGrangerTab,
  MultivariateJohansenTab,
} from './MultivariateGrangerJohansenTabs';
import { MultivariateModelsTab } from './MultivariateModelsTab';
import { MultivariateDiagnosticsTab } from './MultivariateDiagnosticsTab';
import { useMultivariateRun } from './useMultivariateRun';

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

  const mvRun = useMultivariateRun({ datasetId, dateCol, valueCols, forecastSteps });

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
      <div className="ui-panel p-10 text-center">
        <div className="animate-spin w-7 h-7 border-2 border-accent-500 border-t-transparent rounded-full mx-auto" />
        <p className="ui-t-secondary mt-3 text-sm font-medium">
          Estimation des modèles multivariés (VAR, VECM, ARDL, BVAR)…
        </p>
        <p className="text-xs ui-t-muted mt-1">
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
          <button onClick={onBack} className="ui-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <div>
            <h3 className="text-base font-bold text-[var(--ui-text)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent-400" />
              Séries Temporelles Multivariées
            </h3>
            <p className="text-xs ui-t-muted ui-num">
              {mvRun.results.n_variables} variables • {mvRun.results.n_observations} observations •
              Horizon {forecastSteps}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExplorationMode('per_model')}
            className="ui-btn text-xs"
          >
            <Activity className="w-3.5 h-3.5 text-accent-400" />
            Mode exploration
          </button>
          <button
            onClick={() => mvRun.handleRun()}
            disabled={mvRun.isLoading}
            className="ui-btn text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${mvRun.isLoading ? 'animate-spin' : ''}`} />
            Recalculer
          </button>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs ui-t-muted">Granularité:</span>
            <select
              value={displayGranularity}
              onChange={e => setDisplayGranularity(e.target.value as any)}
              className="ui-select text-xs"
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
      <div className="flex gap-1 border-b pb-px overflow-x-auto" style={{ borderColor: 'var(--ui-border)' }}>
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
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                active
                  ? 'border-accent-400 text-accent-400'
                  : 'border-transparent ui-t-muted hover:text-[var(--ui-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
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