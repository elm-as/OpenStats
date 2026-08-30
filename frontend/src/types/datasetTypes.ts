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

