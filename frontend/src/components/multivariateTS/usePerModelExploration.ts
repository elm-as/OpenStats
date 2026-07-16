import { useState, useCallback } from 'react';
import { useRunMultivariateTimeSeriesMutation } from '../../store/api';
import type { MultivariateTimeSeriesResults } from '../../types';
import { MODEL_DEFS } from './constants';

export interface PerModelConfig {
  data_mode?: 'auto' | 'levels' | 'diff';
  trend?: 'c' | 'ct' | 'ctt' | 'n';
  target_col?: string;
  lambda1?: number;
  lambda2?: number;
}

export interface PerModelRun {
  results: MultivariateTimeSeriesResults | null;
  error: string | null;
}

export interface UsePerModelExplorationProps {
  datasetId: string;
  dateCol: string;
  valueCols: string[];
  forecastSteps: number;
  parsedForecastDates: string[] | undefined;
  grangerDataMode: 'auto' | 'levels' | 'diff';
  maxLag: number;
  icCriterion: 'aic' | 'bic' | 'hqic' | 'fpe';
  irfPeriods: number;
  fevdPeriods: number;
  confidenceLevel: number;
  bootstrapIrf: boolean;
  irfOrth: boolean;
  vecmDetOrder: number;
  maxDiffOrder: number;
}

export function usePerModelExploration(props: UsePerModelExplorationProps) {
  const {
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
  } = props;

  const [runMVTS] = useRunMultivariateTimeSeriesMutation();

  const [activeModelTab, setActiveModelTab] = useState('var');
  const [perModelResults, setPerModelResults] = useState<Record<string, PerModelRun>>({});
  const [perModelConfigs, setPerModelConfigs] = useState<Record<string, PerModelConfig>>({
    var: { data_mode: 'auto', trend: 'c' },
    vecm: { data_mode: 'auto' },
    ardl: { target_col: '' },
    bvar: { data_mode: 'auto', lambda1: 0.2, lambda2: 0.5 },
    pairwise_var: { data_mode: 'auto' },
    varmax: { data_mode: 'auto' },
  });
  const [runningModel, setRunningModel] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [displayGranularity, setDisplayGranularity] = useState<'auto' | 'day' | 'month' | 'year'>('auto');

  const updateModelConfig = useCallback((model: string, field: keyof PerModelConfig, value: string | number) => {
    setPerModelConfigs(prev => ({
      ...prev,
      [model]: { ...prev[model], [field]: value },
    }));
  }, []);

  const runSingleModel = useCallback(async (modelKey: string) => {
    if (!dateCol || valueCols.length < 2) return;
    const cfg = perModelConfigs[modelKey] || {};
    setRunningModel(modelKey);
    try {
      const res = await runMVTS({
        id: datasetId,
        date_col: dateCol,
        value_cols: valueCols,
        forecast_steps: forecastSteps,
        granger_max_lag: 4,
        forced_model: modelKey as any,
        var_data_mode: cfg.data_mode || 'auto',
        var_trend: cfg.trend || 'c',
        granger_data_mode: grangerDataMode,
        forecast_dates: parsedForecastDates,
        target_col: modelKey === 'ardl' ? (cfg.target_col || valueCols[0]) : undefined,
        bvar_lambda1: modelKey === 'bvar' ? (cfg.lambda1 ?? 0.2) : undefined,
        bvar_lambda2: modelKey === 'bvar' ? (cfg.lambda2 ?? 0.5) : undefined,
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
      setPerModelResults(prev => ({ ...prev, [modelKey]: { results: res, error: res.error || null } }));
    } catch (err: any) {
      setPerModelResults(prev => ({ ...prev, [modelKey]: { results: null, error: err?.data?.error || `Erreur ${modelKey.toUpperCase()}` } }));
    } finally {
      setRunningModel(null);
    }
  }, [datasetId, dateCol, valueCols, forecastSteps, grangerDataMode, parsedForecastDates, perModelConfigs, maxLag, icCriterion, irfPeriods, fevdPeriods, confidenceLevel, bootstrapIrf, irfOrth, vecmDetOrder, maxDiffOrder, runMVTS]);

  const runAllModels = useCallback(async () => {
    setIsRunningAll(true);
    for (const { key } of MODEL_DEFS) {
      setActiveModelTab(key);
      await runSingleModel(key);
    }
    setActiveModelTab('summary');
    setIsRunningAll(false);
  }, [runSingleModel]);

  const completedCount = Object.values(perModelResults).filter(r => r.results).length;
  const activeConfig = perModelConfigs[activeModelTab] || {};
  const activeRun = perModelResults[activeModelTab];

  return {
    activeModelTab,
    setActiveModelTab,
    perModelResults,
    perModelConfigs,
    runningModel,
    isRunningAll,
    displayGranularity,
    setDisplayGranularity,
    completedCount,
    activeConfig,
    activeRun,
    updateModelConfig,
    runSingleModel,
    runAllModels,
  };
}
