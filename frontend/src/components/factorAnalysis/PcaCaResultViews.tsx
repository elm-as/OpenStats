import type { PCAResult, CAResult } from '../../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScreePlot, PCACorrelationCircle, PCABiplot } from '../viz';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

interface ResultViewProps {
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
}

export function PCAResultView({
  result,
  showDetails,
  setShowDetails,
}: ResultViewProps & { result: PCAResult }) {
  const variableCoords: Record<string, number[]> = {};
  result.variables.forEach((v: string) => {
    const loadings = result.correlation_circle[v];
    if (loadings) {
      variableCoords[v] = [loadings.x ?? 0, loadings.y ?? 0];
    }
  });

  const individualCoords = (result.scores || [])
    .slice(0, 500)
    .map((s: any, i: number) => ({
      name: `obs ${i + 1}`,
      coords:
        typeof s === 'object' && !Array.isArray(s)
          ? (Object.values(s) as number[])
          : (s as number[]),
    }));

  const biplotVariables: Record<string, number[]> = { ...variableCoords };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Résumé ACP</h4>
          <span className="text-sm text-gray-500">
            {result.n_observations} obs. × {result.n_variables} var.
          </span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map((v: any) => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis des valeurs propres"
        />
      </div>

      {Object.keys(variableCoords).length > 0 && (
        <div className="card">
          <PCACorrelationCircle
            coords={variableCoords}
            explainedVariance={result.explained_variance_ratio.map((v: any) => v ?? NaN)}
            title="Cercle des corrélations"
          />
        </div>
      )}

      {individualCoords.length > 0 && Object.keys(biplotVariables).length > 0 && (
        <div className="card">
          <PCABiplot
            individuals={individualCoords}
            variables={biplotVariables}
            explainedVariance={result.explained_variance_ratio.map((v: any) => v ?? NaN)}
            title="Biplot — Individus & Variables"
          />
        </div>
      )}

      <div className="card">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails (contributions, cos²)
        </button>
        {showDetails && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium">Variable</th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <th key={c} className="px-3 py-2 text-right font-medium" colSpan={2}>
                      {c}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <th></th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <span key={c}>
                      <th key={`${c}-contrib`} className="px-2 py-1 text-right text-gray-500">
                        Contrib%
                      </th>
                      <th key={`${c}-cos2`} className="px-2 py-1 text-right text-gray-500">
                        Cos²
                      </th>
                    </span>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.variables.map((v: string) => (
                  <tr key={v} className="border-t">
                    <td className="px-3 py-2 font-medium">{v}</td>
                    {result.component_labels.slice(0, 5).map((c: string) => (
                      <span key={c}>
                        <td key={`${v}-${c}-contrib`} className="px-2 py-1 text-right">
                          {result.contrib_var[v]?.[c]?.toFixed(1)}
                        </td>
                        <td key={`${v}-${c}-cos2`} className="px-2 py-1 text-right">
                          {result.cos2_var[v]?.[c]?.toFixed(3)}
                        </td>
                      </span>
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

export function CAResultView({
  result,
  showDetails,
  setShowDetails,
}: ResultViewProps & { result: CAResult }) {
  const dim1 = result.component_labels[0] || 'Dim1';
  const dim2 = result.component_labels[1] || 'Dim2';

  const rowPoints = Object.entries(result.row_coords).map(([name, coords]: [string, any]) => ({
    name,
    x: coords[dim1] ?? 0,
    y: coords[dim2] ?? 0,
    type: 'Ligne',
  }));
  const colPoints = Object.entries(result.col_coords).map(([name, coords]: [string, any]) => ({
    name,
    x: coords[dim1] ?? 0,
    y: coords[dim2] ?? 0,
    type: 'Colonne',
  }));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Résumé AFC</h4>
          <span className="text-sm text-gray-500">
            Inertie totale : {result.total_inertia?.toFixed(4)}
          </span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map((v: any) => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis (AFC)"
        />
      </div>

      <div className="card">
        <h5 className="text-sm font-medium text-gray-700 mb-2">
          Biplot ({dim1} vs {dim2})
        </h5>
        <CABiplotPlotly rowPoints={rowPoints} colPoints={colPoints} dim1={dim1} dim2={dim2} />
      </div>

      <div className="card">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700"
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails (contributions, cos²)
        </button>
        {showDetails && (
          <div className="mt-3 space-y-4">
            <div>
              <h6 className="text-xs font-semibold text-gray-600 mb-1">
                Contributions des lignes (%)
              </h6>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-1 text-left">Modalité</th>
                      {result.component_labels.slice(0, 5).map((c: string) => (
                        <th key={c} className="px-3 py-1 text-right">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.row_contrib).map(([label, contribs]: [string, any]) => (
                      <tr key={label} className="border-t">
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c: string) => (
                          <td key={c} className="px-3 py-1 text-right">
                            {contribs[c]?.toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h6 className="text-xs font-semibold text-gray-600 mb-1">
                Contributions des colonnes (%)
              </h6>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-1 text-left">Modalité</th>
                      {result.component_labels.slice(0, 5).map((c: string) => (
                        <th key={c} className="px-3 py-1 text-right">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.col_contrib).map(([label, contribs]: [string, any]) => (
                      <tr key={label} className="border-t">
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c: string) => (
                          <td key={c} className="px-3 py-1 text-right">
                            {contribs[c]?.toFixed(1)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CABiplotPlotly({
  rowPoints,
  colPoints,
  dim1,
  dim2,
}: {
  rowPoints: any[];
  colPoints: any[];
  dim1: string;
  dim2: string;
}) {
  const traces: Data[] = [
    {
      x: rowPoints.map(p => p.x),
      y: rowPoints.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: 'Lignes',
      text: rowPoints.map(p => p.name),
      textposition: 'top center',
      textfont: { size: 9, color: '#22d3ee' },
      marker: {
        size: 9,
        color: '#06b6d4',
        symbol: 'circle',
        line: { color: 'rgba(255,255,255,0.2)', width: 1 },
      },
      hovertemplate:
        '<b>%{text}</b><br>' + dim1 + ': %{x:.3f}<br>' + dim2 + ': %{y:.3f}<extra>Ligne</extra>',
    } as Data,
    {
      x: colPoints.map(p => p.x),
      y: colPoints.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: 'Colonnes',
      text: colPoints.map(p => p.name),
      textposition: 'bottom center',
      textfont: { size: 9, color: '#fcd34d' },
      marker: {
        size: 11,
        color: '#f59e0b',
        symbol: 'diamond',
        line: { color: 'rgba(255,255,255,0.2)', width: 1 },
      },
      hovertemplate:
        '<b>%{text}</b><br>' +
        dim1 +
        ': %{x:.3f}<br>' +
        dim2 +
        ': %{y:.3f}<extra>Colonne</extra>',
    } as Data,
  ];
  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    xaxis: {
      ...DARK_TEMPLATE.xaxis,
      title: { text: dim1, font: { color: '#dfe3ee' } },
      zeroline: true,
      zerolinecolor: 'rgba(255,255,255,0.15)',
    },
    yaxis: {
      ...DARK_TEMPLATE.yaxis,
      title: { text: dim2, font: { color: '#dfe3ee' } },
      zeroline: true,
      zerolinecolor: 'rgba(255,255,255,0.15)',
    },
    legend: { orientation: 'h', y: -0.15 },
    margin: { l: 60, r: 20, t: 10, b: 60 },
  };
  return (
    <Plot
      data={traces}
      layout={layout}
      config={DEFAULT_CONFIG}
      style={{ width: '100%', height: 420 }}
      useResizeHandler
    />
  );
}
