import { useMemo } from 'react';
import { PlotlyChart } from '../viz/PlotlyBase';
import type { ChartSpec } from './methodologyTypes';

/**
 * Rendu des specifications de graphiques emises par le backend.
 *
 * Le backend decrit *quoi* montrer (kind + donnees) ; ce module decide *comment*,
 * en s'appuyant sur le wrapper Plotly deja utilise par le reste de l'application.
 */

const ACCENT = '#22b8cf';
const SUCCESS = '#34d399';
const WARNING = '#fbbf24';
const DANGER = '#f87171';

type Trace = Record<string, unknown>;

interface Built {
  data: Trace[];
  layout: Record<string, unknown>;
  height?: number;
}

function build(spec: ChartSpec): Built | null {
  const s = spec as Record<string, any>;

  switch (spec.kind) {
    case 'histogram': {
      // Le backend fournit des bornes de classes : on reconstruit les centres.
      const bins: number[] = s.bins ?? [];
      const counts: number[] = s.counts ?? [];
      if (bins.length < 2 || counts.length === 0) return null;
      const centers = counts.map((_, i) => (bins[i] + bins[i + 1]) / 2);
      const width = bins[1] - bins[0];

      const marks: Trace[] = [];
      const guides: Record<string, unknown>[] = [];
      for (const [value, color, label] of [
        [s.mean, ACCENT, 'moyenne'],
        [s.median, SUCCESS, 'médiane'],
      ] as [number | null, string, string][]) {
        if (value === null || value === undefined) continue;
        guides.push({
          type: 'line', x0: value, x1: value, yref: 'paper', y0: 0, y1: 1,
          line: { color, width: 1.5, dash: 'dot' },
        });
        marks.push({
          x: [value], y: [null], type: 'scatter', mode: 'markers',
          marker: { color, size: 7 }, name: label, showlegend: true,
        });
      }

      return {
        data: [
          { x: centers, y: counts, type: 'bar', width, name: 'effectif',
            marker: { color: ACCENT, opacity: 0.75 }, showlegend: false },
          ...marks,
        ],
        layout: { shapes: guides, bargap: 0.02, xaxis: { title: s.column ?? '' }, yaxis: { title: 'effectif' } },
        height: 240,
      };
    }

    case 'bar':
    case 'severity_bar':
    case 'importance': {
      const labels: string[] = s.labels ?? [];
      const values: number[] = s.values ?? [];
      if (!labels.length) return null;
      const horizontal = spec.kind !== 'bar';
      const color = spec.kind === 'severity_bar' ? WARNING : ACCENT;

      return {
        data: [{
          x: horizontal ? values : labels,
          y: horizontal ? labels : values,
          type: 'bar',
          orientation: horizontal ? 'h' : 'v',
          marker: { color },
          hovertemplate: horizontal ? '%{y}<br>%{x:.4g}<extra></extra>' : '%{x}<br>%{y:.4g}<extra></extra>',
        }],
        layout: {
          margin: horizontal ? { l: 150, r: 16, t: 8, b: 32 } : undefined,
          yaxis: horizontal ? { automargin: true, autorange: 'reversed' } : {},
        },
        height: horizontal ? Math.max(200, labels.length * 22 + 60) : 240,
      };
    }

    case 'missing_matrix': {
      const labels: string[] = s.labels ?? [];
      const values: number[] = s.values ?? [];
      if (!labels.length) return null;
      return {
        data: [{
          x: values.map(v => v * 100), y: labels, type: 'bar', orientation: 'h',
          marker: { color: values.map(v => (v > 0.3 ? DANGER : v > 0.05 ? WARNING : SUCCESS)) },
          hovertemplate: '%{y}<br>%{x:.1f} %% manquants<extra></extra>',
        }],
        layout: {
          margin: { l: 150, r: 16, t: 8, b: 34 },
          xaxis: { title: '% de valeurs manquantes', range: [0, 100] },
          yaxis: { automargin: true, autorange: 'reversed' },
        },
        height: Math.max(200, labels.length * 20 + 60),
      };
    }

    case 'heatmap': {
      const labels: string[] = s.labels ?? [];
      const matrix: (number | null)[][] = s.matrix ?? [];
      if (!labels.length) return null;

      // Triangle inferieur seul : la moitie superieure est le miroir exact de
      // l'autre, et l'afficher double la surface a lire sans rien apporter.
      // Les valeurs sont ecrites dans les cases : lire une correlation ne doit
      // pas demander de survoler.
      const lower = matrix.map((row, i) =>
        row.map((value, j) => (j <= i && i !== j ? value : null)));

      const text = lower.map(row =>
        row.map(value => (value === null || value === undefined ? '' : value.toFixed(2))));

      // Le libelle passe en blanc sur les cases foncees (correlations fortes).
      const fontColors = lower.map(row =>
        row.map(value => (value !== null && Math.abs(value) > 0.55 ? '#ffffff' : '#0f172a')));

      const size = labels.length;
      const cell = size > 18 ? 22 : size > 12 ? 30 : 40;

      return {
        data: [{
          z: lower, x: labels, y: labels, type: 'heatmap',
          zmin: -1, zmax: 1, zmid: 0,
          colorscale: [
            [0, '#1d4ed8'], [0.25, '#93c5fd'], [0.5, '#f1f5f9'],
            [0.75, '#fdba74'], [1, '#c2410c'],
          ],
          text, texttemplate: '%{text}',
          textfont: { size: size > 14 ? 8 : 10, color: fontColors },
          hovertemplate: '%{y} / %{x}<br>r = %{z:.3f}<extra></extra>',
          hoverongaps: false,
          xgap: 1, ygap: 1,
          colorbar: { title: { text: 'r', side: 'top' }, thickness: 10, len: 0.8 },
        }],
        layout: {
          margin: { l: 118, r: 16, t: 8, b: 110 },
          xaxis: { tickangle: -45, automargin: true, showgrid: false, ticks: '' },
          yaxis: { automargin: true, showgrid: false, ticks: '', autorange: 'reversed' },
        },
        height: Math.max(280, size * cell + 130),
      };
    }

    case 'scatter': {
      const x: number[] = s.x ?? [];
      const y: number[] = s.y ?? [];
      if (!x.length) return null;
      return {
        data: [{
          x, y, type: 'scatter', mode: 'markers',
          marker: { color: ACCENT, size: 5, opacity: 0.55 },
          hovertemplate: `${s.x_col}=%{x:.4g}<br>${s.y_col}=%{y:.4g}<extra></extra>`,
        }],
        layout: { xaxis: { title: s.x_col ?? '' }, yaxis: { title: s.y_col ?? '' } },
        height: 260,
      };
    }

    case 'box': {
      const groups: { name: string; values: number[] }[] = s.groups ?? [];
      if (!groups.length) return null;
      return {
        data: groups.map(group => ({
          y: group.values, type: 'box', name: group.name,
          boxpoints: 'outliers', marker: { size: 4 },
        })),
        layout: { yaxis: { title: s.value_col ?? '' }, xaxis: { title: s.group_col ?? '' }, showlegend: false },
        height: 260,
      };
    }

    case 'model_comparison': {
      const labels: string[] = s.labels ?? [];
      const values: number[] = s.values ?? [];
      if (!labels.length) return null;
      const lowerIsBetter = Boolean(s.lower_is_better);
      const baseline: number | null = s.baseline ?? null;

      // Le meilleur modele est mis en avant ; la reference naive apparait comme
      // une ligne, car un score ne se lit pas sans elle.
      const bestValue = lowerIsBetter ? Math.min(...values) : Math.max(...values);
      const colors = values.map(v => (v === bestValue ? SUCCESS : ACCENT));

      const shapes = baseline !== null ? [{
        type: 'line', yref: 'y', y0: baseline, y1: baseline,
        xref: 'paper', x0: 0, x1: 1,
        line: { color: DANGER, width: 1.5, dash: 'dash' },
      }] : [];

      const annotations = baseline !== null ? [{
        xref: 'paper', x: 1, y: baseline, yanchor: 'bottom', xanchor: 'right',
        text: `référence ${s.baseline_label ?? ''} : ${Number(baseline).toFixed(3)}`,
        showarrow: false, font: { size: 9, color: DANGER },
      }] : [];

      return {
        data: [{
          x: labels, y: values, type: 'bar',
          marker: { color: colors },
          text: values.map(v => v.toFixed(3)),
          texttemplate: '%{text}', textposition: 'outside',
          hovertemplate: `%{x}<br>${s.metric ?? 'score'} = %{y:.4f}<extra></extra>`,
        }],
        layout: {
          shapes, annotations,
          xaxis: { tickangle: -30, automargin: true },
          yaxis: { title: String(s.metric ?? 'score'), rangemode: lowerIsBetter ? 'tozero' : 'normal' },
          margin: { l: 56, r: 16, t: 20, b: 90 },
        },
        height: 300,
      };
    }

    case 'severity_progress': {
      const labels: string[] = s.labels ?? [];
      const values: number[] = s.values ?? [];
      if (!labels.length) return null;
      return {
        data: [{
          x: labels, y: values, type: 'scatter', mode: 'lines+markers',
          line: { color: SUCCESS, width: 2 },
          marker: { color: SUCCESS, size: 8 },
          hovertemplate: '%{x}<br>gravité cumulée %{y:.2f}<extra></extra>',
        }],
        layout: { yaxis: { title: 'gravité cumulée', rangemode: 'tozero' } },
        height: 220,
      };
    }

    case 'residuals': {
      const predicted: number[] = s.predicted ?? [];
      const residuals: number[] = s.residuals ?? [];
      if (!predicted.length) return null;
      return {
        data: [
          { x: predicted, y: residuals, type: 'scatter', mode: 'markers',
            marker: { color: ACCENT, size: 5, opacity: 0.5 }, name: 'résidus',
            hovertemplate: 'prédit %{x:.4g}<br>résidu %{y:.4g}<extra></extra>' },
        ],
        layout: {
          shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0,
                     line: { color: DANGER, width: 1, dash: 'dash' } }],
          xaxis: { title: 'valeur prédite' }, yaxis: { title: 'résidu' },
          showlegend: false,
        },
        height: 260,
      };
    }

    default:
      return null;
  }
}

