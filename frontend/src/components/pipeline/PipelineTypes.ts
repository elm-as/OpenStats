import {
  TrendingUp,
  Binary,
  Target,
  Cpu,
  Sparkles,
  ShieldCheck,
  BarChart2,
  GitMerge,
  Activity,
  Compass,
  LineChart,
  Filter,
  SlidersHorizontal,
  Layers,
  Lightbulb,
  FileText,
} from 'lucide-react';

export interface EditableStep {
  key: string;
  operation: string;
  label: string;
  rationale: string;
  params: Record<string, any>;
  optional: boolean;
  enabled: boolean;
  isExpanded?: boolean;
}

export const PROBLEM_LABEL: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string; gradient: string }
> = {
  regression: {
    label: 'Régression Numérique & ML',
    icon: TrendingUp,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    gradient: 'from-blue-500/15 via-blue-500/5 to-transparent',
  },
  binary_classification: {
    label: 'Classification Binaire (2 classes)',
    icon: Binary,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
  },
  multiclass_classification: {
    label: 'Classification Multi-classes',
    icon: Target,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
    gradient: 'from-teal-500/15 via-teal-500/5 to-transparent',
  },
  forecast: {
    label: 'Séries Temporelles & Économétrie',
    icon: Cpu,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
  },
  exploration: {
    label: 'Exploration & Profilage Multivarié',
    icon: Sparkles,
    color: 'text-accent-400',
    bg: 'bg-accent-500/10',
    border: 'border-accent-500/30',
    gradient: 'from-accent-500/15 via-accent-500/5 to-transparent',
  },
};

