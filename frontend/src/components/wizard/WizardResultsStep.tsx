import React from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import type {
  AnalysisCapability,
  DescriptiveStats,
  CorrelationResult,
  TestResult,
  ModelResults,
} from '../../types';
import type { StationarityResult } from '../../store/api';
import {
  DescriptiveResults,
  CorrelationResults,
  VifResults,
} from './DescriptiveResultsView';
import {
  HypothesisTestResults,
  StationarityResults,
} from './HypothesisResultsView';
import { ModelingResults } from './ModelingResultsView';
import ChartBuilder from '../chartBuilder/ChartBuilder';
import TimeSeriesPanel from '../multivariateTS/TimeSeriesPanel';
import MultivariateTimeSeriesPanel from '../multivariateTS/MultivariateTimeSeriesPanel';
import TransformPanel from '../transform/TransformPanel';
import FactorAnalysisPanel from '../factorAnalysis/FactorAnalysisPanel';
import SimulationPanel from '../scenarios/SimulationPanel';
import ScenarioBuilder from '../scenarios/ScenarioBuilder';
import { SurvivalResultView } from '../canvas/results/SurvivalResultView';
import { CausalResultView } from '../canvas/results/StatisticalTestsResultView';
import { PanelResultView } from '../canvas/results/PanelResultView';
import { AnalyticResultView } from '../canvas/results/AnalyticResultView';
const ExtensionPanel = React.lazy(() => import('../extension/ExtensionPanel'));

interface WizardResultsStepProps {
  datasetId: string;
  selectedAnalysis: AnalysisCapability;
  capabilities: any;
  configValues: Record<string, string>;
  descriptiveStats: DescriptiveStats | null;
  correlations: CorrelationResult | null;
  vif: { variable: string; vif: number; multicollinearity: string }[];
  testResult: TestResult | null;
  stationarityResult: StationarityResult | null;
  modelResults: ModelResults | null;
  advancedResult?: { key: string; data: any } | null;
  isLoading: boolean;
  error: string | null;
  onReset: () => void;
  onRefetchCapabilities: () => void;
}

export function WizardResultsStep({
  datasetId,
  selectedAnalysis,
  capabilities,
  configValues,
  descriptiveStats,
  correlations,
  vif,
  testResult,
  stationarityResult,
  modelResults,
  advancedResult,
  isLoading,
  error,
  onReset,
  onRefetchCapabilities,
}: WizardResultsStepProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            {selectedAnalysis.label}
          </h2>
          <p className="text-sm ui-t-muted mt-1">Résultats de l'analyse</p>
        </div>
        <button onClick={onReset} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Nouvelle analyse
        </button>
      </div>

      {isLoading && (
        <div className="card p-12 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
          <p className="ui-t-muted mt-4">Calcul en cours...</p>
        </div>
      )}

      {error && !isLoading && (
        <div
          className="card p-6"
          style={{ background: 'var(--ui-danger-soft)', borderColor: 'var(--ui-danger)' }}
        >
          <p style={{ color: 'var(--ui-danger)' }}>{error}</p>
          <button onClick={onReset} className="mt-3 text-sm underline" style={{ color: 'var(--ui-danger)' }}>
            Essayer une autre analyse
          </button>
        </div>
      )}

      {/* Descriptive stats results */}
      {descriptiveStats && selectedAnalysis.key.startsWith('descriptive') && (
        <DescriptiveResults stats={descriptiveStats} type={selectedAnalysis.key} />
      )}

      {/* Correlation results */}
      {correlations && selectedAnalysis.key.startsWith('correlation_') && (
        <CorrelationResults correlations={correlations} />
      )}

      {/* VIF results */}
      {vif.length > 0 && selectedAnalysis.key === 'vif' && <VifResults vif={vif} />}

      {/* Stationarity results */}
      {stationarityResult && selectedAnalysis.key === 'test_stationarity' && (
        <StationarityResults result={stationarityResult} />
      )}

      {/* Hypothesis test results */}
      {testResult &&
        selectedAnalysis.key.startsWith('test_') &&
        selectedAnalysis.key !== 'test_stationarity' && (
          <HypothesisTestResults result={testResult} config={configValues} />
        )}

      {/* Model results */}
      {modelResults && selectedAnalysis.key.startsWith('modeling_') && (
        <ModelingResults results={modelResults} />
      )}

      {/* Advanced R / econometrics results (Survival, Causal, Panel, Quantiles, Power, TOST) */}
      {advancedResult && advancedResult.key === selectedAnalysis.key && (
        <>
          {advancedResult.key === 'survival' && <SurvivalResultView resultData={advancedResult.data} />}
          {advancedResult.key === 'causal' && <CausalResultView resultData={advancedResult.data} />}
          {advancedResult.key === 'panel' && <PanelResultView resultData={advancedResult.data} />}
          {advancedResult.key === 'quantileRegression' && (
            <AnalyticResultView resultData={advancedResult.data} titre="Régression quantile" couleur="#0284c7" />
          )}
          {advancedResult.key === 'powerAnalysis' && (
            <AnalyticResultView resultData={advancedResult.data} titre="Puissance statistique" couleur="#d97706" />
          )}
          {advancedResult.key === 'equivalenceTest' && (
            <AnalyticResultView resultData={advancedResult.data} titre="Test d'équivalence (TOST)" couleur="#059669" />
          )}
        </>
      )}

      {/* Time series (univarié) */}
      {selectedAnalysis.key === 'timeseries' && capabilities && (
        <TimeSeriesPanel
          datasetId={datasetId}
          capabilities={capabilities}
          configValues={configValues}
          onBack={onReset}
        />
      )}

      {/* Time series (multivarié — VAR / VECM) */}
      {selectedAnalysis.key === 'timeseries_multivariate' && capabilities && (
        <MultivariateTimeSeriesPanel
          datasetId={datasetId}
          capabilities={capabilities}
          configValues={configValues}
          onBack={onReset}
        />
      )}

      {/* Transformations */}
      {selectedAnalysis.key === 'transforms' && (
        <TransformPanel datasetId={datasetId} onTransformApplied={onRefetchCapabilities} />
      )}

      {/* Analyse factorielle (ACP / AFC / ACM) */}
      {(selectedAnalysis.key === 'pca' ||
        selectedAnalysis.key === 'ca' ||
        selectedAnalysis.key === 'mca') &&
        capabilities && (
          <FactorAnalysisPanel
            datasetId={datasetId}
            capabilities={capabilities}
            onBack={onReset}
            initialMethod={selectedAnalysis.key}
          />
        )}

      {/* Simulation / Prédiction */}
      {selectedAnalysis.key === 'simulation' && (
        <SimulationPanel datasetId={datasetId} onBack={onReset} />
      )}

      {/* Scénarios et simulation avancée */}
      {selectedAnalysis.key === 'scenarios' && (
        <ScenarioBuilder datasetId={datasetId} onBack={onReset} />
      )}

      {/* Extensions IA */}
      {selectedAnalysis.key === 'user_extension' && (
        <React.Suspense
          fallback={
            <div className="card p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
              <p className="text-surface-400 mt-4">Chargement du studio d'extension...</p>
            </div>
          }
        >
          <ExtensionPanel datasetId={datasetId} />
        </React.Suspense>
      )}

      {/* Chart builder */}
      {selectedAnalysis.key === 'chart_builder' && capabilities && (
        <ChartBuilder datasetId={datasetId} capabilities={capabilities} onBack={onReset} />
      )}
    </>
  );
}
