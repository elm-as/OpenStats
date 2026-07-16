import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Pour chaque variable : décomposition de la variance par horizon */
  fevd: Array<{
    variable: string;
    /** chocs : { shockName: contributions[] (par horizon) } */
    contributions: Record<string, number[]>;
  }>;
  height?: number;
  title?: string;
}

export default function FEVDStacked({ fevd, height, title = 'Décomposition de la variance (FEVD)' }: Props) {
  const { traces, layout, h, n } = useMemo(() => {
    const nrow = fevd.length;
    const tr: Data[] = [];

    fevd.forEach((row, rowIdx) => {
      const shocks = Object.keys(row.contributions);
      const sub = rowIdx + 1;
      const xaxis = sub === 1 ? 'x' : `x${sub}`;
      const yaxis = sub === 1 ? 'y' : `y${sub}`;
      const horizons = row.contributions[shocks[0]]?.map((_, i) => i + 1) ?? [];

      shocks.forEach((shock, sIdx) => {
        const vals = row.contributions[shock].map(v => v * 100); // en %
        tr.push({
          x: horizons,
          y: vals,
          type: 'bar',
          name: shock,
          marker: { color: SCI_COLORS[sIdx % SCI_COLORS.length] },
          xaxis, yaxis,
          legendgroup: shock,
          showlegend: rowIdx === 0,
          hovertemplate: `<b>${row.variable}</b> ← ${shock}<br>h=%{x}<br>%{y:.1f}%<extra></extra>`,
        } as Data);
      });
    });

    const computedH = height ?? Math.max(220, nrow * 200 + 60);
    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14 } },
      grid: { rows: nrow, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
      barmode: 'stack',
      showlegend: true,
      legend: { orientation: 'h', y: -0.1 },
      margin: { l: 60, r: 20, t: 50, b: 60 },
    };

    // Annotations latérales (nom de la variable)
    const annotations: any[] = fevd.map((row, idx) => ({
      x: -0.04, y: 1 - (idx + 0.5) / nrow, xref: 'paper', yref: 'paper',
      text: row.variable, showarrow: false, textangle: -90,
      font: { size: 11, color: '#cbd5e1' },
    }));
    (lay as any).annotations = annotations;

    // Configure y axes en %
    for (let i = 1; i <= nrow; i++) {
      const key = i === 1 ? 'yaxis' : `yaxis${i}`;
      (lay as any)[key] = { range: [0, 100], ticksuffix: '%' };
      const xkey = i === 1 ? 'xaxis' : `xaxis${i}`;
      (lay as any)[xkey] = i === nrow ? { title: { text: 'Horizon' } } : { showticklabels: false };
    }

    return { traces: tr, layout: lay, h: computedH, n: nrow };
  }, [fevd, height, title]);

  if (n === 0) return <div className="empty-state">Aucune donnée FEVD</div>;
  return <PlotlyChart data={traces} layout={layout} height={h} />;
}
