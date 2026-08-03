// Types principaux pour OpenStats — Elmas Labs

export interface DatasetSummary {
  id: string;
  name: string;
  created_at: string;
  shape: { rows: number; columns: number };
  versions_count?: number;
  file_size?: number;
}

export interface ColumnProfile {
  nom_brut: string;
  nom_lisible: string;
  type_statistique: string;
  type_regex: string | null;
  unite_mesure: string | null;
  domaine_unite: string | null;
  taux_nullite: number;
  cardinalite: number;
  stats: Record<string, unknown>;
}

export interface DatasetProfile {
  shape: { rows: number; columns: number };
  memory_usage_mb: number;
  dtypes: Record<string, string>;
  dictionary: ColumnProfile[];
  excel_sheets?: string[];
  selected_sheet?: string;
}

export interface DatasetDetail {
  id: string;
  name: string;
  created_at: string;
  profile: DatasetProfile;
  cleaning_log: CleaningLog[];
}

export interface CleaningLog {
  step: string;
  message: string;
  details: Record<string, unknown>;
}

export interface CleaningStepConfig {
  step: string;
  config: Record<string, unknown>;
}

export interface CleaningResult {
  shape_before: { rows: number; columns: number };
  shape_after: { rows: number; columns: number };
  logs: CleaningLog[];
}

// ── Historique, versions, audit ──

export interface DatasetVersion {
  id: number;
  dataset_id: string;
  version_number: number;
  label: string;
  description: string | null;
  rows: number;
  columns: number;
  operations_log: unknown[];
  created_at: string;
}

export interface AnalysisHistoryEntry {
  id: string;
  dataset_id: string;
  dataset_version: number;
  analysis_type: string;
  parameters: Record<string, unknown>;
  result_summary: Record<string, unknown> | null;
  status: string;
  duration_ms: number | null;
  created_at: string;
  error_message?: string;
}

export interface AuditLogEntry {
  id: number;
  dataset_id: string;
  action: string;
  parameters: Record<string, unknown>;
  version_before: number | null;
  version_after: number | null;
  created_at: string;
}

// ── Jobs asynchrones ──