export function StageChart({ spec }: { spec: ChartSpec }) {
  const built = useMemo(() => build(spec), [spec]);
  if (!built) return null;

  return (
    <figure className="ui-panel overflow-hidden" style={{ margin: 0 }}>
      <figcaption className="ui-panel-header">{spec.title}</figcaption>
      <div style={{ padding: '4px 6px 2px' }}>
        <PlotlyChart
          data={built.data}
          layout={{ margin: { l: 52, r: 16, t: 8, b: 40 }, ...built.layout }}
          height={built.height ?? 240}
        />
      </div>
    </figure>
  );
}

export default function StageCharts({ charts }: { charts: ChartSpec[] }) {
  const renderable = charts.filter(c => build(c) !== null);
  if (!renderable.length) return null;

  // Les graphes larges (matrices, classements) occupent toute la largeur.
  const isWide = (c: ChartSpec) =>
    c.kind === 'heatmap' || c.kind === 'missing_matrix' || c.kind === 'importance'
    || c.kind === 'severity_bar' || c.kind === 'model_comparison';

  return (
    <div
      className="grid"
      style={{ gap: 'var(--ui-gap-2)', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}
    >
      {renderable.map((spec, index) => (
        <div key={`${spec.kind}-${index}`} style={{ gridColumn: isWide(spec) ? '1 / -1' : undefined }}>
          <StageChart spec={spec} />
        </div>
      ))}
    </div>
  );
}
