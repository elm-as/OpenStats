import { useMemo } from 'react';
import { PlotlyChart } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface IRFCell {
  shock: string;
  response: string;
  values: number[];
  lower?: number[];
  upper?: number[];
}

interface Props {
  cells: IRFCell[];
  height?: number;
  title?: string;
}

/** Grille IRF NxN : choc en colonne, réponse en ligne. */
export default function IRFGrid({ cells, height, title = 'Fonctions de réponse impulsionnelle' }: Props) {
  const { traces, layout, h, n } = useMemo(() => {
    const shocks = Array.from(new Set(cells.map(c => c.shock)));
    const responses = Array.from(new Set(cells.map(c => c.response)));
    const nrow = responses.length;
    const ncol = shocks.length;

    const tr: Data[] = [];
    cells.forEach(c => {
      const rowIdx = responses.indexOf(c.response);
      const colIdx = shocks.indexOf(c.shock);
      const sub = rowIdx * ncol + colIdx + 1;
      const xaxis = sub === 1 ? 'x' : `x${sub}`;
      const yaxis = sub === 1 ? 'y' : `y${sub}`;

      // Bande IC
      if (c.lower && c.upper) {
        const xs = c.values.map((_, i) => i);
        tr.push({
          x: [...xs, ...[...xs].reverse()],
          y: [...c.upper, ...[...c.lower].reverse()],
          fill: 'toself',
          fillcolor: 'rgba(6, 182, 212, 0.15)',
          line: { color: 'transparent' },
          xaxis, yaxis,
          showlegend: false, hoverinfo: 'skip',
          type: 'scatter',
        } as Data);
      }

      tr.push({
        x: c.values.map((_, i) => i),
        y: c.values,
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#06b6d4', width: 1.5 },
        marker: { size: 3, color: '#22d3ee' },
        xaxis, yaxis,
        showlegend: false,
        hovertemplate: `${c.response} ← ${c.shock}<br>h=%{x}<br>IRF: %{y:.4f}<extra></extra>`,
      } as Data);
    });

    const computedH = height ?? Math.max(300, nrow * 180 + 60);
    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      grid: { rows: nrow, columns: ncol, pattern: 'independent' },
      showlegend: false,
      margin: { l: 50, r: 20, t: 60, b: 40 },
    };

    // Titres de colonnes + axes
    const annotations: any[] = [];
    shocks.forEach((shock, c) => {
      annotations.push({
        x: (c + 0.5) / ncol, y: 1.04, xref: 'paper', yref: 'paper',
        text: `Choc: ${shock}`, showarrow: false,
        font: { size: 11, color: '#22d3ee', family: 'Inter' },
      });
    });
    responses.forEach((resp, r) => {
      annotations.push({
        x: -0.04, y: 1 - (r + 0.5) / nrow, xref: 'paper', yref: 'paper',
        text: resp, showarrow: false, textangle: -90,
        font: { size: 10, color: '#cbd5e1' },
      });
    });
    (lay as any).annotations = annotations;

    return { traces: tr, layout: lay, h: computedH, n: nrow * ncol };
  }, [cells, height, title]);

  if (n === 0) return <div className="empty-state">Aucune donnée IRF</div>;
  return <PlotlyChart data={traces} layout={layout} height={h} />;
}
