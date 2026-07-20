import React, { lazy, Suspense, useState, useMemo, useEffect } from 'react';
import type { Layout, Config } from 'plotly.js';
import {
  SlidersHorizontal,
  Download,
  Info,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Settings,
  Image,
  FileCode,
  Check,
} from 'lucide-react';

// ── Thème dark partagé pour tous les graphes scientifiques ──
export const DARK_TEMPLATE: Partial<Layout> = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: {
    family: 'Inter, system-ui, sans-serif',
    color: '#c5ccdd',
    size: 12,
  },
  xaxis: {
    gridcolor: 'rgba(255,255,255,0.05)',
    zerolinecolor: 'rgba(255,255,255,0.15)',
    linecolor: 'rgba(255,255,255,0.15)',
    tickfont: { color: '#a3adc8', size: 11 },
    title: { font: { color: '#dfe3ee', size: 12 } },
  },
  yaxis: {
    gridcolor: 'rgba(255,255,255,0.05)',
    zerolinecolor: 'rgba(255,255,255,0.15)',
    linecolor: 'rgba(255,255,255,0.15)',
    tickfont: { color: '#a3adc8', size: 11 },
    title: { font: { color: '#dfe3ee', size: 12 } },
  },
  legend: {
    bgcolor: 'rgba(20,24,54,0.4)',
    bordercolor: 'rgba(255,255,255,0.1)',
    borderwidth: 1,
    font: { color: '#c5ccdd' },
  },
  margin: { l: 60, r: 20, t: 40, b: 50 },
  hoverlabel: {
    bgcolor: '#141836',
    bordercolor: '#06b6d4',
    font: { family: 'Inter, system-ui, sans-serif', color: '#dfe3ee' },
  },
};

// ── Thème light partagé pour tous les graphes scientifiques ──
export const LIGHT_TEMPLATE: Partial<Layout> = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  font: {
    family: 'Inter, system-ui, sans-serif',
    color: '#1e293b',
    size: 12,
  },
  xaxis: {
    gridcolor: 'rgba(0,0,0,0.06)',
    zerolinecolor: 'rgba(0,0,0,0.12)',
    linecolor: 'rgba(0,0,0,0.12)',
    tickfont: { color: '#475569', size: 11 },
    title: { font: { color: '#0f172a', size: 12 } },
  },
  yaxis: {
    gridcolor: 'rgba(0,0,0,0.06)',
    zerolinecolor: 'rgba(0,0,0,0.12)',
    linecolor: 'rgba(0,0,0,0.12)',
    tickfont: { color: '#475569', size: 11 },
    title: { font: { color: '#0f172a', size: 12 } },
  },
  legend: {
    bgcolor: 'rgba(255,255,255,0.8)',
    bordercolor: 'rgba(0,0,0,0.1)',
    borderwidth: 1,
    font: { color: '#1e293b' },
  },
  margin: { l: 60, r: 20, t: 40, b: 50 },
  hoverlabel: {
    bgcolor: '#ffffff',
    bordercolor: '#06b6d4',
    font: { family: 'Inter, system-ui, sans-serif', color: '#0f172a' },
  },
};

// Hook pour observer le changement de thème sur l'élément html
function useCurrentTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (document.documentElement.dataset.theme as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const currentTheme = document.documentElement.dataset.theme as 'dark' | 'light';
          setTheme(currentTheme || 'dark');
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

export const DEFAULT_CONFIG: Partial<Config> = {
  displayModeBar: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
  toImageButtonOptions: {
    format: 'png',
    height: 600,
    width: 1000,
    scale: 2,
  },
};

// Palettes scientifiques premium
export const SCI_COLORS = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#6366f1', // indigo
];

