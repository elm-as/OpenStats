import { useState } from 'react';
import {
  useRunAnalysisMutation,
  useRunTestMutation,
  useTrainModelsMutation,
  useRunStationarityMutation,
  useRunAdvancedAnalysisMutation,
  type StationarityResult,
} from '../../store/api';
import type {
  AnalysisCapability,
  DescriptiveStats,
  CorrelationResult,
  TestResult,
  ModelResults,
} from '../../types';
import type { WizardStep } from './WizardTypes';

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

  const [descriptiveStats, setDescriptiveStats] = useState<DescriptiveStats | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult | null>(null);
  const [vif, setVif] = useState<{ variable: string; vif: number; multicollinearity: string }[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [stationarityResult, setStationarityResult] = useState<StationarityResult | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [advancedResult, setAdvancedResult] = useState<{ key: string; data: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetResults = () => {
    setError(null);
    setTestResult(null);
    setStationarityResult(null);
    setModelResults(null);
    setDescriptiveStats(null);
    setCorrelations(null);
    setVif([]);
    setAdvancedResult(null);
  };

  const dispatchAnalysis = async (opts: ExecuteAnalysisOptions) => {
    const { analysis, config, selectedModels, setWizardStep } = opts;
    if (analysis.key === 'descriptive_numeric' || analysis.key === 'descriptive_categorical') {
      const result = await runAnalysis(datasetId).unwrap();
      setDescriptiveStats(result.descriptive_stats as DescriptiveStats);
      setCorrelations(null);
      setVif([]);
      return;
    }
    if (analysis.key === 'correlation_pearson' || analysis.key === 'correlation_spearman') {
      const result = await runAnalysis(datasetId).unwrap();
      const method = analysis.key === 'correlation_pearson' ? 'pearson' : 'spearman';
      setCorrelations((result.correlations as Record<string, CorrelationResult>)?.[method] || null);
      setDescriptiveStats(null);
      setVif([]);
      return;
    }
    if (analysis.key === 'vif') {
      const result = await runAnalysis(datasetId).unwrap();
      setVif(result.vif as typeof vif);
      setDescriptiveStats(null);
      setCorrelations(null);
      return;
    }
    if (TEST_TYPES[analysis.key]) {
      const testType = TEST_TYPES[analysis.key];
      const testConfig: Record<string, string> =
        testType === 'compare_means'
          ? { test_type: testType, group_col: config.group_col, value_col: config.value_col }
          : { test_type: testType, col1: config.col1, col2: config.col2 };
      setTestResult(await runTest({ id: datasetId, config: testConfig }).unwrap());
      return;
    }
    if (analysis.key === 'test_stationarity') {
      setStationarityResult(await runStationarity({ id: datasetId, col: config.col }).unwrap());
      setTestResult(null);
      return;
    }
    if (analysis.key.startsWith('modeling_')) {
      if (!config.target_column) {
        setError('Variable cible requise');
        return;
      }
      const res = await trainModels({
        id: datasetId,
        target_column: config.target_column,
        models: selectedModels.length > 0 ? selectedModels : undefined,
        split_strategy: (config.split_strategy as any) || undefined,
      }).unwrap();
      setModelResults(res);
      return;
    }
    if (analysis.key === 'timeseries' || analysis.key === 'timeseries_multivariate') {
      setWizardStep('results');
      return;
    }
    if (ADVANCED_KEYS.has(analysis.key)) {
      const res = await runAdvancedAnalysis({ id: datasetId, analysis_key: analysis.key, params: config }).unwrap();
      setAdvancedResult({ key: analysis.key, data: res.result });
    }
  };

  const executeAnalysis = async (opts: ExecuteAnalysisOptions) => {
    setError(null);
    opts.setWizardStep('results');
    try {
      await dispatchAnalysis(opts);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
      opts.setWizardStep('results');
    }
  };

  const isLoading = Boolean(analyzing || testing || training || testingStationarity || runningAdvanced);

  return {
    descriptiveStats,
    correlations,
    vif,
    testResult,
    stationarityResult,
    modelResults,
    advancedResult,
    error,
    setError,
    resetResults,
    executeAnalysis,
    isLoading,
  };
}
