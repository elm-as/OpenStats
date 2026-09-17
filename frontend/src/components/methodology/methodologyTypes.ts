/** Types du pipeline méthodologique (miroir de app/core/pipeline). */

export interface StageTable {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

/** Spécification de graphique émise par le backend, rendue par StageCharts. */
export interface ChartSpec {
  kind:
    | 'missing_matrix' | 'histogram' | 'bar' | 'heatmap' | 'scatter' | 'box'
    | 'severity_bar' | 'severity_progress' | 'importance' | 'residuals'
    | 'model_comparison';
  title: string;
  [key: string]: unknown;
}

export type StageStatus = 'success' | 'skipped' | 'error';

export interface Remedy {
  action: string;
  columns: string[];
  label: string;
  rationale: string;
  params: Record<string, unknown>;
  aggressive: boolean;
}

export interface Issue {
  key: string;
  code: string;
  columns: string[];
  severity: number;
  metric: number | null;
  metric_label: string;
  title: string;
  detail: string;
  blocks_modeling: boolean;
  remedies: Remedy[];
}

export interface ColumnStats {
  n?: number;
  missing?: number;
  mean?: number;
  std?: number;
  skew?: number;
  outlier_ratio?: number;
  rows?: number;
  columns?: number;
}

export interface AppliedRemedy extends Remedy {
  ok: boolean;
  message: string;
  before: Record<string, ColumnStats>;
  after: Record<string, ColumnStats>;
}

export interface Iteration {
  index: number;
  severity_before: number;
  severity_after: number;
  gain: number;
  issues_before: Issue[];
  issues_after: Issue[];
  applied: AppliedRemedy[];
  resolved: string[];
  stop_reason: string | null;
  kept: boolean;
}

export interface CorrectionReport {
  iterations: Iteration[];
  initial: { count: number; severity_total: number; blocking: number; by_code: Record<string, number> };
  final: { count: number; severity_total: number; blocking: number; by_code: Record<string, number> };
  remaining_issues: Issue[];
  stop_reason: string;
  modeling_flags: string[];
  ready_for_modeling: boolean;
  shape_before: { rows: number; columns: number };
  shape_after: { rows: number; columns: number };
  columns_removed: string[];
}

export interface Stage {
  key: string;
  index: number;
  title: string;
  status: StageStatus;
  headline: string;
  tables: StageTable[];
  charts: ChartSpec[];
  notes: string[];
  data: Record<string, unknown>;
  duration_ms: number;
}

export interface MethodologyResult {
  elapsed_sec: number;
  problem_type: string;
  target: string | null;
  shape_before: { rows: number; columns: number };
  shape_after: { rows: number; columns: number };
  stages: Stage[];
}

export type MethodologyEvent =
  | { type: 'start'; total_stages: number; rows: number; columns: number }
  | { type: 'stage'; stage: Stage }
  | { type: 'complete' } & Partial<MethodologyResult>
  | { type: 'error'; error: string };

/** Libellés courts des codes de problème, pour les puces et les légendes. */
export const ISSUE_LABELS: Record<string, string> = {
  duplicates: 'doublons',
  constant: 'colonne constante',
  identifier_like: 'identifiant déguisé',
  missing: 'valeurs manquantes',
  outliers: 'valeurs extrêmes',
  skewed: 'asymétrie',
  collinearity: 'colinéarité',
  non_stationary: 'non-stationnarité',
  heteroskedastic: 'hétéroscédasticité',
};

export const issueLabel = (code: string) => ISSUE_LABELS[code] ?? code.replace(/_/g, ' ');

/** Une correction est structurelle si elle ne change pas l'échelle des variables. */
export const STRUCTURAL_ACTIONS = new Set(['drop_columns', 'drop_duplicates', 'impute', 'robust_se']);
