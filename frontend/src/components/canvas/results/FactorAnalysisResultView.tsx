import React from 'react';
import { BarChart2, Hash, Layers, TrendingUp } from 'lucide-react';
import { Section, KpiCard, DataTable } from './ResultAtoms';
import { SvgScatterPlot, SvgBarChart } from './ResultCharts';

export const FactorAnalysisResultView = ({
  nodeType,
  resultData,
}: {
  nodeType: string;
  resultData: any;
}) => {
  const evr = resultData.explained_variance_ratio || [];
  const cumVar = resultData.cumulative_variance || [];
  const compLabels: string[] = resultData.component_labels || evr.map((_: any, i: number) => `CP${i + 1}`);
  const method = resultData.method || nodeType.toUpperCase();
  const nObs = resultData.n_observations;
  const nVars = resultData.n_variables || resultData.n_modalities;

  // --- Correlation circle / Variables plot ---
  const corrCircle = resultData.correlation_circle || resultData.loadings;
  const variablePoints: { x: number; y: number; label: string }[] = [];
  if (corrCircle && typeof corrCircle === 'object') {
    Object.entries(corrCircle).forEach(([varName, coords]: [string, any]) => {
      const x = coords.x ?? coords.CP1 ?? coords.Dim1 ?? 0;
      const y = coords.y ?? coords.CP2 ?? coords.Dim2 ?? 0;
      variablePoints.push({ x, y, label: varName });
    });
  }

  // --- Modality coords (for MCA) ---
  const modCoords = resultData.modality_coords;
  const modalityPoints: { x: number; y: number; label: string; color?: string }[] = [];
  if (modCoords && typeof modCoords === 'object') {
    const modInfo = resultData.modality_info || [];
    const varColors: Record<string, string> = {};
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
    let colorIdx = 0;
    Object.entries(modCoords).forEach(([modName, coords]: [string, any]) => {
      const info = modInfo.find((m: any) => m.full === modName);
      const varName = info?.variable || modName.split(':::')[0];
      if (!varColors[varName]) varColors[varName] = palette[colorIdx++ % palette.length];
      const x = coords.Dim1 ?? coords.CP1 ?? 0;
      const y = coords.Dim2 ?? coords.CP2 ?? 0;
      modalityPoints.push({ x, y, label: info?.modality || modName, color: varColors[varName] });
    });
  }

  // --- Individual scores (first 2 axes) ---
  const scores = resultData.scores || resultData.individual_coords;
  const individualPoints: { x: number; y: number; label: string }[] = [];
  if (Array.isArray(scores)) {
    scores.slice(0, 200).forEach((row: any, i: number) => {
      const x = row.CP1 ?? row.Dim1 ?? 0;
      const y = row.CP2 ?? row.Dim2 ?? 0;
      individualPoints.push({ x, y, label: `${i + 1}` });
    });
  }

  // --- Row/Col coords for CA ---
  const rowCoords = resultData.row_coords;
  const colCoords = resultData.col_coords;
  const caPoints: { x: number; y: number; label: string; color?: string }[] = [];
  if (rowCoords) {
    Object.entries(rowCoords).forEach(([lbl, c]: [string, any]) => {
      caPoints.push({ x: c.Dim1 ?? 0, y: c.Dim2 ?? 0, label: lbl, color: '#3b82f6' });
    });
  }
  if (colCoords) {
    Object.entries(colCoords).forEach(([lbl, c]: [string, any]) => {
      caPoints.push({ x: c.Dim1 ?? 0, y: c.Dim2 ?? 0, label: lbl, color: '#f59e0b' });
    });
  }

  // --- Contributions table (top variables) ---
  const contribVar = resultData.contrib_var;
  const ax1 = compLabels[0] || 'Axe 1';
  const ax2 = compLabels[1] || 'Axe 2';

  return (
    <div className="space-y-5">
      <Section title={`${method} - Résumé`} icon={BarChart2} color="#06b6d4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {nObs && <KpiCard label="Observations" value={nObs} icon={Hash} color="#3b82f6" />}
          {nVars && <KpiCard label="Variables" value={nVars} icon={Layers} color="#8b5cf6" />}
          <KpiCard
            label="Composantes"
            value={resultData.n_components || evr.length}
            icon={BarChart2}
            color="#06b6d4"
          />
          {cumVar.length > 0 && (
            <KpiCard
              label="Var. cumulée (2 axes)"
              value={`${(
                (cumVar[1] ?? cumVar[0] ?? 0) > 1
                  ? cumVar[1] ?? cumVar[0]
                  : (cumVar[1] ?? cumVar[0]) * 100
              ).toFixed(1)}%`}
              icon={TrendingUp}
              color="#10b981"
            />
          )}
        </div>
      </Section>

      {evr.length > 0 && (
        <SvgBarChart
          values={evr.map((v: number) => (v > 1 ? v : v * 100))}
          labels={compLabels.slice(0, evr.length)}
          title="Éboulis des valeurs propres (% variance)"
          color="#06b6d4"
        />
      )}

      {variablePoints.length > 0 && (
        <SvgScatterPlot
          points={variablePoints}
          title={`Cercle des corrélations (${ax1} vs ${ax2})`}
          xLabel={`${ax1} (${evr[0] ? (evr[0] > 1 ? evr[0] : evr[0] * 100).toFixed(1) : '?'}%)`}
          yLabel={`${ax2} (${evr[1] ? (evr[1] > 1 ? evr[1] : evr[1] * 100).toFixed(1) : '?'}%)`}
          showCircle={nodeType === 'pca'}
        />
      )}

      {individualPoints.length > 0 && (
        <SvgScatterPlot
          points={individualPoints}
          title={`Plan des individus (${ax1} vs ${ax2})`}
          xLabel={ax1}
          yLabel={ax2}
        />
      )}

      {caPoints.length > 0 && (
        <SvgScatterPlot
          points={caPoints}
          title={`Biplot AFC (${ax1} vs ${ax2})`}
          xLabel={ax1}
          yLabel={ax2}
        />
      )}

      {modalityPoints.length > 0 && (
        <SvgScatterPlot
          points={modalityPoints}
          title={`Plan des modalités ACM (${ax1} vs ${ax2})`}
          xLabel={ax1}
          yLabel={ax2}
        />
      )}

      {contribVar && typeof contribVar === 'object' && (
        <Section title="Contributions des variables (%)" icon={BarChart2} color="#f59e0b">
          <DataTable
            headers={['Variable', ...compLabels.slice(0, 3)]}
            rows={Object.entries(contribVar).map(([v, comps]: [string, any]) => [
              v,
              ...compLabels.slice(0, 3).map(c => comps[c] ?? '\u2014'),
            ])}
          />
        </Section>
      )}
    </div>
  );
};
