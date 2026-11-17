import { useState, useEffect } from 'react';
import type { Layout, Config } from 'plotly.js';

export type { BuildThemedAxesOptions, ChartCustomizeOptions } from './plotlyLayoutBuilder';
export { buildThemedAxes, customizePlotTraces, customizePlotLayout } from './plotlyLayoutBuilder';

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
    automargin: true,
    gridcolor: 'rgba(255,255,255,0.05)',
    zerolinecolor: 'rgba(255,255,255,0.15)',
    linecolor: 'rgba(255,255,255,0.15)',
    tickfont: { color: '#a3adc8', size: 11 },
    title: { font: { color: '#eaf0f8', size: 12 } },
  },
  yaxis: {
    automargin: true,
    gridcolor: 'rgba(255,255,255,0.05)',
    zerolinecolor: 'rgba(255,255,255,0.15)',
    linecolor: 'rgba(255,255,255,0.15)',
    tickfont: { color: '#a3adc8', size: 11 },
    title: { font: { color: '#eaf0f8', size: 12 } },
  },
  legend: {
    bgcolor: 'rgba(21,26,36,0.82)',
    bordercolor: 'rgba(148,163,184,0.2)',
    borderwidth: 1,
    font: { color: '#eaf0f8' },
  },
  margin: { l: 60, r: 20, t: 40, b: 50 },
  hoverlabel: {
    bgcolor: '#1d2433',
    bordercolor: '#22b8cf',
    font: { family: 'Inter, system-ui, sans-serif', color: '#eaf0f8' },
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
    automargin: true,
    gridcolor: 'rgba(0,0,0,0.06)',
    zerolinecolor: 'rgba(0,0,0,0.12)',
    linecolor: 'rgba(0,0,0,0.12)',
    tickfont: { color: '#475569', size: 11 },
    title: { font: { color: '#0f172a', size: 12 } },
  },
  yaxis: {
    automargin: true,
    gridcolor: 'rgba(0,0,0,0.06)',
    zerolinecolor: 'rgba(0,0,0,0.12)',
    linecolor: 'rgba(0,0,0,0.12)',
    tickfont: { color: '#475569', size: 11 },
    title: { font: { color: '#0f172a', size: 12 } },
  },
  legend: {
    bgcolor: 'rgba(255,255,255,0.88)',
    bordercolor: 'rgba(15,23,42,0.14)',
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

// Hook pour observer le changement de thème sur l'élément html
export function useCurrentTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (document.documentElement.dataset.theme as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(mutations => {
      if (!mutations.some(m => m.attributeName === 'data-theme')) return;
      const currentTheme = document.documentElement.dataset.theme as 'dark' | 'light';
      setTheme(currentTheme || 'dark');
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
