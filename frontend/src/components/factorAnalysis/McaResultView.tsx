import type { MCAResult } from '../../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScreePlot } from '../viz';
import { PlotlyChart, DEFAULT_CONFIG, SCI_COLORS } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

const COLORS = [
  ...SCI_COLORS,
  '#0284c7',
  '#f59e0b',
];

interface MCAResultViewProps {
  result: MCAResult;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
}

export function MCAResultView({
  result,
  showDetails,
  setShowDetails,
}: MCAResultViewProps) {
  const dim1 = result.component_labels[0] || 'Dim1';
  const dim2 = result.component_labels[1] || 'Dim2';

  const variables: string[] = [
    ...new Set(result.modality_info.map((m: any) => m.variable as string)),
  ];
  const varColorMap: Record<string, string> = {};
  variables.forEach((v: string, i: number) => {
    varColorMap[v] = COLORS[i % COLORS.length];
  });

  const modalityPoints = result.modality_info.map((info: any) => ({
    name: info.modality,
    fullName: info.full,
    variable: info.variable,
    x: result.modality_coords[info.full]?.[dim1] ?? 0,
    y: result.modality_coords[info.full]?.[dim2] ?? 0,
    color: varColorMap[info.variable],
  }));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-[var(--ui-text-primary)]">Résumé ACM</h4>
          <span className="text-sm ui-num text-[var(--ui-text-muted)]">
            {result.n_observations} obs. — {result.n_modalities} modalités —{' '}
            {result.n_variables} var.
          </span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map((v: any) => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis (ACM, Benzécri)"
        />
      </div>

      <div className="card">
        <h5 className="text-sm font-medium text-[var(--ui-text-secondary)] mb-2">
          Nuage des modalités ({dim1} vs {dim2})
        </h5>
        <MCAModalityMap
          modalityPoints={modalityPoints}
          variables={variables}
          varColorMap={varColorMap}
          dim1={dim1}
          dim2={dim2}
        />
      </div>

      {result.eta2 && (
        <div className="card">
          <h5 className="text-sm font-medium text-[var(--ui-text-secondary)] mb-2">
            Rapport de corrélation η²
          </h5>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[var(--ui-bg-elevated)] text-[var(--ui-text-secondary)]">
                  <th className="px-3 py-1.5 text-left">Variable</th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <th key={c} className="px-3 py-1.5 text-right ui-num">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.variables.map((v: string) => (
                  <tr key={v} className="border-t border-[var(--ui-border-subtle)]">
                    <td className="px-3 py-1" style={{ color: varColorMap[v] }}>
                      {v}
                    </td>
                    {result.component_labels.slice(0, 5).map((c: string) => (
                      <td key={c} className="px-3 py-1 text-right ui-num text-[var(--ui-text-primary)]">
                        {result.eta2[c]?.[v]?.toFixed(3)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)]"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails des contributions
        </button>
        {showDetails && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-[var(--ui-bg-elevated)] text-[var(--ui-text-secondary)]">
                  <th className="px-3 py-1.5 text-left">Variable</th>
                  <th className="px-3 py-1.5 text-left">Modalité</th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <th key={c} className="px-3 py-1.5 text-right ui-num">
                      Contrib% {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.modality_info.map((info: any) => (
                  <tr key={info.full} className="border-t border-[var(--ui-border-subtle)]">
                    <td className="px-3 py-1" style={{ color: varColorMap[info.variable] }}>
                      {info.variable}
                    </td>
                    <td className="px-3 py-1 text-[var(--ui-text-primary)]">{info.modality}</td>
                    {result.component_labels.slice(0, 5).map((c: string) => (
                      <td key={c} className="px-3 py-1 text-right ui-num text-[var(--ui-text-primary)]">
                        {result.modality_contrib[info.full]?.[c]?.toFixed(1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MCAModalityMap({
  modalityPoints,
  variables,
  varColorMap,
  dim1,
  dim2,
}: {
  modalityPoints: any[];
  variables: string[];
  varColorMap: Record<string, string>;
  dim1: string;
  dim2: string;
}) {
  const traces: Data[] = variables.map(v => {
    const pts = modalityPoints.filter(p => p.variable === v);
    return {
      x: pts.map(p => p.x),
      y: pts.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: v,
      text: pts.map(p => p.name),
      textposition: 'top center',
      textfont: { size: 9, color: varColorMap[v] },
      marker: {
        size: 10,
        color: varColorMap[v],
        line: { color: 'rgba(148,163,184,0.35)', width: 1 },
      },
      hovertemplate:
        '<b>%{text}</b><br>Variable: ' +
        v +
        '<br>' +
        dim1 +
        ': %{x:.3f}<br>' +
        dim2 +
        ': %{y:.3f}<extra></extra>',
    } as Data;
  });
  const layout: Partial<Layout> = {
    autosize: true,
    xaxis: {
      title: { text: dim1 },
      zeroline: true,
    },
    yaxis: {
      title: { text: dim2 },
      zeroline: true,
    },
    legend: { orientation: 'h', y: -0.15 },
    margin: { l: 60, r: 20, t: 10, b: 60 },
  };
  return <PlotlyChart data={traces} layout={layout} config={DEFAULT_CONFIG} height={440} />;
}