export interface JobStatus {
  id: string;
  dataset_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  progress_message: string | null;
  parameters: Record<string, unknown>;
  result_id: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

// ── Intervalles de confiance ──

export interface ConfidenceInterval {
  point_estimate: number;
  ci_lower: number;
  ci_upper: number;
  se: number;
}

export interface BootstrapCI {
  bootstrap_ci: {
    mean: ConfidenceInterval;
    median: ConfidenceInterval;
    std: ConfidenceInterval;
  };
  ci_level: number;
  n_bootstrap: number;
  n_obs: number;
}

export interface DescriptiveStats {
  [column: string]: {
    name: string;
    type: 'numeric' | 'categorical';
    count: number;
    mean?: number;
    median?: number;
    std?: number;
    min?: number;
    max?: number;
    skewness?: number;
    kurtosis?: number;
    null_count: number;
    null_rate: number;
    cardinality?: number;
    top_values?: Record<string, number>;
    confidence_intervals?: BootstrapCI;
  };
}

export interface CorrelationResult {
  matrix: Record<string, Record<string, number>>;
  ci_lower?: Record<string, Record<string, number>>;
  ci_upper?: Record<string, Record<string, number>>;
  ci_level?: number;
  columns: string[];
  method: string;
  significant_pairs: {
    var1: string;
    var2: string;
    coefficient: number;
    strength: string;
  }[];
}

export interface TestResult {
  test: string;
  statistic: number;
  p_value: number;
  significant: boolean;
  effect_size: Record<string, unknown>;
  interpretation?: string;
}

export interface ModelRanking {
  rank: number;
  model_key: string;
  model_name: string;
  task_type: string;
  best_params: Record<string, unknown>;
  metrics: Record<string, unknown>;
  cv_scores: { mean: number; std?: number };
  feature_importance: { feature: string; importance: number }[];
}

export interface ModelResults {
  task_type: string;
  ranking: ModelRanking[];
  failed: { model_key: string; model_name: string; error: string }[];
  best_model_key: string | null;
  shap: {
    global_importance: { feature: string; mean_shap: number }[];
    waterfall_example: { feature: string; shap_value: number }[];
  } | null;
  data_split: {
    train_size: number;
    test_size: number;
    features: string[];
    strategy?: 'random' | 'time';
    temporal_column?: string | null;
    train_time_range?: { start: string | null; end: string | null } | null;
    test_time_range?: { start: string | null; end: string | null } | null;
  };
  diagnostics?: {
    best_r2?: number;
    quality_flag?: 'ok' | 'critical';
    message?: string;
  };
}

export interface PreviewData {
  columns: string[];
  dtypes: Record<string, string>;
  data: Record<string, unknown>[];
  total_rows: number;
}

// ── Wizard Capabilities ──

export interface AnalysisCapability {
  key: string;
  label: string;
  description: string;
  category: 'descriptive' | 'correlation' | 'diagnostic' | 'hypothesis' | 'modeling' | 'timeseries' | 'visualization' | 'transformation' | 'factorielle' | 'simulation';
  icon: string;
  available: boolean;
  requires: string;
  applicable_columns?: string[];
  config_fields?: ConfigField[];
  reason?: string | null;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'select' | 'multiselect';
  options: string[];
}

export interface DataCapabilities {
  dataset_id: string;
  columns: {
    numeric: string[];
    discrete: string[];
    categorical: string[];
    grouping: string[];
    binary: string[];
    temporal: string[];
  };
  column_groups: Record<string, number>;
  excluded_columns: string[];
  analyses: AnalysisCapability[];
  summary: {
    total_columns: number;
    active_columns: number;
    excluded_count: number;
    numeric_count: number;
    discrete_count: number;
    categorical_count: number;
    binary_count: number;
    temporal_count: number;
  };
}

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

// ── Chart Builder ──

export interface ChartDataRequest {
  chart_type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'stacked_bar' | 'bubble' | 'heatmap' | 'radar';
  x_col?: string;
  y_cols?: string[];
  group_col?: string;
  color_col?: string;
  size_col?: string;
  chart_title?: string;
  log_y?: boolean;
  aggregation?: 'mean' | 'sum' | 'count' | 'median' | 'min' | 'max';
  time_granularity?: 'auto' | 'day' | 'month' | 'year';
  top_n?: number;
}

export interface ChartDataResponse {
  chart_type: string;
  data: Record<string, unknown>[];
  x_col?: string;
  y_col?: string;
  color_col?: string;
  size_col?: string;
  chart_title?: string;
  log_y?: boolean;
  series?: string[];
  error?: string;
}

// ── Transformations ──

export interface TransformCatalogItem {
  key: string;
  label: string;
  description: string;
  applies_to: string;
  fixes: string[];
}

export interface TransformRecommendation {
  column: string;
  issue: string;
  issue_label: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  suggested_transforms: string[];
  category: string;
  note?: string;
}

export interface TransformPreview {
  column: string;
  transform: string;
  original: {
    values: (number | null)[];
    mean: number | null;
    std: number | null;
    skewness: number | null;
    kurtosis: number | null;
    min: number | null;
    max: number | null;
  };
  transformed: {
    values: (number | null)[];
    mean: number | null;
    std: number | null;
    skewness: number | null;
    kurtosis: number | null;
    min: number | null;
    max: number | null;
  };
  meta: Record<string, unknown>;
}

export interface TransformLog {
  column: string;
  new_column?: string;
  transform: string;
  label?: string;
  before?: Record<string, number | null>;
  after?: Record<string, number | null>;
  success: boolean;
  error?: string;
}

export interface TransformApplyResult {
  logs: TransformLog[];
  applied: boolean;
  shape: { rows: number; columns: number };
}

// ── Analyse Factorielle ──

export interface PCAResult {
  method: 'ACP';
  n_observations: number;
  n_variables: number;
  n_components: number;
  variables: string[];
  component_labels: string[];
  eigenvalues: (number | null)[];
  explained_variance_ratio: (number | null)[];
  cumulative_variance: (number | null)[];
  loadings: Record<string, Record<string, number | null>>;
  scores: Record<string, number | null>[];
  contrib_var: Record<string, Record<string, number | null>>;
  cos2_var: Record<string, Record<string, number | null>>;
  contrib_ind_summary: Record<string, { mean: number | null; max: number | null; top_5: { index: number; value: number | null }[] }>;
  correlation_circle: Record<string, { x: number | null; y: number | null }>;
}

export interface CAResult {
  method: 'AFC';
  row_variable: string;
  col_variable: string;
  n_rows: number;
  n_cols: number;
  n_components: number;
  total_inertia: number | null;
  component_labels: string[];
  eigenvalues: (number | null)[];
  explained_variance_ratio: (number | null)[];
  cumulative_variance: (number | null)[];
  contingency_table: { rows: string[]; cols: string[]; values: number[][] };
  row_coords: Record<string, Record<string, number | null>>;
  col_coords: Record<string, Record<string, number | null>>;
  row_contrib: Record<string, Record<string, number | null>>;
  col_contrib: Record<string, Record<string, number | null>>;
  row_cos2: Record<string, Record<string, number | null>>;
  col_cos2: Record<string, Record<string, number | null>>;
}

export interface MCAResult {
  method: 'ACM';
  n_observations: number;
  n_variables: number;
  n_modalities: number;
  n_components: number;
  variables: string[];
  component_labels: string[];
  eigenvalues: (number | null)[];
  explained_variance_ratio: (number | null)[];
  cumulative_variance: (number | null)[];
  modality_info: { variable: string; modality: string; full: string }[];
  modality_coords: Record<string, Record<string, number | null>>;
  modality_contrib: Record<string, Record<string, number | null>>;
  modality_cos2: Record<string, Record<string, number | null>>;
  individual_coords: Record<string, number | null>[];
  eta2: Record<string, Record<string, number>>;
}

// ── Simulation / Prédiction ──

export interface FeatureRanges {
  features: string[];
  ranges: Record<string, { min: number; max: number; mean: number; median: number; std: number }>;
  task_type: string;
  best_model_key: string | null;
}

export interface PredictionResult {
  predictions: (number | string)[];
  task_type: string;
  model_used: string | null;
  features_used: string[];
  probabilities?: Record<string, number>[];
}

// ── Auth ──

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'analyst' | 'viewer';
  is_active: boolean;
  created_at: string | null;
  last_login: string | null;
  google_id: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

export interface RefreshResponse {
  user: AuthUser;
  access_token: string;
}

// ── Workspaces ──

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
  members_count: number;
  datasets_count: number;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  user: { id: string; display_name: string; role: string } | null;
}

export interface WorkspaceDetail extends WorkspaceSummary {
  members: WorkspaceMember[];
}

// ── Marketplace ──

export interface MarketplaceItemSummary {
  id: string;
  name: string;
  description: string;
  category: 'template' | 'extension';
  item_type: string;
  author: string;
  version: string;
  icon: string;
  tags: string[];
  featured: boolean;
  downloads: number;
}

export interface MarketplaceItemDetail extends MarketplaceItemSummary {
  payload: {
    nodes?: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges?: Array<{
      source: string;
      target: string;
    }>;
    code?: string;
    [key: string]: unknown;
  };
}
