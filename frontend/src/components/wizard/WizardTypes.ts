import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  GitCompare,
  Layers,
  PieChart,
  Link2,
  Grid3X3,
  Brain,
  Target,
  Zap,
  Sparkles,
  LineChart as LineChartIcon,
} from 'lucide-react';

export type WizardStep = 'overview' | 'select' | 'configure' | 'results';

export const CATEGORY_META: Record<
  string,
  { label: string; icon: typeof BarChart3; color: string; bg: string }
> = {
  descriptive: { label: 'Statistiques descriptives', icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25' },
  correlation: { label: 'Corrélations', icon: TrendingUp, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/25' },
  diagnostic: { label: 'Diagnostics', icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/25' },
  hypothesis: { label: "Tests d'hypothèses", icon: GitCompare, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25' },
  transformation: { label: 'Transformations', icon: Zap, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/25' },
  factorielle: { label: 'Analyse factorielle', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/25' },
  modeling: { label: 'Modélisation', icon: Brain, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  simulation: { label: 'Simulation', icon: Target, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/25' },
  timeseries: { label: 'Séries temporelles', icon: TrendingUp, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/25' },
  visualization: { label: 'Visualisation', icon: LineChartIcon, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/25' },
  extension: { label: 'Extensions IA', icon: Sparkles, color: 'text-accent-400', bg: 'bg-accent-500/10 border-accent-500/25' },
};

export const ICON_MAP: Record<string, typeof BarChart3> = {
  bar_chart: BarChart3,
  pie_chart: PieChart,
  trending_up: TrendingUp,
  alert_triangle: AlertTriangle,
  git_compare: GitCompare,
  link: Link2,
  grid: Grid3X3,
  layers: Layers,
};

export function fmt(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(3);
}

export function fmtMetric(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(4);
}

export function getModelsForType(analysisKey: string) {
  const regression = [
    { key: 'linear_regression', label: 'Régression Linéaire (OLS)' },
    { key: 'ridge', label: 'Ridge (L2)' },
    { key: 'lasso', label: 'Lasso (L1)' },
    { key: 'elasticnet', label: 'ElasticNet' },
    { key: 'polynomial_regression', label: 'Régression Polynomiale' },
    { key: 'decision_tree', label: 'Arbre de Décision' },
    { key: 'random_forest', label: 'Random Forest' },
    { key: 'gradient_boosting', label: 'Gradient Boosting' },
    { key: 'xgboost', label: 'XGBoost' },
    { key: 'lightgbm', label: 'LightGBM' },
    { key: 'svr', label: 'SVR (SVM Régression)' },
    { key: 'knn', label: 'K-Plus Proches Voisins' },
  ];
  const classification = [
    { key: 'logistic_regression', label: 'Régression Logistique' },
    { key: 'decision_tree', label: 'Arbre de Décision' },
    { key: 'random_forest', label: 'Random Forest' },
    { key: 'gradient_boosting', label: 'Gradient Boosting' },
    { key: 'adaboost', label: 'AdaBoost' },
    { key: 'xgboost', label: 'XGBoost' },
    { key: 'lightgbm', label: 'LightGBM' },
    { key: 'svm', label: 'Support Vector Machine (SVM)' },
    { key: 'knn', label: 'K-Plus Proches Voisins' },
    { key: 'lda', label: 'Analyse Discriminante Linéaire (LDA)' },
    { key: 'qda', label: 'Analyse Discriminante Quadratique (QDA)' },
  ];
  return analysisKey === 'modeling_regression' ? regression : classification;
}
