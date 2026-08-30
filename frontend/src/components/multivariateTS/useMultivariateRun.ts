import { useState, useMemo } from 'react';
import { useRunMultivariateTimeSeriesMutation } from '../../store/api';
import type { MultivariateTimeSeriesResults } from '../../types';

export function useMultivariateRun(
  datasetId: string,
  dateCol: string,
  valueCols: string[],
  forecastSteps: number
) {
  const [runMVTS, { isLoading }] = useRunMultivariateTimeSeriesMutation();
  const [results, setResults] = useState<MultivariateTimeSeriesResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const [forcedModel, setForcedModel] = useState<
    'auto' | 'var' | 'vecm' | 'ardl' | 'bvar' | 'pairwise_var' | 'varmax'
  >('auto');
  const [targetCol, setTargetCol] = useState<string>('');
  const [bvarLambda1, setBvarLambda1] = useState(0.2);
  const [bvarLambda2, setBvarLambda2] = useState(0.5);
  const [varDataMode, setVarDataMode] = useState<'auto' | 'levels' | 'diff'>('auto');
  const [varTrend, setVarTrend] = useState<'c' | 'ct' | 'ctt' | 'n'>('c');
  const [grangerDataMode, setGrangerDataMode] = useState<'auto' | 'levels' | 'diff'>('auto');

  const [maxLag, setMaxLag] = useState(12);
  const [icCriterion, setIcCriterion] = useState<'aic' | 'bic' | 'hqic' | 'fpe'>('aic');
  const [irfPeriods, setIrfPeriods] = useState(20);
  const [fevdPeriods, setFevdPeriods] = useState(20);
  const [confidenceLevel, setConfidenceLevel] = useState(0.95);
  const [bootstrapIrf, setBootstrapIrf] = useState(false);
  const [irfOrth, setIrfOrth] = useState(true);
  const [vecmDetOrder, setVecmDetOrder] = useState(0);
  const [maxDiffOrder, setMaxDiffOrder] = useState(2);

  const handleRun = async (overrides?: Record<string, any>) => {
    if (!dateCol || valueCols.length < 2) {
      setError('Sélectionnez une colonne date et au moins 2 colonnes numériques');
      return;
    }
    setError(null);
    try {
      const vdm = overrides?.var_data_mode ?? varDataMode;
      const gdm = overrides?.granger_data_mode ?? grangerDataMode;
      const vt = overrides?.var_trend ?? varTrend;
      const fm = overrides?.forced_model ?? forcedModel;

      const payload: Record<string, any> = {
        date_col: dateCol,
        value_cols: valueCols,
        forecast_steps: forecastSteps,
        forced_model: fm === 'auto' ? undefined : fm,
        var_data_mode: vdm,
        var_trend: vt,
        granger_data_mode: gdm,
        max_lag: maxLag,
        ic_criterion: icCriterion,
        irf_periods: irfPeriods,
        fevd_periods: fevdPeriods,
        confidence_level: confidenceLevel,
        bootstrap_irf: bootstrapIrf,
        irf_orth: irfOrth,
        vecm_deterministic: vecmDetOrder,
        max_diff_order: maxDiffOrder,
      };

      if (fm === 'ardl' && targetCol) payload.target_col = targetCol;
      if (fm === 'bvar') {
        payload.bvar_lambda1 = bvarLambda1;
        payload.bvar_lambda2 = bvarLambda2;
      }

      const res = await runMVTS({ id: datasetId, ...payload } as any).unwrap();
      setResults(res);
      if (res.best_model) setSelectedModel(res.best_model);
      if (overrides?.var_data_mode) setVarDataMode(overrides.var_data_mode);
      if (overrides?.granger_data_mode) setGrangerDataMode(overrides.granger_data_mode);
      if (overrides?.var_trend) setVarTrend(overrides.var_trend);
      if (overrides?.forced_model) setForcedModel(overrides.forced_model);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
    }
  };

  const integrationOrders = useMemo(() => {
    if (!results?.stationarity) return [];
    return Object.entries(results.stationarity).map(([col, st]) => [
      col,
      typeof (st as any).order_of_integration === 'number'
        ? (st as any).order_of_integration
        : st.is_stationary
        ? 0
        : 1,
    ]) as [string, number][];
  }, [results?.stationarity]);

  return {
    results,
    error,
    isLoading,
    selectedModel,
    setSelectedModel,
    forcedModel,
    setForcedModel,
    targetCol,
    setTargetCol,
    bvarLambda1,
    setBvarLambda1,
    bvarLambda2,
    setBvarLambda2,
    varDataMode,
    setVarDataMode,
    varTrend,
    setVarTrend,
    grangerDataMode,
    setGrangerDataMode,
    maxLag,
    setMaxLag,
    icCriterion,
    setIcCriterion,
    irfPeriods,
    setIrfPeriods,
    fevdPeriods,
    setFevdPeriods,
    confidenceLevel,
    setConfidenceLevel,
    bootstrapIrf,
    setBootstrapIrf,
    irfOrth,
    setIrfOrth,
    vecmDetOrder,
    setVecmDetOrder,
    maxDiffOrder,
    setMaxDiffOrder,
    handleRun,
    integrationOrders,
  };
}
