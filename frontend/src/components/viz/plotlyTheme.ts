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
    bordercolor: '#06b6d4',
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
  emerald: {
    label: 'Émeraude & Menthe',
    colors: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#047857', '#a7f3d0'],
  },
  sunset: {
    label: 'Coucher de soleil',
    colors: ['#f43f5e', '#ec4899', '#f472b6', '#f59e0b', '#fbbf24', '#fb7185'],
  },
  cyberpunk: {
    label: 'Néon Cyberpunk',
    colors: ['#ff007f', '#00f0ff', '#ab00ff', '#ffd700', '#00ff66', '#ff0033'],
  },
  cool: {
    label: 'Océan Cool',
    colors: ['#3b82f6', '#60a5fa', '#1d4ed8', '#2563eb', '#93c5fd', '#1e40af'],
  },
  warm: {
    label: 'Terre & Ambre',
    colors: ['#f59e0b', '#d97706', '#b45309', '#fcd34d', '#78350f', '#fef3c7'],
  },
  monochrome: {
    label: 'Monochrome épuré',
    colors: ['#94a3b8', '#64748b', '#475569', '#cbd5e1', '#334155', '#e2e8f0'],
  },
};

export const COLORSCALE_VIRIDIS = 'Viridis';
export const COLORSCALE_RDBU = 'RdBu';
