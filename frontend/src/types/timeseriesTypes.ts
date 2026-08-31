// ── Time Series ──

export interface TimeSeriesForecast {
  dates: string[];
  values: (number | null)[];
  lower_ci?: (number | null)[] | null;
  upper_ci?: (number | null)[] | null;
}

export interface TimeSeriesModelResult {
  model: string;
  order?: number[];
  seasonal_order?: number[];
  aic: number | null;
  bic?: number | null;
  sse?: number | null;
  history: {
    dates: string[];
    values: (number | null)[];
    fitted: (number | null)[];
  };
  forecast: TimeSeriesForecast;
  error?: string;
  residuals_mean?: number | null;
  residuals_std?: number | null;
  smoothing_params?: Record<string, number | null>;
}

export interface TimeSeriesResults {
  date_col: string;
  value_col: string;
  n_observations: number;
  date_range: { start: string; end: string };
  frequency: string;
  seasonal_period: number;
  stationarity: {
    adf: { statistic: number; p_value: number; is_stationary: boolean; interpretation: string } | { error: string };
    kpss: { statistic: number; p_value: number; is_stationary: boolean; interpretation: string } | { error: string };
    conclusion: string;
    is_stationary: boolean;
  };
  decomposition: {
    model: string;
    period: number;
    dates: string[];
    observed: (number | null)[];
    trend: (number | null)[];
    seasonal: (number | null)[];
    residual: (number | null)[];
  } | null;
  models: Record<string, TimeSeriesModelResult>;
  ranking: { model: string; key: string; aic: number; bic?: number | null }[];
  best_model: string | null;
  error?: string;
}

// ── Multivariate Time Series (VAR / VECM) ──

export interface GrangerCausalityResult {
  max_lag: number;
  data_regime?: 'levels' | 'diff';
  matrix: Record<string, Record<string, number | null>>;
  columns: string[];
  details: {
    cause: string;
    effect: string;
    p_value: number | null;
    optimal_lag?: number | null;
    significant: boolean;
    interpretation: string;
  }[];
}

export interface JohansenTestResult {
  det_order: number;
  k_ar_diff: number;
  trace_tests: {
    hypothesis: string;
    statistic: number | null;
    critical_value_95: number | null;
    reject: boolean;
  }[];
  max_eigenvalue_tests: {
    hypothesis: string;
    statistic: number | null;
    critical_value_95: number | null;
    reject: boolean;
  }[];
  cointegration_rank: number;
  has_cointegration: boolean;
  raw_cointegration_rank?: number;
  raw_has_cointegration?: boolean;
  assumption_valid?: boolean;
  assumption_message?: string;
  vecm_eligible?: boolean;
  interpretation: string;
  error?: string;
}

export interface IntegrationDiagnostics {
  orders: Record<string, number>;
  unique_orders: number[];
  homogeneous: boolean;
  mixed_orders: boolean;
  all_i0: boolean;
  all_i1: boolean;
  max_order: number | null;
  interpretation: string;
}

export interface IRFData {
  periods: number;
  data: Record<string, Record<string, (number | null)[]>>;
  variables: string[];
  sigma_u?: Record<string, number>;
  descriptive_stats?: Record<string, { mean: number; std: number; min: number; max: number }>;
  error?: string;
}

export interface FEVDData {
  periods: number;
  data: Record<string, Record<string, (number | null)[]>>;
  variables: string[];
  error?: string;
}

export interface MultivariateModelResult {
  model: string;
  data_regime?: 'levels' | 'diff';
  var_trend?: 'c' | 'ct' | 'ctt' | 'n';
  variables: string[];
  n_observations: number;
  aic: number | null;
  bic?: number | null;
  hqic?: number | null;
  fpe?: number | null;
  lag_order?: number;
  k_ar_diff?: number;
  coint_rank?: number;
  cointegration_vectors?: Record<string, Record<string, number | null>>;
  history: {
    dates: string[];
    series: Record<string, (number | null)[]>;
    fitted: Record<string, (number | null)[]>;
    fitted_dates?: string[];
  };
  forecast: {
    dates: string[];
    series: Record<string, (number | null)[]>;
  };
  irf?: IRFData;
  fevd?: FEVDData;
  error?: string;
  // ARDL specific
  target_col?: string;
  ardl_order?: { ar_lags: number[]; dl_lags: Record<string, number[]> };
  bounds_test?: {
    f_statistic: number | null;
    p_value: number | null;
    critical_values: Record<string, { I0: number | null; I1: number | null }>;
    conclusion: string;
    cointegration_detected: boolean;
    error?: string;
  };
  // BVAR specific
  bvar_hyperparameters?: { lambda1: number; lambda2: number };
  // Pairwise VAR specific
  n_pairs?: number;
  pairs?: {
    variables: string[];
    lag_order?: number | null;
    aic: number | null;
    bic?: number | null;
    error?: string;
    granger_significant?: string[];
  }[];
  // Residual diagnostics
  diagnostics?: {
    summary: {
      all_ljung_box_ok: boolean;
      all_jarque_bera_ok: boolean;
      all_durbin_watson_ok: boolean;
      model_adequate: boolean;
      issues: string[];
      interpretation: string;
    };
    per_variable: Record<string, {
      ljung_box?: { statistic: number; p_value: number; lags: number; ok: boolean; interpretation: string; error?: string };
      jarque_bera?: { statistic: number; p_value: number; skewness: number; kurtosis: number; ok: boolean; interpretation: string; error?: string };
      durbin_watson?: { statistic: number; ok: boolean; interpretation: string; error?: string };
      residual_mean?: number;
      residual_std?: number;
      error?: string;
    }>;
    error?: string;
  };
}

export interface ModelSuitability {
  suitable: boolean;
  recommended: boolean;
  reason: string;
}

export interface MultivariateTimeSeriesResults {
  type: 'multivariate';
  date_col: string;
  value_cols: string[];
  n_variables: number;
  n_observations: number;
  date_range: { start: string; end: string };
  frequency: string;
  stationarity: Record<string, {
    adf: { statistic: number; p_value: number; is_stationary: boolean; interpretation: string } | { error: string };
    kpss: { statistic: number; p_value: number; is_stationary: boolean; interpretation: string } | { error: string };
    conclusion: string;
    is_stationary: boolean;
  }>;
  all_stationary: boolean;
  integration_diagnostics?: IntegrationDiagnostics;
  granger_causality: GrangerCausalityResult;
  johansen_cointegration: JohansenTestResult;
  models: Record<string, MultivariateModelResult>;
  ranking: { model: string; key: string; aic: number; bic?: number | null }[];
  best_model: string | null;
  recommendation: string;
  model_suitability?: Record<string, ModelSuitability>;
  methodological_pivot?: {
    forced_model?: string | null;
    var_data_mode?: 'auto' | 'levels' | 'diff';
    var_trend?: 'c' | 'ct' | 'ctt' | 'n';
    granger_data_mode?: 'auto' | 'levels' | 'diff';
    applied_var_regime?: 'levels' | 'diff';
    applied_granger_regime?: 'levels' | 'diff';
    diff_orders?: Record<string, number>;
    vecm_eligible?: boolean;
    integration_interpretation?: string;
    reason?: string;
  };
  error?: string;
}
