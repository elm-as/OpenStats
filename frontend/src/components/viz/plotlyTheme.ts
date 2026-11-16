import { useState, useEffect } from 'react';
import type { Layout, Config } from 'plotly.js';

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
    bordercolor: '#0e7490',
    font: { family: 'Inter, system-ui, sans-serif', color: '#0f172a' },
  },
};

function normalizeAxisTitle(rawTitle: any, templateTitle: any) {
  if (rawTitle === undefined || rawTitle === null) return templateTitle;
  const obj = typeof rawTitle === 'string' ? { text: rawTitle } : rawTitle;
  return {
    ...templateTitle,
    ...obj,
    font: { ...(templateTitle?.font || {}), ...(obj?.font || {}) },
  };
}

/** Applique les couleurs du thème actif sur tous les axes cartésiens (principaux et sous-graphes). */
export function buildThemedAxes(
  layout: Partial<Layout>,
  template: Partial<Layout>,
  showGrid: boolean,
  hasCartesian: boolean
): Record<string, any> {
  const axes: Record<string, any> = {};
  const layoutAny = layout as Record<string, any>;

  if (hasCartesian) {
    const xBase = layoutAny.xaxis || {};
    const yBase = layoutAny.yaxis || {};
    axes.xaxis = {
      ...template.xaxis,
      ...xBase,
      title: normalizeAxisTitle(xBase.title, (template.xaxis as any)?.title),
      showgrid: xBase.showgrid ?? showGrid,
    };
    axes.yaxis = {
      ...template.yaxis,
      ...yBase,
      title: normalizeAxisTitle(yBase.title, (template.yaxis as any)?.title),
      showgrid: yBase.showgrid ?? showGrid,
    };
  }

  for (const key of Object.keys(layoutAny)) {
    const match = /^([xy])axis(\d+)$/.exec(key);
    if (!match) continue;
    const tplAxis = match[1] === 'x' ? (template.xaxis as any) : (template.yaxis as any);
    const axisVal = layoutAny[key] || {};
    axes[key] = {
      ...tplAxis,
      ...axisVal,
      title: normalizeAxisTitle(axisVal.title, tplAxis?.title),
      showgrid: axisVal.showgrid ?? showGrid,
    };
  }
  return axes;
}

// Hook pour observer le changement de thème sur l'élément html
export function useCurrentTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (document.documentElement.dataset.theme as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
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
    height: 700,
    width: 1200,
    scale: 3,
  },
};

// Palette scientifique accessible (inspirée d'Okabe-Ito, lisible daltoniens et impression N&B)
export const SCI_COLORS = [
  '#0284c7', // bleu acier
  '#d97706', // ambre chaud
  '#059669', // vert émeraude
  '#dc2626', // rouge brique
  '#0ea5e9', // cyan vif
  '#b45309', // ocre foncé
  '#0d9488', // sarcelle
  '#475569', // ardoise
];

export const PALETTES: Record<string, { label: string; colors: string[] }> = {
  default: { label: 'Scientifique (Okabe-Ito)', colors: SCI_COLORS },
  emerald: {
    label: 'Émeraude & Forêt',
    colors: ['#059669', '#0d9488', '#10b981', '#047857', '#14b8a6', '#34d399'],
  },
  cool: {
    label: 'Océan & Acier',
    colors: ['#0284c7', '#1d4ed8', '#0ea5e9', '#0369a1', '#3b82f6', '#0e7490'],
  },
  warm: {
    label: 'Terre & Ambre',
    colors: ['#d97706', '#b45309', '#dc2626', '#ea580c', '#f59e0b', '#9a3412'],
  },
  publication: {
    label: 'Publication R (Contrastée)',
    colors: ['#0f172a', '#0284c7', '#dc2626', '#059669', '#d97706', '#64748b'],
  },
  monochrome: {
    label: 'Monochrome épuré',
    colors: ['#334155', '#475569', '#64748b', '#94a3b8', '#1e293b', '#cbd5e1'],
  },
};

export const COLORSCALE_VIRIDIS = 'Viridis';
export const COLORSCALE_RDBU = 'RdBu';

export interface ChartCustomizeOptions {
  data: any[];
  layout: Partial<Layout>;
  theme: 'dark' | 'light';
  palette: string;
  showGrid: boolean;
  legendPos: 'right' | 'bottom' | 'none';
  pointSize: number;
  lineWidth: number;
  opacity: number;
  showLabels: boolean;
  userTouchedStyle: boolean;
}

