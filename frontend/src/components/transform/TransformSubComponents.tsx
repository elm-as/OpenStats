import type { TransformRecommendation, TransformPreview } from '../../types';
import { PlotlyChart, DEFAULT_CONFIG, useCurrentTheme } from '../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import { Check, Eye, ArrowRight, Play } from 'lucide-react';

export function formatStatNumber(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toFixed(3);
}

export function RecommendationCard(props: {
  rec: TransformRecommendation;
  catalog: { key: string; label: string; description: string }[];
  isSelected: (col: string, t: string) => boolean;
  onToggle: (col: string, t: string) => void;
  onPreview: (col: string, t: string) => void;
}) {
  const rec = props.rec;
  const severityBorder =
    rec.severity === 'high' ? 'var(--ui-danger)'
      : rec.severity === 'medium' ? 'var(--ui-warning)'
        : 'var(--ui-info)';
  const severityTag =
    rec.severity === 'high' ? 'ui-tag ui-tag-danger'
      : rec.severity === 'medium' ? 'ui-tag ui-tag-warning'
        : 'ui-tag ui-tag-info';

  return (
    <div
      className="ui-panel p-2.5 space-y-2"
      style={{ borderLeft: `3px solid ${severityBorder}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="ui-mono text-xs font-bold" style={{ color: 'var(--ui-text)' }}>
              {rec.column}
            </span>
            <span className={severityTag}>
              {rec.severity === 'high' ? 'Critique' : rec.severity === 'medium' ? 'Modéré' : 'Info'}
            </span>
          </div>
          <p className="text-xs font-semibold" style={{ color: 'var(--ui-text-secondary)' }}>
            {rec.issue_label}
          </p>
          <p className="text-[11px] ui-t-muted ui-num">{rec.detail}</p>
          {rec.note && <p className="text-[11px] ui-t-faint italic mt-0.5">{rec.note}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rec.suggested_transforms.map(tKey => {
          const info = props.catalog.find(c => c.key === tKey);
          const selected = props.isSelected(rec.column, tKey);
          return (
            <div key={tKey} className="flex items-center gap-1">
              <button
                onClick={() => props.onToggle(rec.column, tKey)}
                className={`ui-btn text-xs ${selected ? 'ui-btn-primary' : ''}`}
                title={info?.description}
              >
                {selected && <Check className="w-3 h-3" />}
                {info?.label || tKey}
              </button>
              <button
                onClick={() => props.onPreview(rec.column, tKey)}
                className="ui-btn ui-btn-ghost p-1"
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

export function PreviewCard(props: {
  preview: TransformPreview;
  catalog: { key: string; label: string }[];
}) {
  const preview = props.preview;
  const info = props.catalog.find(c => c.key === preview.transform);

  return (
    <section className="ui-panel overflow-hidden" style={{ borderColor: 'var(--ui-accent)' }}>
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Eye className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Aperçu : <span className="ui-mono">{preview.column}</span> → {info?.label || preview.transform}
        </span>
      </header>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="ui-panel p-2.5" style={{ background: 'var(--ui-bg-sunken)' }}>
            <p className="ui-label mb-1">Avant</p>
            <StatsRow label="Moyenne" value={preview.original.mean} />
            <StatsRow label="Écart-type" value={preview.original.std} />
            <StatsRow
              label="Asymétrie"
              value={preview.original.skewness}
              highlight={Math.abs(preview.original.skewness ?? 0) > 1}
            />
            <StatsRow label="Kurtosis" value={preview.original.kurtosis} />
          </div>
          <div className="ui-panel p-2.5" style={{ background: 'var(--ui-accent-soft)' }}>
            <p className="ui-label mb-1" style={{ color: 'var(--ui-accent-text)' }}>Après</p>
            <StatsRow label="Moyenne" value={preview.transformed.mean} />
            <StatsRow label="Écart-type" value={preview.transformed.std} />
            <StatsRow
              label="Asymétrie"
              value={preview.transformed.skewness}
              highlight={Math.abs(preview.transformed.skewness ?? 0) > 1}
              good={Math.abs(preview.transformed.skewness ?? 0) < Math.abs(preview.original.skewness ?? 0)}
            />
            <StatsRow label="Kurtosis" value={preview.transformed.kurtosis} />
          </div>
        </div>

        <PreviewChart
          original={preview.original.values as number[]}
          transformed={preview.transformed.values as number[]}
        />
      </div>
    </section>
  );
}

function PreviewChart(props: { original: number[]; transformed: number[] }) {
  const isLight = useCurrentTheme() === 'light';
  const origColor = isLight ? '#64748b' : '#94a3b8';
  const transColor = isLight ? '#0e7490' : '#22d3ee';
  const xs = props.original.map((_, i) => i);
  const traces: Data[] = [
    {
      x: xs, y: props.original, type: 'scatter', mode: 'lines', name: 'Original',
      line: { color: origColor, width: 1.4 },
      hovertemplate: '#%{x}<br>orig: %{y:.4f}<extra></extra>',
    } as Data,
    {
      x: xs, y: props.transformed, type: 'scatter', mode: 'lines', name: 'Transformé',
      line: { color: transColor, width: 1.6 }, yaxis: 'y2',
      hovertemplate: '#%{x}<br>trans: %{y:.4f}<extra></extra>',
    } as Data,
  ];
  const layout: Partial<Layout> = {
    autosize: true,
    margin: { l: 50, r: 50, t: 10, b: 35 },
    xaxis: { title: { text: 'Index', font: { size: 10 } }, automargin: true },
    yaxis: { title: { text: 'Original', font: { color: origColor, size: 10 } }, automargin: true },
    yaxis2: {
      title: { text: 'Transformé', font: { color: transColor, size: 10 } },
      overlaying: 'y', side: 'right', showgrid: false, zeroline: false,
      tickfont: { color: transColor, size: 9 }, automargin: true,
    },
    legend: { orientation: 'h', y: -0.2 },
  };
  return <PlotlyChart data={traces} layout={layout} config={DEFAULT_CONFIG} height={220} />;
}

function StatsRow(props: {
  label: string;
  value: number | null;
  highlight?: boolean;
  good?: boolean;
}) {
  const toneColor = props.highlight
    ? props.good
      ? 'var(--ui-success)'
      : 'var(--ui-danger)'
    : 'var(--ui-text)';

  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="ui-t-muted">{props.label}</span>
      <span className="ui-num font-semibold" style={{ color: toneColor }}>
        {formatStatNumber(props.value)}
      </span>
    </div>
  );
}

export function SelectedTransformsBar(props: {
  selectedTransforms: { column: string; transform: string }[];
  catalog: { key: string; label: string }[];
  isApplying: boolean;
  onApply: (inplace: boolean) => void;
  onToggleSelected: (column: string, transform: string) => void;
}) {
  return (
    <div className="ui-panel p-2.5 space-y-2" style={{ borderColor: 'var(--ui-accent)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold ui-num" style={{ color: 'var(--ui-accent-text)' }}>
          {props.selectedTransforms.length} transformation{props.selectedTransforms.length > 1 ? 's' : ''} sélectionnée{props.selectedTransforms.length > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => props.onApply(false)}
            disabled={props.isApplying}
            className="ui-btn ui-focusable text-xs"
          >
            <Eye className="w-3.5 h-3.5" /> Aperçu
          </button>
          <button
            onClick={() => props.onApply(true)}
            disabled={props.isApplying}
            className="ui-btn ui-btn-primary ui-focusable text-xs"
          >
            <Play className="w-3.5 h-3.5" /> Appliquer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {props.selectedTransforms.map((t, i) => {
          const info = props.catalog.find(c => c.key === t.transform);
          return (
            <button
              key={i}
              type="button"
              onClick={() => props.onToggleSelected(t.column, t.transform)}
              className="ui-tag ui-tag-accent cursor-pointer"
            >
              <span className="font-semibold">{t.column}</span>
              <ArrowRight className="w-2.5 h-2.5" />
              <span>{info?.label || t.transform}</span>
              <span className="ml-0.5 ui-t-danger">×</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AppliedLogsView(props: { logs: any[]; onClose: () => void }) {
  return (
    <section className="ui-panel overflow-hidden" style={{ borderColor: 'var(--ui-success)' }}>
      <header className="ui-panel-header">
        <span style={{ color: 'var(--ui-success)' }}>Résultats de l&apos;application</span>
        <button onClick={props.onClose} className="ui-btn ui-btn-ghost text-xs">
          Fermer
        </button>
      </header>
      <div className="p-2.5 space-y-1.5">
        {props.logs.map((log: any, i: number) => (
          <div key={i} className="ui-panel p-2 text-xs" style={{ background: 'var(--ui-bg-sunken)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="ui-mono font-semibold" style={{ color: 'var(--ui-text)' }}>{log.column}</span>
              <span className={log.success ? 'ui-tag ui-tag-ok' : 'ui-tag ui-tag-danger'}>
                {log.success ? 'Succès' : 'Échec'}
              </span>
            </div>
            {log.success && log.before && log.after && (
              <div className="mt-1.5 grid grid-cols-2 gap-3 text-[11px] ui-num ui-t-muted">
                <div>
                  Avant : skew={formatStatNumber(log.before.skewness)} · μ={formatStatNumber(log.before.mean)} · σ={formatStatNumber(log.before.std)}
                </div>
                <div>
                  Après : skew={formatStatNumber(log.after.skewness)} · μ={formatStatNumber(log.after.mean)} · σ={formatStatNumber(log.after.std)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
