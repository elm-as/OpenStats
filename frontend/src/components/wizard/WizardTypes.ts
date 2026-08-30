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
  descriptive: { label: 'Statistiques descriptives', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  correlation: { label: 'Corrélations', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  diagnostic: { label: 'Diagnostics', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  hypothesis: { label: "Tests d'hypothèses", icon: GitCompare, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  transformation: { label: 'Transformations', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  factorielle: { label: 'Analyse factorielle', icon: Layers, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
  modeling: { label: 'Modélisation', icon: Brain, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  simulation: { label: 'Simulation', icon: Target, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  timeseries: { label: 'Séries temporelles', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
  visualization: { label: 'Visualisation', icon: LineChartIcon, color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
  extension: { label: 'Extensions IA', icon: Sparkles, color: 'text-accent-500', bg: 'bg-accent-500/10 border-accent-500/20' },
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