/** Applique palette, géométrie par type de trace et étiquettes sans écraser les configurations spécifiques. */
export function customizePlotTraces(opts: ChartCustomizeOptions) {
  const { data, palette, pointSize, lineWidth, opacity, showLabels, userTouchedStyle } = opts;
  const colors = PALETTES[palette]?.colors || SCI_COLORS;

  return data.map((t, idx) => {
    const traceColor = colors[idx % colors.length];
    const copy = { ...t };
    const tType = copy.type || 'scatter';
    const hasCustomSizeArray = Array.isArray(copy.marker?.size);

    if (tType === 'pie') {
      copy.marker = { ...copy.marker, colors: copy.marker?.colors || colors };
    } else if (tType !== 'heatmap') {
      if (tType === 'bar' || tType === 'histogram' || tType === 'box' || tType === 'violin') {
        copy.marker = { ...copy.marker, color: copy.marker?.color ?? traceColor };
        if (copy.opacity === undefined || userTouchedStyle) copy.opacity = opacity;
      } else {
        copy.marker = {
          ...copy.marker,
          color: copy.marker?.color ?? traceColor,
          size: hasCustomSizeArray
            ? copy.marker.size
            : (userTouchedStyle ? pointSize : (copy.marker?.size ?? pointSize)),
          opacity: userTouchedStyle ? opacity : (copy.marker?.opacity ?? copy.opacity ?? opacity),
        };
        copy.line = {
          ...copy.line,
          color: copy.line?.color ?? traceColor,
          width: userTouchedStyle ? lineWidth : (copy.line?.width ?? lineWidth),
        };
      }
    }

    if (showLabels) {
      if (tType === 'bar') {
        copy.texttemplate = '%{y:.2f}';
        copy.textposition = 'auto';
      } else if (tType === 'scatter') {
        copy.mode = 'markers+text' + (copy.mode?.includes('lines') ? '+lines' : '');
        copy.text = (copy.y as any[])?.map(v => (typeof v === 'number' ? v.toFixed(1) : ''));
        copy.textposition = 'top center';
      }
    }
    return copy;
  });
}

/** Construit un layout Plotly cohérent avec le thème Dark/Light et tous ses sous-graphes. */
export function customizePlotLayout(opts: ChartCustomizeOptions): Partial<Layout> {
  const { data, layout, theme, showGrid, legendPos, userTouchedStyle } = opts;
  const activeTemplate = theme === 'light' ? LIGHT_TEMPLATE : DARK_TEMPLATE;
  const hasCartesian = !data?.every(t => t.type === 'pie' || t.type === 'scatterpolar');
  const themedAxes = buildThemedAxes(layout, activeTemplate, showGrid, hasCartesian);

  const showLegend =
    legendPos === 'none'
      ? false
      : (!userTouchedStyle && layout.showlegend !== undefined ? layout.showlegend : true);

  let legend: any;
  if (!userTouchedStyle && layout.legend) {
    legend = { ...(activeTemplate.legend as any), ...layout.legend };
  } else if (legendPos === 'bottom') {
    legend = { ...(activeTemplate.legend as any), orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center' };
  } else if (legendPos === 'right') {
    legend = { ...(activeTemplate.legend as any), orientation: 'v', x: 1.03, y: 1 };
  }

  const margin = { ...(activeTemplate.margin || {}), ...(layout.margin || {}) };
  if (showLegend && legend?.orientation === 'h' && (legend.y ?? 0) < 0) {
    margin.b = Math.max(margin.b ?? 56, 82);
  }

  const rawTitle = layout.title;
  const title = rawTitle
    ? {
        ...(typeof rawTitle === 'string' ? { text: rawTitle } : rawTitle),
        font: {
          color: theme === 'light' ? '#0f172a' : '#dfe3ee',
          size: 14,
          ...(typeof rawTitle === 'object' ? rawTitle.font : {}),
        },
      }
    : undefined;

  const finalLayout: Partial<Layout> = {
    ...activeTemplate,
    ...layout,
    ...themedAxes,
    title,
    margin,
    showlegend: showLegend,
    legend,
  };
  if (!hasCartesian) {
    delete (finalLayout as any).xaxis;
    delete (finalLayout as any).yaxis;
  }
  return finalLayout;
}