export const PALETTES: Record<string, { label: string; colors: string[] }> = {
  default: { label: 'Scientifique', colors: SCI_COLORS },
  emerald: { label: 'Émeraude & Menthe', colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#047857', '#a7f3d0'] },
  sunset: { label: 'Coucher de soleil', colors: ['#f43f5e', '#ec4899', '#f472b6', '#f59e0b', '#fbbf24', '#fb7185'] },
  cyberpunk: { label: 'Néon Cyberpunk', colors: ['#ff007f', '#00f0ff', '#ab00ff', '#ffd700', '#00ff66', '#ff0033'] },
  cool: { label: 'Océan Cool', colors: ['#3b82f6', '#60a5fa', '#1d4ed8', '#2563eb', '#93c5fd', '#1e40af'] },
  warm: { label: 'Terre & Ambre', colors: ['#f59e0b', '#d97706', '#b45309', '#fcd34d', '#78350f', '#fef3c7'] },
  monochrome: { label: 'Monochrome épuré', colors: ['#94a3b8', '#64748b', '#475569', '#cbd5e1', '#334155', '#e2e8f0'] },
};

export const COLORSCALE_VIRIDIS = 'Viridis';
export const COLORSCALE_RDBU = 'RdBu';

// ── Helper Régression Linéaire pour les trendlines ──
function getLinearRegression(x: number[], y: number[]) {
  const points = x.map((xv, idx) => ({ x: xv, y: y[idx] }))
                  .filter(p => typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
  
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  const xValues = points.map(p => p.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);

  return { minX, maxX, slope, intercept };
}

// ── Aide à l'interprétation automatique pour non-codeurs ──
function getChartInterpretation(chartType: string, title?: string, data?: any[]): string {
  const lowerTitle = (title || '').toLowerCase();
  
  if (lowerTitle.includes('corrélation') || chartType === 'heatmap') {
    return "Cette matrice de corrélation mesure la force et la direction de l'association linéaire entre vos variables. Un score de +1 (bleu foncé) indique une corrélation positive parfaite, -1 (rouge foncé) une corrélation négative parfaite, et 0 l'absence de relation.";
  }
  if (lowerTitle.includes('shap') || lowerTitle.includes('importance des variables')) {
    return "Ce graphique identifie les variables prédictives les plus décisives pour le modèle. Plus la barre est longue, plus la variable a d'influence sur les prédictions finales.";
  }
  if (lowerTitle.includes('prévision') || lowerTitle.includes('forecast')) {
    return "Ce graphique affiche les prévisions futures estimées d'après votre historique. La zone colorée représente l'intervalle de confiance (généralement à 95%) : plus elle est étroite, plus la prévision est jugée précise.";
  }
  if (lowerTitle.includes('décomposition')) {
    return "La décomposition de série temporelle isole la Tendance globale (évolution à long terme), la Saisonnalité (variations périodiques répétitives) et le Résidu (bruit aléatoire inexpliqué).";
  }
  if (lowerTitle.includes('roc') || lowerTitle.includes('auc')) {
    return "La courbe ROC évalue la capacité de discrimination d'un classifieur binaire. Un modèle idéal tend vers le coin supérieur gauche (AUC proche de 1.0), tandis qu'un modèle aléatoire suit la diagonale (AUC = 0.5).";
  }
  if (lowerTitle.includes('résidus') || lowerTitle.includes('qq-plot')) {
    return "Les diagnostics des résidus valident la régularité statistique du modèle. Sur le QQ-Plot, les points doivent suivre au mieux la ligne droite diagonale. Sur le graphique des résidus, ils doivent être répartis de manière homogène sans motif identifiable.";
  }

  switch (chartType) {
    case 'histogram':
      return "L'histogramme modélise la distribution d'une variable numérique. Il montre où se concentrent vos données (le pic) et leur dispersion (étalement).";
    case 'box':
      return "La boîte à moustaches résume graphiquement la dispersion : le rectangle délimite les quartiles Q1 à Q3 (50% de vos données), le trait central est la médiane. Les points isolés signalent des anomalies potentielles (valeurs aberrantes).";
    case 'violin':
      return "Le diagramme en violon associe une boîte à moustaches et une estimation de densité. Il permet de voir plus précisément la symétrie, l'étalement et d'éventuelles distributions multimodales.";
    case 'pie':
      return "Le diagramme circulaire illustre la répartition proportionnelle de vos catégories. Recommandé pour des comparaisons d'ensembles simples n'excédant pas 5 ou 6 parts.";
    case 'scatter':
      return "Le nuage de points affiche l'interaction entre deux variables numériques. Il permet de détecter visuellement des tendances, des regroupements (clusters) ou des valeurs isolées.";
    case 'bubble':
      return "Le graphique à bulles enrichit le nuage de points en ajoutant une troisième dimension numérique représentée par le diamètre des bulles.";
    case 'bar':
    case 'stacked_bar':
      return "Le graphique à barres compare les amplitudes de différentes catégories ou groupes de données.";
    default:
      return "Visualisation de données interactive. Utilisez les outils de zoom, survol et déplacement pour explorer précisément chaque point.";
  }
}

// ── PlotlyChart (lazy-load pour ne pas tirer 4.6 MB de Plotly au dashboard) ──
const HeavyPlotlyChart = lazy(() => import('./PlotlyHeavy'));

interface PlotlyChartProps {
  data: any[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  height?: number | string;
  className?: string;
}

function PlotlySkeleton({ height = 400, className = '' }: { height?: number | string; className?: string }) {
  return (
    <div
      className={`w-full rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center ${className}`}
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-surface-500">
        <div className="w-5 h-5 border-2 border-surface-600 border-t-accent-400 rounded-full animate-spin" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Chargement…</span>
      </div>
    </div>
  );
}

/** Wrapper Plotly avec thème dark uniforme + lazy-load + personnalisation premium + exports. */
export function PlotlyChart({ data, layout = {}, config = {}, height = 400, className = '' }: PlotlyChartProps) {
  const theme = useCurrentTheme();
  const activeTemplate = theme === 'light' ? LIGHT_TEMPLATE : DARK_TEMPLATE;

  // États de personnalisation locale
  const [showSettings, setShowSettings] = useState(false);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [palette, setPalette] = useState('default');
  const [showGrid, setShowGrid] = useState(true);
  const [legendPos, setLegendPos] = useState<'right' | 'bottom' | 'none'>('bottom');
  const [pointSize, setPointSize] = useState(6);
  const [lineWidth, setLineWidth] = useState(2);
  const [opacity, setOpacity] = useState(0.85);
  const [trendline, setTrendline] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  // Type générique du graphique d'après la première trace
  const detectedChartType = data?.[0]?.type || 'scatter';
  const chartTitle = (layout?.title as any)?.text || '';

  // Vérifier si le trendline (droite de régression) est applicable (Scatter numérique uniquement)
  const isScatterNumeric = useMemo(() => {
    return data?.some(t => {
      const isTypeOk = t.type === 'scatter' || !t.type;
      const isModeOk = t.mode?.includes('markers') || !t.mode;
      const isDataOk = Array.isArray(t.x) && t.x.length > 1 && typeof t.x[0] === 'number';
      return isTypeOk && isModeOk && isDataOk;
    });
  }, [data]);

  // Appliquer les surcharges dynamiques sur les données et la mise en page
  const { customizedData, customizedLayout } = useMemo(() => {
    const colors = PALETTES[palette]?.colors || SCI_COLORS;
    const finalData = data.map((t, idx) => {
      const traceColor = colors[idx % colors.length];
      const copy = { ...t };

      // 1. Gestion des couleurs selon le type de graphe
      if (copy.type === 'pie') {
        copy.marker = { ...copy.marker, colors };
      } else if (copy.type === 'heatmap') {
        // Laisser les colormaps (Viridis/RdBu) configurés par défaut
      } else {
        copy.marker = {
          ...copy.marker,
          color: copy.marker?.color || traceColor,
          opacity: opacity,
          size: pointSize,
        };
        copy.line = {
          ...copy.line,
          color: copy.line?.color || traceColor,
          width: lineWidth,
        };
      }

      // 2. Gestion des Data Labels
      if (showLabels) {
        if (copy.type === 'bar') {
          copy.texttemplate = '%{y:.2f}';
          copy.textposition = 'auto';
        } else if (copy.type === 'scatter' || !copy.type) {
          copy.mode = 'markers+text' + (copy.mode?.includes('lines') ? '+lines' : '');
          copy.text = (copy.y as any[])?.map(v => typeof v === 'number' ? v.toFixed(1) : '');
          copy.textposition = 'top center';
        }
      }

      return copy;
    });

    // 3. Calcul de la tendance (trendline) à la volée
    if (trendline && isScatterNumeric) {
      const targetTrace = data.find(t => Array.isArray(t.x) && Array.isArray(t.y));
      if (targetTrace) {
        const reg = getLinearRegression(targetTrace.x as number[], targetTrace.y as number[]);
        if (reg) {
          finalData.push({
            x: [reg.minX, reg.maxX],
            y: [reg.slope * reg.minX + reg.intercept, reg.slope * reg.maxX + reg.intercept],
            type: 'scatter',
            mode: 'lines',
            name: 'Tendance linéaire',
            line: { color: '#ef4444', width: 2, dash: 'dash' },
            hovertemplate: `y = ${reg.slope.toFixed(3)}x + ${reg.intercept.toFixed(3)}<extra></extra>`,
          } as any);
        }
      }
    }

    // 4. Alignement du Layout
    const finalLayout: Partial<Layout> = {
      ...activeTemplate,
      ...layout,
      xaxis: {
        ...activeTemplate.xaxis,
        ...layout.xaxis,
        showgrid: showGrid,
      },
      yaxis: {
        ...activeTemplate.yaxis,
        ...layout.yaxis,
        showgrid: showGrid,
      },
      showlegend: legendPos !== 'none',
      legend: legendPos === 'bottom'
        ? { orientation: 'h', y: -0.25, x: 0.5, xanchor: 'center' }
        : legendPos === 'right'
        ? { orientation: 'v', x: 1.05, y: 1 }
        : undefined,
    };

    return { customizedData: finalData, customizedLayout: finalLayout };
  }, [data, layout, palette, showGrid, legendPos, pointSize, lineWidth, opacity, trendline, isScatterNumeric, showLabels, activeTemplate]);

  // Export CSV
  const handleExportCSV = () => {
    const validTraces = data.filter(t => Array.isArray(t.x) && Array.isArray(t.y));
    if (validTraces.length === 0) return;

    const allX = Array.from(new Set(validTraces.flatMap(t => t.x as any[]))).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });

    const headers = ['Axe_X', ...validTraces.map((t, i) => t.name || `Variable_${i + 1}`)];
    const rows = allX.map(xVal => {
      const row = [String(xVal)];
      validTraces.forEach(t => {
        const xIdx = (t.x as any[]).indexOf(xVal);
        if (xIdx !== -1) {
          const yVal = (t.y as any[])[xIdx];
          row.push(yVal !== undefined && yVal !== null ? String(yVal) : '');
        } else {
          row.push('');
        }
      });
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(chartTitle || 'data').toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export JSON brut
  const handleExportJSON = () => {
    const jsonStr = JSON.stringify({ data, layout, config }, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(chartTitle || 'chart').toLowerCase().replace(/[^a-z0-9]/g, '_')}_spec.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full rounded-xl bg-white/[0.01] border border-white/5 p-4 flex flex-col gap-3 relative transition-all duration-300 hover:border-white/10">
      {/* Barre d'outils supérieure */}
      <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2.5">
        <div className="flex items-center gap-2">
          {chartTitle ? (
            <span className="text-xs font-semibold text-surface-200 tracking-wide uppercase">
              {chartTitle}
            </span>
          ) : (
            <span className="text-xs font-semibold text-surface-400 uppercase">Graphe Interactif</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium ${
              showSettings ? 'bg-white/5 text-accent-400' : ''
            }`}
            title="Personnaliser le graphique"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Style
          </button>
          
          <button
            onClick={() => setShowInterpretation(!showInterpretation)}
            className={`p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium ${
              showInterpretation ? 'bg-white/5 text-accent-400' : ''
            }`}
            title="Comprendre le graphique"
          >
            <Info className="w-3.5 h-3.5" />
            Interpréter
          </button>

          <div className="relative group/export">
            <button className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium">
              <Download className="w-3.5 h-3.5" />
              Exporter
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-surface-950 border border-white/10 shadow-2xl p-1 opacity-0 pointer-events-none group-hover/export:opacity-100 group-hover/export:pointer-events-auto transition-all z-20">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-surface-300 hover:text-surface-100 hover:bg-white/5 flex items-center gap-2"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Données (.CSV)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-surface-300 hover:text-surface-100 hover:bg-white/5 flex items-center gap-2"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                Spécification (.JSON)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de Personnalisation / Configuration */}
      {showSettings && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
          {/* Palette */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">Palette de couleurs</label>
            <select
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
              className="bg-surface-950 border border-white/10 rounded px-2 py-1 text-xs text-surface-200 outline-none focus:border-accent-500"
            >
              {Object.entries(PALETTES).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Grille */}
          <div className="flex flex-col gap-1 justify-center">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">Grille d'arrière-plan</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className="accent-accent-500"
              />
              Afficher les axes
            </label>
          </div>

          {/* Légende */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">Légende</label>
            <select
              value={legendPos}
              onChange={(e) => setLegendPos(e.target.value as any)}
              className="bg-surface-950 border border-white/10 rounded px-2 py-1 text-xs text-surface-200 outline-none focus:border-accent-500"
            >
              <option value="bottom">En bas</option>
              <option value="right">À droite</option>
              <option value="none">Masquée</option>
            </select>
          </div>

          {/* Data Labels */}
          <div className="flex flex-col gap-1 justify-center">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">Valeurs des points</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
                className="accent-accent-500"
              />
              Afficher sur le graphe
            </label>
          </div>

          {/* Sliders d'ajustements fins */}
          {detectedChartType !== 'pie' && detectedChartType !== 'heatmap' && (
            <>
              {/* Taille Marqueurs */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-surface-400 uppercase font-semibold">Taille des marqueurs ({pointSize}px)</label>
                <input
                  type="range"
                  min="3"
                  max="14"
                  value={pointSize}
                  onChange={(e) => setPointSize(Number(e.target.value))}
                  className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* Épaisseur de ligne */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-surface-400 uppercase font-semibold">Épaisseur de trait ({lineWidth}px)</label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* Opacité */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-surface-400 uppercase font-semibold">Opacité ({Math.round(opacity * 100)}%)</label>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={opacity * 100}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* Droite de tendance */}
              {isScatterNumeric && (
                <div className="flex flex-col gap-1 justify-center">
                  <label className="text-[10px] text-surface-400 uppercase font-semibold">Statistiques</label>
                  <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
                    <input
                      type="checkbox"
                      checked={trendline}
                      onChange={(e) => setTrendline(e.target.checked)}
                      className="accent-accent-500"
                    />
                    Droite de régression (y = ax + b)
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Rendu principal du graphique Plotly */}
      <Suspense fallback={<PlotlySkeleton height={height} className={className} />}>
        <HeavyPlotlyChart
          data={customizedData}
          layout={customizedLayout}
          config={config}
          height={height}
          className={className}
        />
      </Suspense>

      {/* Panneau pédagogique d'interprétation */}
      {showInterpretation && (
        <div className="bg-gradient-to-r from-accent-500/5 to-cyan-500/5 border border-accent-500/20 rounded-xl p-3.5 flex gap-3 animate-fadeIn">
          <Info className="w-5 h-5 text-accent-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-accent-300 uppercase tracking-wide">
              Comprendre la visualisation
            </span>
            <p className="text-xs text-surface-300 leading-relaxed">
              {getChartInterpretation(detectedChartType, chartTitle, data)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
