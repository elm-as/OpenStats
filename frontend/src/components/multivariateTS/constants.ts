export const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#f97316'];
export const FORECAST_COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#fb7185', '#34d399', '#f472b6', '#818cf8', '#fb923c'];

export const MODEL_DEFS = [
  { key: 'var', label: 'VAR', desc: 'Vector Auto-Regression classique' },
  { key: 'vecm', label: 'VECM', desc: 'Vector Error Correction (cointégration)' },
  { key: 'ardl', label: 'ARDL', desc: 'Retards distribués (ordres d\'intégration mixtes)' },
  { key: 'bvar', label: 'BVAR', desc: 'VAR Bayésien (petits échantillons)' },
  { key: 'pairwise_var', label: 'Pairwise', desc: 'VAR bivariés sur chaque paire' },
  { key: 'varmax', label: 'VARMAX', desc: 'State-space (≤ 6 variables)' },
] as const;
