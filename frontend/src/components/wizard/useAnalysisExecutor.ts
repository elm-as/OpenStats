import { useSyncExternalStore } from 'react';
import {
  useRunAnalysisMutation,
  useRunTestMutation,
  useTrainModelsMutation,
  useRunStationarityMutation,
  useRunAdvancedAnalysisMutation,
} from '../../store/api';
import type {
  AnalysisCapability,
  CorrelationResult,
  DescriptiveStats,
} from '../../types';
import type { WizardStep } from './WizardTypes';
import {
  getWizardSnapshot,
  subscribeWizardStore,
  updateWizardSession,
} from './wizardSessionStore';

const ADVANCED_KEYS = new Set([
  'survival',
  'causal',
  'panel',
  'quantileRegression',
  'powerAnalysis',
  'equivalenceTest',
]);

export interface ExecuteAnalysisOptions {
  analysis: AnalysisCapability;
  config: Record<string, string>;
  selectedModels: string[];
  setWizardStep: (step: WizardStep) => void;
}

const TEST_TYPES: Record<string, string> = {
  test_compare_means: 'compare_means',
  test_correlation: 'correlation',
  test_independence: 'independence',
};

export function useAnalysisExecutor(datasetId: string) {
  const [runAnalysis, { isLoading: analyzing }] = useRunAnalysisMutation();
  const [runTest, { isLoading: testing }] = useRunTestMutation();
  const [runStationarity, { isLoading: testingStationarity }] = useRunStationarityMutation();
  const [trainModels, { isLoading: training }] = useTrainModelsMutation();
  const [runAdvancedAnalysis, { isLoading: runningAdvanced }] = useRunAdvancedAnalysisMutation();

  const session = useSyncExternalStore(
    subscribeWizardStore,
    () => getWizardSnapshot(datasetId),
    () => getWizardSnapshot(undefined),
  );

  const resetResults = () => {
    updateWizardSession(datasetId, {
      error: null,
      testResult: null,
      stationarityResult: null,
      modelResults: null,
      descriptiveStats: null,
      correlations: null,
      vif: [],
      advancedResult: null,
    });
  };

  const dispatchAnalysis = async (opts: ExecuteAnalysisOptions) => {
    const { analysis, config, selectedModels, setWizardStep } = opts;
    if (analysis.key === 'descriptive_numeric' || analysis.key === 'descriptive_categorical') {
      const result = await runAnalysis(datasetId).unwrap();
      updateWizardSession(datasetId, {
        descriptiveStats: result.descriptive_stats as DescriptiveStats,
        correlations: null,
        vif: [],
      });
      return;
    }
    if (analysis.key === 'correlation_pearson' || analysis.key === 'correlation_spearman') {
      const result = await runAnalysis(datasetId).unwrap();
      const method = analysis.key === 'correlation_pearson' ? 'pearson' : 'spearman';
      updateWizardSession(datasetId, {
        correlations: (result.correlations as Record<string, CorrelationResult>)?.[method] || null,
        descriptiveStats: null,
        vif: [],
      });
      return;
    }
    if (analysis.key === 'vif') {
      const result = await runAnalysis(datasetId).unwrap();
      updateWizardSession(datasetId, {
        vif: result.vif as typeof session.vif,
        descriptiveStats: null,
        correlations: null,
      });
      return;
    }
    if (TEST_TYPES[analysis.key]) {
      const testType = TEST_TYPES[analysis.key];
      const testConfig: Record<string, string> =
        testType === 'compare_means'
          ? { test_type: testType, group_col: config.group_col, value_col: config.value_col }
          : { test_type: testType, col1: config.col1, col2: config.col2 };
      updateWizardSession(datasetId, {
        testResult: await runTest({ id: datasetId, config: testConfig }).unwrap(),
      });
      return;
    }
    if (analysis.key === 'test_stationarity') {
      updateWizardSession(datasetId, {
        stationarityResult: await runStationarity({ id: datasetId, col: config.col }).unwrap(),
        testResult: null,
      });
      return;
    }
    if (analysis.key.startsWith('modeling_')) {
      if (!config.target_column) {
        updateWizardSession(datasetId, { error: 'Variable cible requise' });
        return;
      }
      const res = await trainModels({
        id: datasetId,
        target_column: config.target_column,
        models: selectedModels.length > 0 ? selectedModels : undefined,
        split_strategy: (config.split_strategy as any) || undefined,
      }).unwrap();
      updateWizardSession(datasetId, { modelResults: res });
      return;
    }
    if (analysis.key === 'timeseries' || analysis.key === 'timeseries_multivariate') {
      setWizardStep('results');
      return;
    }
    if (ADVANCED_KEYS.has(analysis.key)) {
      const res = await runAdvancedAnalysis({ id: datasetId, analysis_key: analysis.key, params: config }).unwrap();
      updateWizardSession(datasetId, { advancedResult: { key: analysis.key, data: res.result } });
    }
  };

  const executeAnalysis = async (opts: ExecuteAnalysisOptions) => {
    updateWizardSession(datasetId, { error: null });
    opts.setWizardStep('results');
    try {
      await dispatchAnalysis(opts);
    } catch (err: any) {
      updateWizardSession(datasetId, { error: err?.data?.error || err?.message || 'Erreur inconnue' });
      opts.setWizardStep('results');
    }
  };

  const isLoading = Boolean(analyzing || testing || training || testingStationarity || runningAdvanced);

  return {
    descriptiveStats: session.descriptiveStats,
    correlations: session.correlations,
    vif: session.vif,
    testResult: session.testResult,
    stationarityResult: session.stationarityResult,
    modelResults: session.modelResults,
    advancedResult: session.advancedResult,
    error: session.error,
    setError: (error: string | null) => updateWizardSession(datasetId, { error }),
    resetResults,
    executeAnalysis,
    isLoading,
  };
}
