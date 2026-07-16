import { useMemo } from 'react';
import { PlotlyChart, SCI_COLORS } from './PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface Props {
  /** Coordonnées des individus sur PC1/PC2 */
  individuals: Array<{ name?: string; coords: number[] | Record<string, number>; group?: string | number }>;
  /** Coordonnées des variables (loadings × facteur d'échelle) */
  variables?: Record<string, number[] | Record<string, number>>;
  /** Variance expliquée par composante */
  explainedVariance?: number[];
  axes?: [number, number];
  height?: number;
  title?: string;
  /** Scale des flèches de variables */
  arrowScale?: number;
}

export default function PCABiplot({
  individuals,
  variables,
  explainedVariance = [],
  axes = [0, 1],
  height = 550,
  title = 'Biplot ACP',
  arrowScale,
}: Props) {
  const [pcX, pcY] = axes;

  const extract = (v: number[] | Record<string, number> | undefined, idx: number): number => {
    if (!v) return 0;
    if (Array.isArray(v)) return v[idx] ?? 0;
    return v[`PC${idx + 1}`] ?? v[`Dim${idx + 1}`] ?? v[String(idx)] ?? 0;
  };

  const { traces, layout } = useMemo(() => {
    // Individus
    const xs = individuals.map(ind => extract(ind.coords, pcX));
    const ys = individuals.map(ind => extract(ind.coords, pcY));
    const names = individuals.map((ind, i) => ind.name ?? `obs ${i + 1}`);
    const groups = individuals.map(ind => ind.group ?? null);

    // Calcul du scale automatique pour flèches
    const indMax = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), 0.1);
    const varCoords = variables ? Object.values(variables) : [];
    const varMax = Math.max(
      ...varCoords.map(v => Math.abs(extract(v, pcX))),
      ...varCoords.map(v => Math.abs(extract(v, pcY))),
      0.1,
    );
    const autoScale = (indMax / varMax) * 0.7;
    const scale = arrowScale ?? autoScale;

    // Grouper par groupe (si présent)
    const uniqueGroups = Array.from(new Set(groups.filter(g => g !== null))) as Array<string | number>;
    const indTraces: Data[] = [];

    if (uniqueGroups.length > 0) {
      uniqueGroups.forEach((g, gi) => {
        const idx = groups.map((gr, i) => (gr === g ? i : -1)).filter(i => i >= 0);
        indTraces.push({
          x: idx.map(i => xs[i]),
          y: idx.map(i => ys[i]),
          text: idx.map(i => names[i]),
          mode: 'markers',
          type: 'scatter',
          name: String(g),
          marker: {
            size: 7,
            color: SCI_COLORS[gi % SCI_COLORS.length],
            opacity: 0.7,
            line: { color: 'rgba(255,255,255,0.2)', width: 0.5 },
          },
          hovertemplate: '<b>%{text}</b><br>PC' + (pcX + 1) + ': %{x:.3f}<br>PC' + (pcY + 1) + ': %{y:.3f}<extra></extra>',
        });
      });
    } else {
      indTraces.push({
        x: xs,
        y: ys,
        text: names,
        mode: 'markers',
        type: 'scatter',
        name: 'Individus',
        marker: {
          size: 6,
          color: '#06b6d4',
          opacity: 0.5,
          line: { color: 'rgba(255,255,255,0.15)', width: 0.5 },
        },
        hovertemplate: '<b>%{text}</b><br>PC' + (pcX + 1) + ': %{x:.3f}<br>PC' + (pcY + 1) + ': %{y:.3f}<extra></extra>',
      });
    }

    // Flèches des variables
    const arrowTraces: Data[] = [];
    if (variables) {
      const vars = Object.keys(variables);
      vars.forEach((v, i) => {
        const vx = extract(variables[v], pcX) * scale;
        const vy = extract(variables[v], pcY) * scale;
        arrowTraces.push({
          x: [0, vx],
          y: [0, vy],
          mode: 'lines',
          type: 'scatter',
          line: { color: '#f59e0b', width: 2 },
          hoverinfo: 'skip',
          showlegend: false,
        } as Data);
        arrowTraces.push({
          x: [vx],
          y: [vy],
          mode: 'text+markers',
          type: 'scatter',
          marker: { color: '#f59e0b', size: 6, symbol: 'arrow', angleref: 'previous' as any },
          text: [v],
          textfont: { size: 11, color: '#fcd34d' },
          textposition: 'top right',
          hovertemplate: `<b>${v}</b><br>loading PC${pcX + 1}: ${extract(variables[v], pcX).toFixed(3)}<br>loading PC${pcY + 1}: ${extract(variables[v], pcY).toFixed(3)}<extra></extra>`,
          showlegend: false,
        } as Data);
      });
    }

    const xLabel = explainedVariance[pcX] !== undefined
      ? `PC${pcX + 1} (${(explainedVariance[pcX] * 100).toFixed(1)}%)`
      : `PC${pcX + 1}`;
    const yLabel = explainedVariance[pcY] !== undefined
      ? `PC${pcY + 1} (${(explainedVariance[pcY] * 100).toFixed(1)}%)`
      : `PC${pcY + 1}`;

    const lay: Partial<Layout> = {
      title: { text: title, font: { size: 14, color: '#dfe3ee' } },
      xaxis: { title: { text: xLabel }, zeroline: true },
      yaxis: { title: { text: yLabel }, zeroline: true },
      showlegend: uniqueGroups.length > 0,
    };

    return { traces: [...indTraces, ...arrowTraces], layout: lay };
  }, [individuals, variables, explainedVariance, pcX, pcY, title, arrowScale]);

  return <PlotlyChart data={traces} layout={layout} height={height} />;
}
