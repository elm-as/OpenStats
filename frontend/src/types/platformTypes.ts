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

export interface FeatureRangeNumeric {
  type: 'numeric';
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
}

export interface FeatureRangeCategorical {
  type: 'categorical';
  categories: string[];
  mode: string;
}

export interface FeatureRanges {
  features: string[];
  ranges: Record<string, FeatureRangeNumeric | FeatureRangeCategorical>;
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

