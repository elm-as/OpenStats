import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Zap,
  Brain,
  Activity,
  LayoutGrid,
  Filter,
  FileText,
} from 'lucide-react';

export type ResultTab =
  | 'overview'
  | 'cleaning'
  | 'descriptive'
  | 'correlations'
  | 'transforms'
  | 'modeling'
  | 'shap'
  | 'insights'
  | 'report';

export const TAB_META: Record<
  ResultTab,
  { label: string; icon: typeof BarChart3; color: string; bg: string }
> = {
  overview: { label: "Vue d'ensemble", icon: LayoutGrid, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  cleaning: { label: 'Nettoyage', icon: Filter, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  descriptive: { label: 'Statistiques', icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  correlations: { label: 'Corrélations', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  transforms: { label: 'Transformations', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  modeling: { label: 'Modélisation', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  shap: { label: 'Explicabilité', icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  insights: { label: 'Insights IA', icon: Activity, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  report: { label: 'Rapport', icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

export interface CleaningResult {
  actions?: Array<{ action: string; removed?: number; n_imputed?: number; dropped?: string[] }>;
  duplicates_removed?: number;
  missing_imputed?: number;
  columns_cleaned?: number;
  outliers_treated?: number;
  before_rows?: number;
  after_rows?: number;
  before_cols?: number;
  after_cols?: number;
  shape_before?: { rows: number; columns: number };
  shape_after?: { rows: number; columns: number };
  logs?: any[];
}

export interface DescriptiveResult {
  statistics?: Record<string, any>;
  stats?: Record<string, any>;
  distributions?: Record<string, any>;
}

export interface CorrelationResult {
  matrix?: Record<string, Record<string, number>>;
  correlations?: Record<string, Record<string, number>>;
  significant_pairs?: Array<{ var1: string; var2: string; coefficient: number; strength: string }>;
}

export interface ModelResult {
  ranking: Array<{
    rank: number;
    model_key: string;
    model_name: string;
    metrics: Record<string, number>;
    cv_scores?: { mean: number; std?: number };
    feature_importance?: Array<{ feature: string; importance: number }>;
    regression_summary?: any;
    model_summary?: any;
  }>;
  best_model_key?: string;
  failed?: Array<{ model_key: string; model_name: string; error: string }>;
  data_split?: {
    train_size: number;
    test_size: number;
    features?: string[];
  };
  regression_summary?: any;
  model_summary?: any;
}

export interface ShapResult {
  global_importance?: Array<{ feature: string; mean_shap: number }>;
  waterfall_example?: Array<{ feature: string; shap_value: number }>;
  note?: string;
  source?: string;
  model_name?: string;
  n_features?: number;
}

export interface InsightsResult {
  insights: Array<{
    title: string;
    message: string;
    severity: string;
    suggestion?: string;
  }>;
  summary?: Record<string, number>;
}

export interface TransformRecommendation {
  column: string;
  recommended_transform: string;
  rationale: string;
}

export interface TransformAppliedResult {
  transformations?: Array<{ column: string; transform: string }>;
  logs?: any[];
}
