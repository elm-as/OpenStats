import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Coordonnées des variables sur PC1/PC2 (loadings × √λ). 
   *  Format : { var_name: [pc1, pc2, ...] } ou { var_name: { PC1, PC2 } } */
  coords: Record<string, number[] | Record<string, number>>;
  /** Variance expliquée par composante (ratio 0-1) */
  explainedVariance?: number[];
  /** Axes à afficher (indices 0-based) */
  axes?: [number, number];
  height?: number;
  title?: string;
}

/** Cercle des corrélations ACP : variables projetées dans le plan factoriel. */
export default function PCACorrelationCircle({
  coords,
  explainedVariance = [],
  axes = [0, 1],
  height = 500,
  title = 'Cercle des corrélations',
}: Props) {
  const [pcX, pcY] = axes;

  const extractCoord = (v: number[] | Record<string, number>, idx: number): number => {
    if (Array.isArray(v)) return v[idx] ?? 0;
    return v[`PC${idx + 1}`] ?? v[`Dim${idx + 1}`] ?? v[String(idx)] ?? 0;
  };

  const { traces, layout } = useMemo(() => {
    const vars = Object.keys(coords);
    const xs = vars.map(v => extractCoord(coords[v], pcX));
    const ys = vars.map(v => extractCoord(coords[v], pcY));

    // Cercle unité
    const theta = Array.from({ length: 100 }, (_, i) => (i / 99) * 2 * Math.PI);
    const cx = theta.map(t => Math.cos(t));
    const cy = theta.map(t => Math.sin(t));

    const circleTrace: Data = {
      x: cx,
      y: cy,
      mode: 'lines',
      type: 'scatter',
      line: { color: 'rgba(255,255,255,0.15)', width: 1, dash: 'dot' },
      hoverinfo: 'skip',
      showlegend: false,
    };

    // Flèches (segments centre→var)
    const arrowTraces: Data[] = vars.map((v, i) => ({
      x: [0, xs[i]],
      y: [0, ys[i]],
      mode: 'lines',
      type: 'scatter',
      line: { color: SCI_COLORS[i % SCI_COLORS.length], width: 2 },
      hoverinfo: 'skip',
      showlegend: false,
    }));

    // Points + labels
    const labelsTrace: Data = {
      x: xs.map(x => x * 1.08),
      y: ys.map(y => y * 1.08),
      mode: 'text',
      type: 'scatter',
      text: vars,
      textfont: { size: 12, color: '#dfe3ee' },
      hovertext: vars.map((v, i) =>
        `<b>${v}</b><br>PC${pcX + 1}: ${xs[i].toFixed(3)}<br>PC${pcY + 1}: ${ys[i].toFixed(3)}<br>cos²: ${(xs[i] ** 2 + ys[i] ** 2).toFixed(3)}`
      ),
      hovertemplate: '%{hovertext}<extra></extra>',
      showlegend: false,
    };

    // Têtes de flèches (markers)
    const headsTrace: Data = {
      x: xs,
      y: ys,
      mode: 'markers',
      type: 'scatter',
      marker: {
        size: 8,
        color: vars.map((_, i) => SCI_COLORS[i % SCI_COLORS.length]),
        symbol: 'arrow-bar-up',
      },
      hoverinfo: 'skip',
      showlegend: false,
    };

    const xLabel = explainedVariance[pcX] !== undefined
      ? `PC${pcX + 1} (${(explainedVariance[pcX] * 100).toFixed(1)}%)`
      : `PC${pcX + 1}`;
    const yLabel = explainedVariance[pcY] !== undefined
      ? `PC${pcY + 1} (${(explainedVariance[pcY] * 100).toFixed(1)}%)`
      : `PC${pcY + 1}`;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14, color: '#dfe3ee' } },
      xaxis: {
        title: { text: xLabel },
        range: [-1.25, 1.25],
        zeroline: true,
        showgrid: false,
        scaleanchor: 'y',
        scaleratio: 1,
      },
      yaxis: {
        title: { text: yLabel },
        range: [-1.25, 1.25],
        zeroline: true,
        showgrid: false,
      },
      shapes: [
        // Cercle de corrélation
        {
          type: 'circle',
          xref: 'x',
          yref: 'y',
          x0: -1,
          y0: -1,
          x1: 1,
          y1: 1,
          line: { color: 'rgba(6,182,212,0.4)', width: 1.5 },
        },
      ],
    };

    return {
      traces: [circleTrace, ...arrowTraces, headsTrace, labelsTrace],
      layout: lay,
    };
  }, [coords, explainedVariance, pcX, pcY, title]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}
