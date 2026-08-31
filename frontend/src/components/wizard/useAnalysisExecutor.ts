import { useState } from 'react';
import {
  useRunAnalysisMutation,
  useRunTestMutation,
  useTrainModelsMutation,
  useRunStationarityMutation,
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

export function useAnalysisExecutor(datasetId: string) {
  const [runAnalysis, { isLoading: analyzing }] = useRunAnalysisMutation();
  const [runTest, { isLoading: testing }] = useRunTestMutation();
  const [runStationarity, { isLoading: testingStationarity }] = useRunStationarityMutation();
  const [trainModels, { isLoading: training }] = useTrainModelsMutation();

  const [descriptiveStats, setDescriptiveStats] = useState<DescriptiveStats | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult | null>(null);
  const [vif, setVif] = useState<{ variable: string; vif: number; multicollinearity: string }[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [stationarityResult, setStationarityResult] = useState<StationarityResult | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetResults = () => {
    setError(null);
    setTestResult(null);
    setStationarityResult(null);
    setModelResults(null);
    setDescriptiveStats(null);
    setCorrelations(null);
    setVif([]);
  };

  const executeAnalysis = async (
    analysis: AnalysisCapability,
    config: Record<string, string>,
    selectedModels: string[],
    setWizardStep: (step: WizardStep) => void
  ) => {
    setError(null);
    setWizardStep('results');

    try {
      if (analysis.key === 'descriptive_numeric' || analysis.key === 'descriptive_categorical') {
        const result = await runAnalysis(datasetId).unwrap();
        setDescriptiveStats(result.descriptive_stats as DescriptiveStats);
        setCorrelations(null);
        setVif([]);
      } else if (analysis.key === 'correlation_pearson' || analysis.key === 'correlation_spearman') {
        const result = await runAnalysis(datasetId).unwrap();
        const method = analysis.key === 'correlation_pearson' ? 'pearson' : 'spearman';
        setCorrelations((result.correlations as Record<string, CorrelationResult>)?.[method] || null);
        setDescriptiveStats(null);
        setVif([]);
      } else if (analysis.key === 'vif') {
        const result = await runAnalysis(datasetId).unwrap();
        setVif(result.vif as typeof vif);
        setDescriptiveStats(null);
        setCorrelations(null);
      } else if (analysis.key === 'test_compare_means') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'compare_means', group_col: config.group_col, value_col: config.value_col },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_correlation') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'correlation', col1: config.col1, col2: config.col2 },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_independence') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'independence', col1: config.col1, col2: config.col2 },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_stationarity') {
        const result = await runStationarity({ id: datasetId, col: config.col }).unwrap();
        setStationarityResult(result);
        setTestResult(null);
      } else if (analysis.key.startsWith('modeling_')) {
        const targetCol = config.target_column;
        if (!targetCol) {
          setError('Variable cible requise');
          return;
        }
        const res = await trainModels({
          id: datasetId,
          target_column: targetCol,
          models: selectedModels.length > 0 ? selectedModels : undefined,
          split_strategy: (config.split_strategy as any) || undefined,
        }).unwrap();
        setModelResults(res);
      } else if (analysis.key === 'timeseries' || analysis.key === 'timeseries_multivariate') {
        setWizardStep('results');
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
      setWizardStep('results');
    }
  };

  const isLoading = Boolean(analyzing || testing || training || testingStationarity);

  return {
    descriptiveStats,
    correlations,
    vif,
    testResult,
    stationarityResult,
    modelResults,
    error,
    setError,
    resetResults,
    executeAnalysis,
    isLoading,
  };
}
