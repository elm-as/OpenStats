import React from 'react';
import {
  Grid3x3,
  Hash,
  SlidersHorizontal,
  Stethoscope,
  Gauge,
  Equal,
  Database, LineChart, Brain, FileOutput, Eraser,
  BarChart2, Network, Type, Activity, Layers,
  Wand2, PlayCircle, PieChart, TrendingUp, Link2,
  AlertTriangle, GitCompare, Grid3X3, Sparkles,
  Target, Shuffle, FlaskConical, Zap, Code2,
  FileBarChart, Radar
} from 'lucide-react';

interface SidebarCategory {
  title: string;
  items: {
    type: string;
    label: string;
    icon: React.ElementType;
    color: string;
    badge?: string;
  }[];
}

const categories: SidebarCategory[] = [
  {
    title: 'Source',
    items: [
      { type: 'dataset', label: 'Source de données', icon: Database, color: '#10b981' },
    ],
  },
  {
    title: 'Préparation',
    items: [
      { type: 'typing', label: 'Détection de types', icon: Type, color: '#6366f1', badge: 'Auto' },
      { type: 'cleaning', label: 'Nettoyage', icon: Eraser, color: '#f59e0b' },
      { type: 'transform', label: 'Transformation', icon: Wand2, color: '#ec4899' },
      { type: 'computeVariable', label: 'Variable calculée', icon: Code2, color: '#a855f7' },
    ],
  },
  {
    title: 'Statistiques descriptives',
    items: [
      { type: 'descriptiveNumeric', label: 'Stats numériques', icon: BarChart2, color: '#10b981' },
      { type: 'descriptiveCategorical', label: 'Stats catégorielles', icon: PieChart, color: '#14b8a6' },
      { type: 'bootstrap', label: 'Bootstrap IC (0.95)', icon: FlaskConical, color: '#a855f7', badge: 'IC' },
    ],
  },
  {
    title: 'Corrélations & Diagnostic',
    items: [
      { type: 'correlation', label: 'Matrice de corrélation', icon: TrendingUp, color: '#3b82f6' },
      { type: 'vif', label: 'VIF (Multicolinéarité)', icon: AlertTriangle, color: '#f97316' },
      { type: 'outliers', label: 'Détection d\'anomalies', icon: AlertTriangle, color: '#f97316', badge: 'Outliers' },
    ],
  },
  {
    title: 'Tests d\'hypothèses',
    items: [
      { type: 'testCompareMeans', label: 'Comparaison moyennes', icon: GitCompare, color: '#ef4444' },
      { type: 'testAnova', label: 'ANOVA & Kruskal-Wallis', icon: GitCompare, color: '#ef4444' },
      { type: 'testCorrelation', label: 'Test de corrélation', icon: Link2, color: '#ef4444' },
      { type: 'testIndependence', label: 'Test d\'indépendance', icon: Grid3X3, color: '#ef4444' },
      { type: 'powerAnalysis', label: 'Puissance & Effet Détectable', icon: Gauge, color: '#f59e0b', badge: 'Puissance' },
      { type: 'equivalenceTest', label: "Test d'Équivalence (TOST)", icon: Equal, color: '#10b981', badge: 'Équivalence' },
      { type: 'testStationarity', label: 'Test stationnarité', icon: Activity, color: '#ef4444' },
      { type: 'testNormality', label: 'Test de normalité', icon: Activity, color: '#ef4444' },
    ],
  },
  {
    title: 'Factoriel & Clustering',
    items: [
      { type: 'pca', label: 'ACP', icon: Layers, color: '#06b6d4' },
      { type: 'ca', label: 'AFC', icon: Grid3X3, color: '#06b6d4' },
      { type: 'mca', label: 'ACM', icon: Layers, color: '#06b6d4' },
      { type: 'clustering', label: 'Clustering K-Means', icon: Radar, color: '#06b6d4' },
      { type: 'hierarchicalClustering', label: 'Clustering Hiérarchique (CAH)', icon: Radar, color: '#0ea5e9', badge: 'Dendro' },
    ],
  },
  {
    title: 'Machine Learning',
    items: [
      { type: 'regression', label: 'Régression', icon: TrendingUp, color: '#8b5cf6' },
      { type: 'classification', label: 'Classification', icon: Target, color: '#8b5cf6' },
      { type: 'explainability', label: 'Explicabilité SHAP', icon: Target, color: '#8b5cf6', badge: 'XAI' },
      { type: 'regressionDiagnostics', label: 'Diagnostics de Régression', icon: Stethoscope, color: '#ef4444', badge: 'Hypothèses' },
    ],
  },
  {
    title: 'Analyses Avancées & Causalité',
    items: [
      { type: 'panel', label: 'Économétrie de Panel (FE/RE)', icon: Grid3x3, color: '#f97316', badge: 'Panel' },
      { type: 'countModel', label: 'Modèle de Comptage (Poisson)', icon: Hash, color: '#14b8a6', badge: 'Comptage' },
      { type: 'quantileRegression', label: 'Régression Quantile', icon: SlidersHorizontal, color: '#8b5cf6', badge: 'Quantiles' },
      { type: 'survival', label: 'Analyse de Survie (KM & Cox)', icon: Activity, color: '#ec4899', badge: 'Survie' },
      { type: 'causal', label: 'Inférence Causale (PSM / DiD)', icon: GitCompare, color: '#06b6d4', badge: 'Causal' },
      { type: 'manifold', label: 't-SNE & DBSCAN', icon: Layers, color: '#8b5cf6', badge: 'Manifold' },

    ],
  },
  {
    title: 'Séries temporelles',
    items: [
      { type: 'timeseries', label: 'Univariée (ARIMA)', icon: LineChart, color: '#f59e0b' },
      { type: 'tsDecomposition', label: 'Décomposition STL', icon: LineChart, color: '#f59e0b' },
      { type: 'garch', label: 'Volatilité GARCH(1,1)', icon: TrendingUp, color: '#f59e0b', badge: 'Risk' },
      { type: 'multivariateTimeseries', label: 'Multivariée (VAR)', icon: Shuffle, color: '#f59e0b' },
      { type: 'granger', label: 'Causalité de Granger', icon: Shuffle, color: '#f59e0b' },
      { type: 'cointegration', label: 'Cointégration (Johansen)', icon: Shuffle, color: '#f59e0b' },
      { type: 'chowTest', label: 'Rupture de Chow', icon: Shuffle, color: '#f59e0b', badge: 'Chow' },
    ],
  },
  {
    title: 'Simulation',
    items: [
      { type: 'simulation', label: 'Simulation & Scénarios', icon: PlayCircle, color: '#f97316' },
    ],
  },
  {
    title: 'Avancé',
    items: [
      { type: 'sql', label: 'Requête SQL', icon: Database, color: '#3b82f6' },
      { type: 'python', label: 'Script Python', icon: Code2, color: '#f59e0b' },
    ],
  },
  {
    title: 'Visualisation',
    items: [
      { type: 'visualization', label: 'Graphique', icon: FileBarChart, color: '#14b8a6' },
    ],
  },
  {
    title: 'IA & Export',
    items: [
      { type: 'ai', label: 'Assistant IA', icon: Brain, color: '#a855f7' },
      { type: 'extension', label: 'Extension IA', icon: Sparkles, color: '#a855f7' },
      { type: 'insights', label: 'Insights narratifs', icon: Zap, color: '#a855f7' },
      { type: 'output', label: 'Rapport / Export', icon: FileOutput, color: '#ef4444' },
    ],
  },
];

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside
      className="w-56 shrink-0 flex flex-col z-10 overflow-hidden"
      style={{
        background: 'var(--ui-bg-panel)',
        borderRight: '1px solid var(--ui-border)',
        color: 'var(--ui-text)',
      }}
    >
      <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ui-border)' }}>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ui-text)' }}>
          Blocs du pipeline
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-2 py-2 space-y-3">
        {categories.map((cat) => (
          <div key={cat.title}>
            <h3 className="text-[10px] uppercase font-bold tracking-wider mb-1 px-1.5" style={{ color: 'var(--ui-text-faint)' }}>
              {cat.title}
            </h3>
            <div className="space-y-0.5">
              {cat.items.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--ui-radius-sm)] cursor-grab text-[12px] font-medium transition-colors"
                  style={{
                    background: 'var(--ui-bg-sunken)',
                    border: '1px solid var(--ui-border)',
                    color: 'var(--ui-text-secondary)',
                  }}
                  onDragStart={(event) => onDragStart(event, item.type)}
                  draggable
                >
                  <item.icon size={13} className="shrink-0" style={{ color: item.color }} />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
