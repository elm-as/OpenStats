import React from 'react';
import type { PCAResult, CAResult } from '../../types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ScreePlot, PCACorrelationCircle, PCABiplot } from '../viz';
import { PlotlyChart, DEFAULT_CONFIG, SCI_COLORS, useCurrentTheme } from '../viz/PlotlyBase';
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
      <div className="ui-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Résumé ACP</h4>
          <span className="text-sm ui-t-muted ui-num">
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
            <table className="ui-table min-w-full text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Variable</th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <th key={c} className="px-3 py-2 text-right font-medium" colSpan={2}>
                      {c}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th></th>
                  {result.component_labels.slice(0, 5).map((c: string) => (
                    <React.Fragment key={c}>
                      <th className="px-2 py-1 text-right ui-t-muted">
                        Contrib%
                      </th>
                      <th className="px-2 py-1 text-right ui-t-muted">
                        Cos²
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.variables.map((v: string) => (
                  <tr key={v}>
                    <td className="px-3 py-2 font-medium">{v}</td>
                    {result.component_labels.slice(0, 5).map((c: string) => (
                      <React.Fragment key={c}>
                        <td className="px-2 py-1 text-right ui-num">
                          {result.contrib_var[v]?.[c]?.toFixed(1)}
                        </td>
                        <td className="px-2 py-1 text-right ui-num">
                          {result.cos2_var[v]?.[c]?.toFixed(3)}
                        </td>
                      </React.Fragment>
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
      <div className="ui-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Résumé AFC</h4>
          <span className="text-sm ui-t-muted ui-num">
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

      <div className="ui-panel p-4">
        <h5 className="text-sm font-medium ui-t-muted mb-2">
          Biplot ({dim1} vs {dim2})
        </h5>
        <CABiplotPlotly rowPoints={rowPoints} colPoints={colPoints} dim1={dim1} dim2={dim2} />
      </div>

      <div className="ui-panel p-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm font-medium ui-focusable"
          style={{ color: 'var(--ui-text)' }}
        >
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails (contributions, cos²)
        </button>
        {showDetails && (
          <div className="mt-3 space-y-4">
            <div>
              <h6 className="text-xs font-semibold ui-t-muted mb-1">
                Contributions des lignes (%)
              </h6>
              <div className="overflow-x-auto">
                <table className="ui-table min-w-full text-xs">
                  <thead>
                    <tr>
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
                      <tr key={label}>
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c: string) => (
                          <td key={c} className="px-3 py-1 text-right ui-num">
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
              <h6 className="text-xs font-semibold ui-t-muted mb-1">
                Contributions des colonnes (%)
              </h6>
              <div className="overflow-x-auto">
                <table className="ui-table min-w-full text-xs">
                  <thead>
                    <tr>
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
                      <tr key={label}>
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c: string) => (
                          <td key={c} className="px-3 py-1 text-right ui-num">
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
  const theme = useCurrentTheme();
  const rowTextColor = theme === 'light' ? '#0369a1' : '#38bdf8';
  const colTextColor = theme === 'light' ? '#b45309' : '#fcd34d';
  const strokeBorder = theme === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
  const traces: Data[] = [
    {
      x: rowPoints.map(p => p.x),
      y: rowPoints.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: 'Lignes',
      text: rowPoints.map(p => p.name),
      textposition: 'top center',
      textfont: { size: 9, color: rowTextColor },
      marker: {
        size: 9,
        color: SCI_COLORS[0],
        symbol: 'circle',
        line: { color: strokeBorder, width: 1 },
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
      textfont: { size: 9, color: colTextColor },
      marker: {
        size: 11,
        color: SCI_COLORS[1],
        symbol: 'diamond',
        line: { color: strokeBorder, width: 1 },
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
  return <PlotlyChart data={traces} layout={layout} config={DEFAULT_CONFIG} height={420} />;
}
