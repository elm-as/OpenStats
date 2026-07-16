import React from 'react';
import {
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
    ],
  },
  {
    title: 'Corrélations & Diagnostic',
    items: [
      { type: 'correlation', label: 'Matrice de corrélation', icon: TrendingUp, color: '#3b82f6' },
      { type: 'vif', label: 'VIF (Multicolinéarité)', icon: AlertTriangle, color: '#f97316' },
    ],
  },
  {
    title: 'Tests d\'hypothèses',
    items: [
      { type: 'testCompareMeans', label: 'Comparaison moyennes', icon: GitCompare, color: '#ef4444' },
      { type: 'testCorrelation', label: 'Test de corrélation', icon: Link2, color: '#ef4444' },
      { type: 'testIndependence', label: 'Test d\'indépendance', icon: Grid3X3, color: '#ef4444' },
      { type: 'testStationarity', label: 'Test stationnarité', icon: Activity, color: '#ef4444' },
    ],
  },
  {
    title: 'Factoriel & Clustering',
    items: [
      { type: 'pca', label: 'ACP', icon: Layers, color: '#06b6d4' },
      { type: 'ca', label: 'AFC', icon: Grid3X3, color: '#06b6d4' },
      { type: 'mca', label: 'ACM', icon: Layers, color: '#06b6d4' },
      { type: 'clustering', label: 'Clustering', icon: Radar, color: '#06b6d4' },
    ],
  },
  {
    title: 'Machine Learning',
    items: [
      { type: 'regression', label: 'Régression', icon: TrendingUp, color: '#8b5cf6' },
      { type: 'classification', label: 'Classification', icon: Target, color: '#8b5cf6' },
    ],
  },
  {
    title: 'Séries temporelles',
    items: [
      { type: 'timeseries', label: 'Univariée (ARIMA)', icon: LineChart, color: '#f59e0b' },
      { type: 'multivariateTimeseries', label: 'Multivariée (VAR)', icon: Shuffle, color: '#f59e0b' },
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
    <aside className="w-64 shrink-0 flex flex-col z-10 border-r border-white/[0.08] bg-surface-950/90 backdrop-blur-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-white/[0.06]">
        <h1 className="font-black text-base mb-1 bg-gradient-to-r from-accent-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
          Canvas d'Analyse
        </h1>
        <p className="text-[11px] text-surface-500 leading-snug">
          Glissez les blocs pour construire votre pipeline.
        </p>
      </div>

      {/* Scrollable categories */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-4">
        {categories.map((cat) => (
          <div key={cat.title}>
            <h3 className="text-[10px] uppercase text-surface-500 font-bold tracking-[0.15em] mb-2 px-1">
              {cat.title}
            </h3>
            <div className="space-y-1.5">
              {cat.items.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-grab font-medium text-[12px] transition-all duration-200 border border-transparent hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
                  style={{
                    background: `${item.color}10`,
                    borderColor: `${item.color}20`,
                  }}
                  onDragStart={(event) => onDragStart(event, item.type)}
                  draggable
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${item.color}20` }}
                  >
                    <item.icon size={14} style={{ color: item.color }} />
                  </div>
                  <span className="text-surface-200 truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className="ml-auto text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{ color: item.color, background: `${item.color}15` }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
