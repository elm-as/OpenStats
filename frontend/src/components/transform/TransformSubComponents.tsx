import type { TransformRecommendation, TransformPreview } from '../../types';
import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import { Check, Eye, ArrowRight, Play } from 'lucide-react';

export function formatStatNumber(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(3);
}

export function RecommendationCard({
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
            <span
              className={`badge text-xs ${
                rec.severity === 'high'
                  ? 'bg-red-100 text-red-700'
                  : rec.severity === 'medium'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {rec.severity === 'high' ? 'Critique' : rec.severity === 'medium' ? 'Modéré' : 'Info'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-700">{rec.issue_label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{rec.detail}</p>
          {rec.note && <p className="text-xs text-gray-400 italic mt-1">{rec.note}</p>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {rec.suggested_transforms.map(tKey => {
          const info = catalog.find(c => c.key === tKey);
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

export function PreviewCard({
  preview,
  catalog,
}: {
  preview: TransformPreview;
  catalog: { key: string; label: string }[];
}) {
  const info = catalog.find(c => c.key === preview.transform);

  return (
    <div className="card border-primary-200">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-primary-600" />
        <h4 className="font-semibold text-gray-900">
          Aperçu : <span className="font-mono">{preview.column}</span> →{' '}
          {info?.label || preview.transform}
        </h4>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">Avant</p>
          <StatsRow label="Moyenne" value={preview.original.mean} />
          <StatsRow label="Écart-type" value={preview.original.std} />
          <StatsRow
            label="Asymétrie"
            value={preview.original.skewness}
            highlight={Math.abs(preview.original.skewness ?? 0) > 1}
          />
          <StatsRow label="Kurtosis" value={preview.original.kurtosis} />
        </div>
        <div className="bg-primary-50 rounded-lg p-3">
          <p className="text-xs font-medium text-primary-600 mb-2">Après</p>
          <StatsRow label="Moyenne" value={preview.transformed.mean} />
          <StatsRow label="Écart-type" value={preview.transformed.std} />
          <StatsRow
            label="Asymétrie"
            value={preview.transformed.skewness}
            highlight={Math.abs(preview.transformed.skewness ?? 0) > 1}
            good={
              Math.abs(preview.transformed.skewness ?? 0) <
              Math.abs(preview.original.skewness ?? 0)
            }
          />
          <StatsRow label="Kurtosis" value={preview.transformed.kurtosis} />
        </div>
      </div>

      <PreviewChart
        original={preview.original.values as number[]}
        transformed={preview.transformed.values as number[]}
      />
    </div>
  );
}

function PreviewChart({
  original,
  transformed,
}: {
  original: number[];
  transformed: number[];
}) {
  const xs = original.map((_, i) => i);
  const traces: Data[] = [
    {
      x: xs,
      y: original,
      type: 'scatter',
      mode: 'lines',
      name: 'Original',
      line: { color: '#94a3b8', width: 1.4 },
      hovertemplate: '#%{x}<br>orig: %{y:.4f}<extra></extra>',
    } as Data,
    {
      x: xs,
      y: transformed,
      type: 'scatter',
      mode: 'lines',
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
    xaxis: {
      ...DARK_TEMPLATE.xaxis,
      title: { text: 'Index', font: { color: '#dfe3ee', size: 10 } },
    },
    yaxis: {
      ...DARK_TEMPLATE.yaxis,
      title: { text: 'Original', font: { color: '#94a3b8', size: 10 } },
    },
    yaxis2: {
      title: { text: 'Transformé', font: { color: '#22d3ee', size: 10 } },
      overlaying: 'y',
      side: 'right',
      gridcolor: 'transparent',
      zeroline: false,
      tickfont: { color: '#22d3ee', size: 9 },
    },
    legend: { orientation: 'h', y: -0.2, font: { color: '#dfe3ee' } },
  };
  return (
    <Plot
      data={traces}
      layout={layout}
      config={DEFAULT_CONFIG}
      style={{ width: '100%', height: 220 }}
      useResizeHandler
    />
  );
}

function StatsRow({
  label,
  value,
  highlight,
  good,
}: {
  label: string;
  value: number | null;
  highlight?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span
        className={`font-mono text-xs ${
          highlight
            ? good
              ? 'text-green-600 font-bold'
              : 'text-red-500 font-bold'
            : 'text-gray-800'
        }`}
      >
        {formatStatNumber(value)}
      </span>
    </div>
  );
}

export function SelectedTransformsBar({
  selectedTransforms,
  catalog,
  isApplying,
  onApply,
  onToggleSelected,
}: {
  selectedTransforms: { column: string; transform: string }[];
  catalog: { key: string; label: string }[];
  isApplying: boolean;
  onApply: (inplace: boolean) => void;
  onToggleSelected: (column: string, transform: string) => void;
}) {
  return (
    <div className="card bg-primary-50 border-primary-200">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-primary-800">
          {selectedTransforms.length} transformation
          {selectedTransforms.length > 1 ? 's' : ''} sélectionnée
          {selectedTransforms.length > 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onApply(false)}
            disabled={isApplying}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Eye className="w-4 h-4" /> Aperçu
          </button>
          <button
            onClick={() => onApply(true)}
            disabled={isApplying}
            className="btn-primary text-sm flex items-center gap-1"
          >
            <Play className="w-4 h-4" /> Appliquer au dataset
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedTransforms.map((t, i) => {
          const info = catalog.find(c => c.key === t.transform);
          return (
            <span
              key={i}
              onClick={() => onToggleSelected(t.column, t.transform)}
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
  );
}

export function AppliedLogsView({
  logs,
  onClose,
}: {
  logs: any[];
  onClose: () => void;
}) {
  return (
    <div className="card bg-green-50 border-green-200">
      <h4 className="font-semibold text-green-900 mb-2">Résultats de l'application</h4>
      <div className="space-y-2">
        {logs.map((log: any, i: number) => (
          <div key={i} className="text-sm bg-white rounded p-2 border border-green-100">
            <div className="flex items-center justify-between">
              <span className="font-mono font-medium">{log.column}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {log.success ? 'Succès' : 'Échec'}
              </span>
            </div>
            {log.success && log.before && log.after && (
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-medium text-gray-500">Avant :</span> skew=
                  {formatStatNumber(log.before.skewness)} μ=
                  {formatStatNumber(log.before.mean)} σ=
                  {formatStatNumber(log.before.std)}
                </div>
                <div>
                  <span className="font-medium text-gray-500">Après :</span> skew=
                  {formatStatNumber(log.after.skewness)} μ=
                  {formatStatNumber(log.after.mean)} σ=
                  {formatStatNumber(log.after.std)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 text-sm text-gray-500 underline">
        Fermer
      </button>
    </div>
  );
}