export function getAvailableAnalyses(profile: any, selectedTarget: string | null) {
  return [
    {
      key: 'clean',
      category: 'prep' as const,
      label: "Contrôle d'intégrité & Nettoyage",
      description: 'Vérification et traitement des doublons, valeurs manquantes et constantes.',
      icon: ShieldCheck,
      recommended: true,
      applicable: true,
      badgeText: 'Essentiel',
    },
    {
      key: 'descriptive',
      category: 'prep' as const,
      label: 'Statistiques Descriptives & Distributions',
      description: "Tendances centrales, dispersions, quartiles et tests d'asymétrie.",
      icon: BarChart2,
      recommended: true,
      applicable: true,
      badgeText: 'Essentiel',
    },
    {
      key: 'correlations',
      category: 'prep' as const,
      label: 'Matrice de Corrélation & Dépendances',
      description: 'Détection des associations linéaires et de rangs entre variables.',
      icon: GitMerge,
      recommended: (profile?.numeric_cols?.length || 0) >= 2,
      applicable: (profile?.numeric_cols?.length || 0) >= 2,
    },
    {
      key: 'stationarity',
      category: 'timeseries' as const,
      label: 'Tests de Stationnarité (ADF & KPSS)',
      description: "Détecte les racines unitaires et calcule l'ordre d'intégration I(0)/I(1).",
      icon: Activity,
      recommended: Boolean(profile?.has_temporal),
      applicable: Boolean(profile?.has_temporal && (profile?.numeric_cols?.length || 0) > 0),
      badgeText: profile?.has_temporal ? 'Recommandé Économétrie' : undefined,
    },
    {
      key: 'cointegration',
      category: 'timeseries' as const,
      label: 'Test de Cointégration de Johansen',
      description: "Vérifie les relations d'équilibre de long terme entre séries non-stationnaires.",
      icon: Compass,
      recommended: Boolean(profile?.has_temporal && (profile?.numeric_cols?.length || 0) >= 2),
      applicable: Boolean(profile?.has_temporal && (profile?.numeric_cols?.length || 0) >= 2),
      badgeText: 'Long Terme',
    },
    {
      key: 'timeseries_forecast',
      category: 'timeseries' as const,
      label: 'Prévision Temporelle (ARIMA / Holt-Winters)',
      description: 'Modélisation univariée avec projection future et intervalles de confiance.',
      icon: LineChart,
      recommended: Boolean(profile?.has_temporal && selectedTarget),
      applicable: Boolean(profile?.has_temporal && selectedTarget),
      badgeText: 'Prévision',
    },
    {
      key: 'panel',
      category: 'timeseries' as const,
      label: 'Économétrie de Panel (Effets Fixes / Aléatoires)',
      description:
        "Entités suivies dans le temps : effets fixes, effets aléatoires et test de Hausman.",
      icon: Layers,
      recommended: Boolean(profile?.is_panel),
      applicable: Boolean(profile?.is_panel),
      badgeText: profile?.is_panel ? 'Structure détectée' : undefined,
    },
    {
      key: 'timeseries_multivariate',
      category: 'timeseries' as const,
      label: 'Modélisation Multivariée (VAR / VECM / ARDL)',
      description: 'Dynamiques croisées, causalité de Granger et chocs impulsionnels.',
      icon: Cpu,
      recommended: Boolean(profile?.has_temporal && (profile?.numeric_cols?.length || 0) >= 2),
      applicable: Boolean(profile?.has_temporal && (profile?.numeric_cols?.length || 0) >= 2),
      badgeText: 'Multivarié',
    },
    {
      key: 'count_model',
      category: 'model' as const,
      label: 'Modèle de Comptage (Poisson / Binomiale négative)',
      description:
        "Pour une cible de dénombrement : teste la surdispersion et évite les prédictions négatives.",
      icon: Binary,
      recommended: false,
      applicable: true,
      badgeText: 'Comptage',
    },
    {
      key: 'regression_diagnostics',
      category: 'model' as const,
      label: 'Diagnostics du Modèle (hypothèses)',
      description:
        "Homoscédasticité, indépendance des résidus et forme fonctionnelle : un R² élevé ne garantit pas des p-values fiables.",
      icon: ShieldCheck,
      recommended: true,
      applicable: true,
      badgeText: 'Hypothèses',
    },
    {
      key: 'vif',
      category: 'model' as const,
      label: 'Vérification Multicolinéarité (VIF)',
      description: 'Détecte les corrélations excessives avant modélisation.',
      icon: Filter,
      recommended: Boolean(selectedTarget && (profile?.numeric_cols?.length || 0) >= 3),
      applicable: Boolean((profile?.numeric_cols?.length || 0) >= 3),
    },
    {
      key: 'transform',
      category: 'prep' as const,
      label: 'Normalisation & Standardisation',
      description: "Mise à l'échelle automatique des variables prédictives.",
      icon: SlidersHorizontal,
      recommended: Boolean(selectedTarget),
      applicable: (profile?.numeric_cols?.length || 0) > 0,
    },
    {
      key: 'pca',
      category: 'prep' as const,
      label: 'Analyse en Composantes Principales (ACP)',
      description: 'Réduction de dimensions et projection sur les axes factoriels majeurs.',
      icon: Layers,
      recommended: (profile?.numeric_cols?.length || 0) >= 4,
      applicable: (profile?.numeric_cols?.length || 0) >= 3,
    },
    {
      key: 'model',
      category: 'model' as const,
      label: profile?.has_temporal
        ? 'Modélisation ML (Validation Temporelle)'
        : 'Modélisation Machine Learning Compétitive',
      description: profile?.has_temporal
        ? 'Entraînement multi-modèles avec validation temporelle TimeSeriesSplit sans fuite de données.'
        : 'Compétition multi-modèles (Ridge, Lasso, Random Forest, XGBoost) avec CV k-fold.',
      icon: TrendingUp,
      recommended: Boolean(selectedTarget),
      applicable: Boolean(selectedTarget),
      badgeText: 'Modélisation',
    },
    {
      key: 'explainability',
      category: 'model' as const,
      label: 'Explicabilité SHAP & Feature Importance',
      description: 'Attribution des contributions locales et globales de chaque variable.',
      icon: Lightbulb,
      recommended: Boolean(selectedTarget),
      applicable: Boolean(selectedTarget),
      badgeText: 'Interprétabilité',
    },
    {
      key: 'insights',
      category: 'output' as const,
      label: 'Synthèse & Recommandations Méthodologiques',
      description: 'Génération de conclusions statistiques et aide à la décision opérationnelle.',
      icon: Sparkles,
      recommended: true,
      applicable: true,
      badgeText: 'Synthèse',
    },
    {
      key: 'report',
      category: 'output' as const,
      label: 'Génération du Rapport Professionnel (PDF)',
      description: 'Compilation automatisée de tous les résultats dans un document exportable.',
      icon: FileText,
      recommended: true,
      applicable: true,
      badgeText: 'Export',
    },
  ];
}
