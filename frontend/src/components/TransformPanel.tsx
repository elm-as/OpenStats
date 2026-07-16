import { useState } from 'react';
import {
  useGetTransformRecommendationsQuery,
  useGetTransformCatalogQuery,
  usePreviewTransformMutation,
  useApplyTransformsMutation,
  useGetDatasetQuery,
} from '../store/api';
import type { TransformRecommendation, TransformPreview } from '../types';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from './viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import {
  Wrench, AlertTriangle, ArrowRight, Check, Eye, Play,
  ChevronDown, ChevronUp, RotateCcw, Zap, Calculator,
} from 'lucide-react';
import ComputedVariableEditor from './ComputedVariableEditor';

interface Props {
  datasetId: string;
  onTransformApplied?: () => void;
}

export default function TransformPanel({ datasetId, onTransformApplied }: Props) {
  const { data: recsData, refetch: refetchRecs } = useGetTransformRecommendationsQuery(datasetId);
  const { data: catalogData } = useGetTransformCatalogQuery(datasetId);
  const { data: datasetInfo } = useGetDatasetQuery(datasetId);
  const [previewTransform] = usePreviewTransformMutation();
  const [applyTransforms, { isLoading: isApplying }] = useApplyTransformsMutation();

  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedTransforms, setSelectedTransforms] = useState<
    { column: string; transform: string; params?: Record<string, unknown> }[]
  >([]);
  const [appliedLogs, setAppliedLogs] = useState<unknown[] | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCol, setManualCol] = useState('');
  const [manualTransform, setManualTransform] = useState('');
  const [mode, setMode] = useState<'transform' | 'compute'>('transform');

  const recommendations = recsData?.recommendations || [];
  const catalog = catalogData?.transforms || [];
  const datasetCols = datasetInfo?.profile?.dtypes ? Object.keys(datasetInfo.profile.dtypes) : [];

  // Grouper les recommandations par catégorie
  const grouped: Record<string, TransformRecommendation[]> = {};
  for (const r of recommendations) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const categoryLabels: Record<string, string> = {
    distribution: 'Distribution (asymétrie, normalité)',
    outliers: 'Valeurs aberrantes',
    scale: 'Échelles différentes',
    correlation: 'Corrélation / Multicolinéarité',
    timeseries: 'Séries temporelles',
  };

  const severityColor: Record<string, string> = {
    high: 'bg-red-100 text-red-800 border-red-200',
    medium: 'bg-amber-100 text-amber-800 border-amber-200',
    low: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const handlePreview = async (column: string, transform: string) => {
    setPreviewLoading(true);
    try {
      const result = await previewTransform({ id: datasetId, column, transform }).unwrap();
      setPreview(result);
    } catch {
      setPreview(null);
    }
    setPreviewLoading(false);
  };

  const toggleSelected = (column: string, transform: string) => {
    const key = `${column}::${transform}`;
    setSelectedTransforms((prev) => {
      const exists = prev.find((t) => `${t.column}::${t.transform}` === key);
      if (exists) return prev.filter((t) => `${t.column}::${t.transform}` !== key);
      return [...prev, { column, transform }];
    });
  };

  const isSelected = (column: string, transform: string) =>
    selectedTransforms.some((t) => t.column === column && t.transform === transform);

  const handleApply = async (inplace: boolean) => {
    if (selectedTransforms.length === 0) return;
    try {
      const result = await applyTransforms({
        id: datasetId,
        transforms: selectedTransforms,
        inplace,
      }).unwrap();
      setAppliedLogs(result.logs);
      if (inplace) {
        setSelectedTransforms([]);
        refetchRecs();
        onTransformApplied?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-600" />
            Transformations de données
          </h3>
          <div className="flex bg-gray-100 p-1 rounded-lg w-max">
            <button
              onClick={() => setMode('transform')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'transform' ? 'bg-white shadow-sm text-primary-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transformations
            </button>
            <button
              onClick={() => setMode('compute')}
              className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                mode === 'compute' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calculator className="w-3 h-3" />
              Calculer
            </button>
          </div>
        </div>
        
        {mode === 'transform' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManualMode(!manualMode)}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Zap className="w-4 h-4" />
              {manualMode ? 'Recommandations' : 'Mode manuel'}
            </button>
            <button onClick={() => refetchRecs()} className="btn-secondary text-sm flex items-center gap-1">
              <RotateCcw className="w-4 h-4" /> Actualiser
            </button>
          </div>
        )}
      </div>

      {mode === 'compute' && (
        <ComputedVariableEditor 
          datasetId={datasetId} 
          columns={datasetCols} 
          onComputed={() => {
            if (onTransformApplied) onTransformApplied();
          }} 
        />
      )}

      {mode === 'transform' && (
        <>

      {/* Résumé des sélections */}
      {selectedTransforms.length > 0 && (
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-primary-800">
              {selectedTransforms.length} transformation{selectedTransforms.length > 1 ? 's' : ''} sélectionnée{selectedTransforms.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApply(false)}
                disabled={isApplying}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Eye className="w-4 h-4" /> Aperçu
              </button>
              <button
                onClick={() => handleApply(true)}
                disabled={isApplying}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <Play className="w-4 h-4" /> Appliquer au dataset
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTransforms.map((t, i) => {
              const info = catalog.find((c) => c.key === t.transform);
              return (
                <span
                  key={i}
                  onClick={() => toggleSelected(t.column, t.transform)}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border border-primary-300 cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  <span className="font-medium">{t.column}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span>{info?.label || t.transform}</span>
                  <span className="text-red-400 ml-1">×</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Mode manuel */}
      {manualMode && (
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Appliquer une transformation manuellement</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colonne</label>
              <input
                type="text"
                value={manualCol}
                onChange={(e) => setManualCol(e.target.value)}
                placeholder="Nom de la colonne"
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Transformation</label>
              <select
                value={manualTransform}
                onChange={(e) => setManualTransform(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                title="Transformation"
              >
                <option value="">Choisir...</option>
                {catalog.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => manualCol && manualTransform && handlePreview(manualCol, manualTransform)}
                disabled={!manualCol || !manualTransform}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Eye className="w-4 h-4" /> Aperçu
              </button>
              <button
                onClick={() => manualCol && manualTransform && toggleSelected(manualCol, manualTransform)}
                disabled={!manualCol || !manualTransform}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recommandations */}
      {!manualMode && recommendations.length === 0 && (
        <div className="card p-8 text-center">
          <Check className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Aucune transformation recommandée</p>
          <p className="text-sm text-gray-400 mt-1">
            Les données semblent déjà dans un état correct. Lancez d'abord une analyse pour obtenir des recommandations contextuelles.
          </p>
        </div>
      )}

      {!manualMode && Object.entries(grouped).map(([category, recs]) => (
        <div key={category} className="card">
          <button
            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${
                recs.some((r) => r.severity === 'high') ? 'text-red-500' : 'text-amber-500'
              }`} />
              <h4 className="font-semibold text-gray-900">
                {categoryLabels[category] || category}
              </h4>
              <span className="badge bg-gray-100 text-gray-600">{recs.length}</span>
            </div>
            {expandedCategory === category
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedCategory === category && (
            <div className="mt-3 space-y-3">
              {recs.map((rec, i) => (
                <RecommendationCard
                  key={`${rec.column}-${rec.issue}-${i}`}
                  rec={rec}
                  catalog={catalog}
                  isSelected={isSelected}
                  onToggle={toggleSelected}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Aperçu de transformation */}
      {previewLoading && (
        <div className="card p-8 text-center">
          <div className="animate-spin w-6 h-6 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
          <p className="text-gray-500 mt-2 text-sm">Calcul de l'aperçu...</p>
        </div>
      )}

      {preview && !previewLoading && (
        <PreviewCard preview={preview} catalog={catalog} />
      )}

      {/* Logs d'application */}
      {appliedLogs && (
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Résultat des transformations</h4>
          <div className="space-y-2">
            {(appliedLogs as { column: string; transform: string; label?: string; success: boolean; error?: string; before?: Record<string, number | null>; after?: Record<string, number | null> }[]).map((log, i) => (
              <div key={i} className={`p-3 rounded-lg border text-sm ${
                log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{log.column}</span>
                    <ArrowRight className="w-3 h-3 inline mx-1" />
                    <span>{log.label || log.transform}</span>
                  </span>
                  {log.success
                    ? <Check className="w-4 h-4 text-green-600" />
                    : <span className="text-red-600">{log.error}</span>}
                </div>
                {log.success && log.before && log.after && (
                  <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium text-gray-500">Avant :</span>
                      {' '}skew={fmtN(log.before.skewness)} μ={fmtN(log.before.mean)} σ={fmtN(log.before.std)}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Après :</span>
                      {' '}skew={fmtN(log.after.skewness)} μ={fmtN(log.after.mean)} σ={fmtN(log.after.std)}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setAppliedLogs(null)}
            className="mt-3 text-sm text-gray-500 underline"
          >
            Fermer
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ── Sub-components ──

function RecommendationCard({
  rec,
  catalog,
  isSelected,
  onToggle,
  onPreview,
}: {
  rec: TransformRecommendation;
  catalog: { key: string; label: string; description: string }[];
  isSelected: (col: string, t: string) => boolean;
  onToggle: (col: string, t: string) => void;
  onPreview: (col: string, t: string) => void;
}) {
  const severityClass: Record<string, string> = {
    high: 'border-l-red-500',
    medium: 'border-l-amber-500',
    low: 'border-l-blue-500',
  };

  return (
    <div className={`border-l-4 ${severityClass[rec.severity] || ''} bg-gray-50 rounded-r-lg p-3`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-sm font-bold text-gray-800">{rec.column}</span>
            <span className={`badge text-xs ${
              rec.severity === 'high' ? 'bg-red-100 text-red-700' :
              rec.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {rec.severity === 'high' ? 'Critique' : rec.severity === 'medium' ? 'Modéré' : 'Info'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700">{rec.issue_label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{rec.detail}</p>
          {rec.note && <p className="text-xs text-gray-400 italic mt-1">{rec.note}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rec.suggested_transforms.map((tKey) => {
          const info = catalog.find((c) => c.key === tKey);
          const selected = isSelected(rec.column, tKey);
          return (
            <div key={tKey} className="flex items-center gap-1">
              <button
                onClick={() => onToggle(rec.column, tKey)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  selected
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-primary-400'
                }`}
                title={info?.description}
              >
                {selected && <Check className="w-3 h-3 inline mr-1" />}
                {info?.label || tKey}
              </button>
              <button
                onClick={() => onPreview(rec.column, tKey)}
                className="text-gray-400 hover:text-primary-600 transition-colors"
                title="Aperçu"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewCard({
  preview,
  catalog,
}: {
  preview: TransformPreview;
  catalog: { key: string; label: string }[];
}) {
  const info = catalog.find((c) => c.key === preview.transform);

  const chartData = preview.original.values.map((v, i) => ({
    idx: i,
    original: v,
    transformed: preview.transformed.values[i],
  }));

  return (
    <div className="card border-primary-200">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-primary-600" />
        <h4 className="font-semibold text-gray-900">
          Aperçu : <span className="font-mono">{preview.column}</span> → {info?.label || preview.transform}
        </h4>
      </div>

      {/* Stats comparison */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Avant</p>
          <StatsRow label="Moyenne" value={preview.original.mean} />
          <StatsRow label="Écart-type" value={preview.original.std} />
          <StatsRow label="Asymétrie" value={preview.original.skewness} highlight={Math.abs(preview.original.skewness ?? 0) > 1} />
          <StatsRow label="Kurtosis" value={preview.original.kurtosis} />
        </div>
        <div className="bg-primary-50 rounded-lg p-3">
          <p className="text-xs font-medium text-primary-600 mb-2">Après</p>
          <StatsRow label="Moyenne" value={preview.transformed.mean} />
          <StatsRow label="Écart-type" value={preview.transformed.std} />
          <StatsRow label="Asymétrie" value={preview.transformed.skewness} highlight={Math.abs(preview.transformed.skewness ?? 0) > 1} good={Math.abs(preview.transformed.skewness ?? 0) < Math.abs(preview.original.skewness ?? 0)} />
          <StatsRow label="Kurtosis" value={preview.transformed.kurtosis} />
        </div>
      </div>

      {/* Chart Plotly : double-axe + histogrammes */}
      <PreviewChart
        original={preview.original.values as number[]}
        transformed={preview.transformed.values as number[]}
      />
    </div>
  );
}

function PreviewChart({ original, transformed }: { original: number[]; transformed: number[] }) {
  const xs = original.map((_, i) => i);
  const traces: Data[] = [
    {
      x: xs, y: original,
      type: 'scatter', mode: 'lines',
      name: 'Original',
      line: { color: '#94a3b8', width: 1.4 },
      hovertemplate: '#%{x}<br>orig: %{y:.4f}<extra></extra>',
    } as Data,
    {
      x: xs, y: transformed,
      type: 'scatter', mode: 'lines',
      name: 'Transformé',
      line: { color: '#22d3ee', width: 1.6 },
      yaxis: 'y2',
      hovertemplate: '#%{x}<br>trans: %{y:.4f}<extra></extra>',
    } as Data,
  ];
  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 50, r: 50, t: 10, b: 35 },
    xaxis: { ...DARK_TEMPLATE.xaxis, title: { text: 'Index', font: { color: '#dfe3ee', size: 10 } } },
    yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: 'Original', font: { color: '#94a3b8', size: 10 } } },
    yaxis2: {
      title: { text: 'Transformé', font: { color: '#22d3ee', size: 10 } },
      overlaying: 'y', side: 'right',
      gridcolor: 'transparent',
      zeroline: false,
      tickfont: { color: '#22d3ee', size: 9 },
    },
    legend: { orientation: 'h', y: -0.2, font: { color: '#dfe3ee' } },
  };
  return <Plot data={traces} layout={layout} config={DEFAULT_CONFIG} style={{ width: '100%', height: 220 }} useResizeHandler />;
}

function StatsRow({ label, value, highlight, good }: { label: string; value: number | null; highlight?: boolean; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-mono text-xs ${
        highlight ? (good ? 'text-green-600 font-bold' : 'text-red-500 font-bold') : 'text-gray-800'
      }`}>
        {fmtN(value)}
      </span>
    </div>
  );
}

function fmtN(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(3);
}
