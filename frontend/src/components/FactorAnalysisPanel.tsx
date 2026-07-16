import { useState } from 'react';
import { useRunPCAMutation, useRunCAMutation, useRunMCAMutation } from '../store/api';
import type { DataCapabilities, PCAResult, CAResult, MCAResult } from '../types';
import { ArrowLeft, Play, Layers, Grid3X3, ChevronDown, ChevronUp } from 'lucide-react';
import { ScreePlot, PCACorrelationCircle, PCABiplot } from './viz';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from './viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

const COLORS = [
  '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

const METHODS = [
  { key: 'pca', label: 'ACP — Analyse en Composantes Principales', desc: 'Réduction de dimensions pour variables numériques', icon: Layers },
  { key: 'ca', label: 'AFC — Analyse Factorielle des Correspondances', desc: 'Association entre deux variables catégorielles', icon: Grid3X3 },
  { key: 'mca', label: 'ACM — Analyse des Correspondances Multiples', desc: 'Analyse factorielle de variables catégorielles', icon: Layers },
] as const;

type MethodKey = (typeof METHODS)[number]['key'];

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  onBack: () => void;
  initialMethod?: string;
}

export default function FactorAnalysisPanel({ datasetId, capabilities, onBack, initialMethod }: Props) {
  const [runPCA, { isLoading: loadingPCA }] = useRunPCAMutation();
  const [runCA, { isLoading: loadingCA }] = useRunCAMutation();
  const [runMCA, { isLoading: loadingMCA }] = useRunMCAMutation();

  const [method, setMethod] = useState<MethodKey | null>(
    initialMethod === 'pca' || initialMethod === 'ca' || initialMethod === 'mca' ? initialMethod : null,
  );
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [rowCol, setRowCol] = useState('');
  const [colCol, setColCol] = useState('');
  const [autoComponents, setAutoComponents] = useState(true);
  const [nComponents, setNComponents] = useState(5);

  const [pcaResult, setPcaResult] = useState<PCAResult | null>(null);
  const [caResult, setCaResult] = useState<CAResult | null>(null);
  const [mcaResult, setMcaResult] = useState<MCAResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isLoading = loadingPCA || loadingCA || loadingMCA;
  const numericCols = capabilities.columns.numeric;
  const catCols = [...capabilities.columns.categorical, ...capabilities.columns.discrete];

  const toggleCol = (col: string) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleRun = async () => {
    setError(null);
    setPcaResult(null);
    setCaResult(null);
    setMcaResult(null);

    try {
      const comps = autoComponents ? undefined : nComponents;
      if (method === 'pca') {
        const cols = selectedCols.length > 0 ? selectedCols : undefined;
        const r = await runPCA({ id: datasetId, columns: cols, n_components: comps }).unwrap();
        setPcaResult(r);
      } else if (method === 'ca') {
        if (!rowCol || !colCol) { setError('Sélectionnez les deux variables'); return; }
        if (rowCol === colCol) { setError('Les deux variables doivent être différentes'); return; }
        const r = await runCA({ id: datasetId, row_col: rowCol, col_col: colCol, n_components: comps }).unwrap();
        setCaResult(r);
      } else if (method === 'mca') {
        const cols = selectedCols.length > 0 ? selectedCols : undefined;
        const r = await runMCA({ id: datasetId, columns: cols, n_components: nComponents }).unwrap();
        setMcaResult(r);
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
    }
  };

  // Method selection
  if (!method) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Analyse factorielle</h3>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const available = m.key === 'pca' ? numericCols.length >= 2
              : catCols.length >= 2;
            return (
              <button
                key={m.key}
                onClick={() => available && setMethod(m.key)}
                disabled={!available}
                className={`card text-left p-4 transition-all ${available ? 'hover:shadow-md hover:border-cyan-300 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              >
                <Icon className="w-6 h-6 text-cyan-600 mb-2" />
                <h4 className="font-semibold text-sm text-gray-900">{m.label}</h4>
                <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                {!available && <p className="text-xs text-red-500 mt-1">Pas assez de variables</p>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const hasResult = pcaResult || caResult || mcaResult;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">
          {METHODS.find((m) => m.key === method)?.label}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => { setMethod(null); setPcaResult(null); setCaResult(null); setMcaResult(null); }} className="btn-secondary text-sm">
            Changer de méthode
          </button>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
      </div>

      {/* Configuration */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3">Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Column selection for PCA */}
          {method === 'pca' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variables numériques (toutes si aucune sélection)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded border-gray-300 text-cyan-600" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* AFC config */}
          {method === 'ca' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variable en ligne</label>
                <select value={rowCol} onChange={(e) => setRowCol(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" title="Variable en ligne">
                  <option value="">Sélectionner...</option>
                  {catCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variable en colonne</label>
                <select value={colCol} onChange={(e) => setColCol(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" title="Variable en colonne">
                  <option value="">Sélectionner...</option>
                  {catCols.filter((c) => c !== rowCol).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {/* MCA config */}
          {method === 'mca' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variables catégorielles (toutes si aucune sélection)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                {catCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded border-gray-300 text-cyan-600" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* N components */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de composantes</label>
            <input
              type="number" min={2} max={20} value={nComponents}
              onChange={(e) => setNComponents(Math.max(2, parseInt(e.target.value) || 2))}
              title="Nombre de composantes"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="mt-4">
          <button onClick={handleRun} disabled={isLoading} className="btn-primary flex items-center gap-2">
            {isLoading ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Calcul en cours...</>
            ) : (
              <><Play className="w-4 h-4" /> Lancer l'analyse</>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {pcaResult && <PCAResults result={pcaResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
      {caResult && <CAResults result={caResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
      {mcaResult && <MCAResults result={mcaResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
    </div>
  );
}

// ── PCA Results ──

function PCAResults({ result, showDetails, setShowDetails }: { result: PCAResult; showDetails: boolean; setShowDetails: (v: boolean) => void }) {
  // Construction des coords variables (loadings) au format attendu par PCACorrelationCircle
  const variableCoords: Record<string, number[]> = {};
  result.variables.forEach((v) => {
    const loadings = result.correlation_circle[v];
    if (loadings) {
      variableCoords[v] = [loadings.x ?? 0, loadings.y ?? 0];
    }
  });

  // Coords individus pour le biplot (limitées à 500 pour perf)
  const individualCoords = (result.scores || []).slice(0, 500).map((s: any, i: number) => ({
    name: `obs ${i + 1}`,
    coords: typeof s === 'object' && !Array.isArray(s)
      ? Object.values(s) as number[]
      : (s as number[]),
  }));

  // Variables coords pour biplot (mêmes loadings)
  const biplotVariables: Record<string, number[]> = { ...variableCoords };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Résumé ACP</h4>
          <span className="text-sm text-gray-500">{result.n_observations} obs. × {result.n_variables} var.</span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map(v => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis des valeurs propres"
        />
      </div>

      {/* Correlation circle (Plotly) */}
      {Object.keys(variableCoords).length > 0 && (
        <div className="card">
          <PCACorrelationCircle
            coords={variableCoords}
            explainedVariance={result.explained_variance_ratio.map(v => v ?? NaN)}
            title="Cercle des corrélations"
          />
        </div>
      )}

      {/* Biplot (individus + variables) */}
      {individualCoords.length > 0 && Object.keys(biplotVariables).length > 0 && (
        <div className="card">
          <PCABiplot
            individuals={individualCoords}
            variables={biplotVariables}
            explainedVariance={result.explained_variance_ratio.map(v => v ?? NaN)}
            title="Biplot — Individus & Variables"
          />
        </div>
      )}

      {/* Variance table */}
      <div className="card">
        <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails (contributions, cos²)
        </button>
        {showDetails && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium">Variable</th>
                  {result.component_labels.slice(0, 5).map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium" colSpan={2}>{c}</th>
                  ))}
                </tr>
                <tr className="bg-gray-50">
                  <th></th>
                  {result.component_labels.slice(0, 5).map((c) => (
                    <><th key={`${c}-contrib`} className="px-2 py-1 text-right text-gray-500">Contrib%</th>
                    <th key={`${c}-cos2`} className="px-2 py-1 text-right text-gray-500">Cos²</th></>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.variables.map((v) => (
                  <tr key={v} className="border-t">
                    <td className="px-3 py-2 font-medium">{v}</td>
                    {result.component_labels.slice(0, 5).map((c) => (
                      <><td key={`${v}-${c}-contrib`} className="px-2 py-1 text-right">{result.contrib_var[v]?.[c]?.toFixed(1)}</td>
                      <td key={`${v}-${c}-cos2`} className="px-2 py-1 text-right">{result.cos2_var[v]?.[c]?.toFixed(3)}</td></>
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

// ── CA Results ──

function CAResults({ result, showDetails, setShowDetails }: { result: CAResult; showDetails: boolean; setShowDetails: (v: boolean) => void }) {
  const screeData = result.component_labels.map((label, i) => ({
    name: label,
    eigenvalue: result.eigenvalues[i],
    variance: ((result.explained_variance_ratio[i] ?? 0) * 100),
    cumulative: ((result.cumulative_variance[i] ?? 0) * 100),
  }));

  // Biplot data: rows and columns on first 2 axes
  const dim1 = result.component_labels[0] || 'Dim1';
  const dim2 = result.component_labels[1] || 'Dim2';

  const rowPoints = Object.entries(result.row_coords).map(([name, coords]) => ({
    name, x: coords[dim1] ?? 0, y: coords[dim2] ?? 0, type: 'Ligne',
  }));
  const colPoints = Object.entries(result.col_coords).map(([name, coords]) => ({
    name, x: coords[dim1] ?? 0, y: coords[dim2] ?? 0, type: 'Colonne',
  }));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Résumé AFC</h4>
          <span className="text-sm text-gray-500">Inertie totale : {result.total_inertia?.toFixed(4)}</span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map(v => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis (AFC)"
        />
      </div>

      {/* Biplot Plotly */}
      <div className="card">
        <h5 className="text-sm font-medium text-gray-700 mb-2">Biplot ({dim1} vs {dim2})</h5>
        <CABiplotPlotly rowPoints={rowPoints} colPoints={colPoints} dim1={dim1} dim2={dim2} />
      </div>

      {/* Contributions */}
      <div className="card">
        <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails (contributions, cos²)
        </button>
        {showDetails && (
          <div className="mt-3 space-y-4">
            <div>
              <h6 className="text-xs font-semibold text-gray-600 mb-1">Contributions des lignes (%)</h6>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-1 text-left">Modalité</th>
                    {result.component_labels.slice(0, 5).map((c) => <th key={c} className="px-3 py-1 text-right">{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(result.row_contrib).map(([label, contribs]) => (
                      <tr key={label} className="border-t">
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c) => <td key={c} className="px-3 py-1 text-right">{contribs[c]?.toFixed(1)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h6 className="text-xs font-semibold text-gray-600 mb-1">Contributions des colonnes (%)</h6>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-1 text-left">Modalité</th>
                    {result.component_labels.slice(0, 5).map((c) => <th key={c} className="px-3 py-1 text-right">{c}</th>)}
                  </tr></thead>
                  <tbody>
                    {Object.entries(result.col_contrib).map(([label, contribs]) => (
                      <tr key={label} className="border-t">
                        <td className="px-3 py-1 font-medium">{label}</td>
                        {result.component_labels.slice(0, 5).map((c) => <td key={c} className="px-3 py-1 text-right">{contribs[c]?.toFixed(1)}</td>)}
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

// ── MCA Results ──

function MCAResults({ result, showDetails, setShowDetails }: { result: MCAResult; showDetails: boolean; setShowDetails: (v: boolean) => void }) {
  const screeData = result.component_labels.map((label, i) => ({
    name: label,
    eigenvalue: result.eigenvalues[i],
    variance: ((result.explained_variance_ratio[i] ?? 0) * 100),
    cumulative: ((result.cumulative_variance[i] ?? 0) * 100),
  }));

  const dim1 = result.component_labels[0] || 'Dim1';
  const dim2 = result.component_labels[1] || 'Dim2';

  // Group modalities by variable for coloring
  const variables = [...new Set(result.modality_info.map((m) => m.variable))];
  const varColorMap: Record<string, string> = {};
  variables.forEach((v, i) => { varColorMap[v] = COLORS[i % COLORS.length]; });

  const modalityPoints = result.modality_info.map((info) => ({
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
          <h4 className="font-semibold text-gray-900">Résumé ACM</h4>
          <span className="text-sm text-gray-500">{result.n_observations} obs. — {result.n_modalities} modalités — {result.n_variables} var.</span>
        </div>
        <ScreePlot
          values={result.explained_variance_ratio.map(v => v ?? NaN)}
          showCumulative
          mode="variance_ratio"
          title="Éboulis (ACM, Benzécri)"
        />
      </div>

      {/* Carte des modalités Plotly */}
      <div className="card">
        <h5 className="text-sm font-medium text-gray-700 mb-2">Nuage des modalités ({dim1} vs {dim2})</h5>
        <MCAModalityMap modalityPoints={modalityPoints} variables={variables} varColorMap={varColorMap} dim1={dim1} dim2={dim2} />
      </div>

      {/* η² */}
      {result.eta2 && (
        <div className="card">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Rapport de corrélation η²</h5>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-3 py-1 text-left">Variable</th>
                {result.component_labels.slice(0, 5).map((c) => <th key={c} className="px-3 py-1 text-right">{c}</th>)}
              </tr></thead>
              <tbody>
                {result.variables.map((v) => (
                  <tr key={v} className="border-t">
                    <td className="px-3 py-1 font-medium">{v}</td>
                    {result.component_labels.slice(0, 5).map((c) => (
                      <td key={c} className="px-3 py-1 text-right">{result.eta2[c]?.[v]?.toFixed(3)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contributions */}
      <div className="card">
        <button onClick={() => setShowDetails(!showDetails)} className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Détails des contributions
        </button>
        {showDetails && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-gray-50">
                <th className="px-3 py-1 text-left">Variable</th>
                <th className="px-3 py-1 text-left">Modalité</th>
                {result.component_labels.slice(0, 5).map((c) => (
                  <th key={c} className="px-3 py-1 text-right">Contrib% {c}</th>
                ))}
              </tr></thead>
              <tbody>
                {result.modality_info.map((info) => (
                  <tr key={info.full} className="border-t">
                    <td className="px-3 py-1" style={{ color: varColorMap[info.variable] }}>{info.variable}</td>
                    <td className="px-3 py-1">{info.modality}</td>
                    {result.component_labels.slice(0, 5).map((c) => (
                      <td key={c} className="px-3 py-1 text-right">{result.modality_contrib[info.full]?.[c]?.toFixed(1)}</td>
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


// -- Helpers Plotly --
function CABiplotPlotly({ rowPoints, colPoints, dim1, dim2 }: { rowPoints: any[]; colPoints: any[]; dim1: string; dim2: string }) {
  const traces: Data[] = [
    {
      x: rowPoints.map(p => p.x), y: rowPoints.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: 'Lignes',
      text: rowPoints.map(p => p.name),
      textposition: 'top center',
      textfont: { size: 9, color: '#22d3ee' },
      marker: { size: 9, color: '#06b6d4', symbol: 'circle', line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
      hovertemplate: '<b>%{text}</b><br>' + dim1 + ': %{x:.3f}<br>' + dim2 + ': %{y:.3f}<extra>Ligne</extra>',
    } as Data,
    {
      x: colPoints.map(p => p.x), y: colPoints.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: 'Colonnes',
      text: colPoints.map(p => p.name),
      textposition: 'bottom center',
      textfont: { size: 9, color: '#fcd34d' },
      marker: { size: 11, color: '#f59e0b', symbol: 'diamond', line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
      hovertemplate: '<b>%{text}</b><br>' + dim1 + ': %{x:.3f}<br>' + dim2 + ': %{y:.3f}<extra>Colonne</extra>',
    } as Data,
  ];
  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    xaxis: { ...DARK_TEMPLATE.xaxis, title: { text: dim1, font: { color: '#dfe3ee' } }, zeroline: true, zerolinecolor: 'rgba(255,255,255,0.15)' },
    yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: dim2, font: { color: '#dfe3ee' } }, zeroline: true, zerolinecolor: 'rgba(255,255,255,0.15)' },
    legend: { orientation: 'h', y: -0.15 },
    margin: { l: 60, r: 20, t: 10, b: 60 },
  };
  return <Plot data={traces} layout={layout} config={DEFAULT_CONFIG} style={{ width: '100%', height: 420 }} useResizeHandler />;
}

function MCAModalityMap({ modalityPoints, variables, varColorMap, dim1, dim2 }: { modalityPoints: any[]; variables: string[]; varColorMap: Record<string, string>; dim1: string; dim2: string }) {
  const traces: Data[] = variables.map(v => {
    const pts = modalityPoints.filter(p => p.variable === v);
    return {
      x: pts.map(p => p.x), y: pts.map(p => p.y),
      mode: 'text+markers',
      type: 'scatter',
      name: v,
      text: pts.map(p => p.name),
      textposition: 'top center',
      textfont: { size: 9, color: varColorMap[v] },
      marker: { size: 10, color: varColorMap[v], line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
      hovertemplate: '<b>%{text}</b><br>Variable: ' + v + '<br>' + dim1 + ': %{x:.3f}<br>' + dim2 + ': %{y:.3f}<extra></extra>',
    } as Data;
  });
  void SCI_COLORS;
  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    xaxis: { ...DARK_TEMPLATE.xaxis, title: { text: dim1, font: { color: '#dfe3ee' } }, zeroline: true, zerolinecolor: 'rgba(255,255,255,0.15)' },
    yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: dim2, font: { color: '#dfe3ee' } }, zeroline: true, zerolinecolor: 'rgba(255,255,255,0.15)' },
    legend: { orientation: 'h', y: -0.15 },
    margin: { l: 60, r: 20, t: 10, b: 60 },
  };
  return <Plot data={traces} layout={layout} config={DEFAULT_CONFIG} style={{ width: '100%', height: 440 }} useResizeHandler />;
}

