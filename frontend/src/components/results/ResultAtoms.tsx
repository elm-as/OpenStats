import React from 'react';
import { BarChart3, Info } from 'lucide-react';

function resolveStatValueColor(color?: string): string {
  if (!color) return 'var(--ui-text)';
  if (color.includes('emerald') || color.includes('green') || color.includes('success')) return 'var(--ui-success)';
  if (color.includes('red') || color.includes('rose') || color.includes('danger')) return 'var(--ui-danger)';
  if (color.includes('amber') || color.includes('yellow') || color.includes('warning')) return 'var(--ui-warning)';
  if (color.includes('cyan') || color.includes('blue') || color.includes('info')) return 'var(--ui-info)';
  return 'var(--ui-text)';
}

export function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg: _bg,
}: {
  icon: typeof BarChart3;
  label: string;
  value: React.ReactNode;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="ui-panel px-3 py-2 flex items-start gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ui-text-faint)' }} />
      <div className="min-w-0 flex-1">
        <div className="ui-label truncate">{label}</div>
        <div className="ui-num text-sm font-bold truncate" style={{ color: resolveStatValueColor(color) }}>
          {value}
        </div>
      </div>
    </div>
  );
}

const SUMMARY_TONE: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
  success: 'var(--ui-success)',
  warning: 'var(--ui-warning)',
  danger: 'var(--ui-danger)',
  neutral: 'var(--ui-text)',
};

export function SummaryCell({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
}) {
  return (
    <div className="ui-panel px-3 py-2 min-w-0">
      <div className="ui-label truncate">{label}</div>
      <div className="ui-num text-sm font-bold truncate" style={{ color: SUMMARY_TONE[tone] }}>
        {value}
      </div>
      {hint && <div className="ui-t-faint text-[11px] truncate">{hint}</div>}
    </div>
  );
}

export function StepStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'ui-tag ui-tag-success',
    error: 'ui-tag ui-tag-danger',
    skipped: 'ui-tag ui-tag-neutral',
    running: 'ui-tag ui-tag-info',
  };
  const labels: Record<string, string> = {
    success: 'Réussi',
    error: 'Erreur',
    skipped: 'Ignoré',
    running: 'En cours',
  };
  return (
    <span className={styles[status] || styles.skipped}>
      {labels[status] || status}
    </span>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: typeof Info }) {
  const DefaultIcon = Icon || Info;
  return (
    <div className="flex flex-col items-center justify-center py-8 ui-t-muted">
      <DefaultIcon className="w-6 h-6 mb-2 opacity-60" />
      <p className="text-xs">{message}</p>
    </div>
  );
}

const METRIC_TONE: Record<string, string> = {
  blue: 'var(--ui-info)',
  amber: 'var(--ui-warning)',
  emerald: 'var(--ui-success)',
  purple: 'var(--ui-accent-text)',
};

export function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="ui-panel px-3 py-2">
      <div className="ui-label truncate">{label}</div>
      <div
        className="ui-num text-base font-bold mt-0.5"
        style={{ color: (color && METRIC_TONE[color]) || 'var(--ui-text)' }}
      >
        {value}
      </div>
    </div>
  );
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null || !Number.isFinite(val)) return '—';
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(2) + 'k';
  if (Math.abs(val) >= 1) return val.toFixed(2);
  if (val === 0) return '0';
  return val.toExponential(2);
}

export function TypeBadge({ type }: { type: string }) {
  const tags: Record<string, string> = {
    numeric: 'ui-tag ui-tag-info',
    categorical: 'ui-tag ui-tag-accent',
    datetime: 'ui-tag ui-tag-warning',
    boolean: 'ui-tag ui-tag-success',
  };
  return (
    <span className={tags[type] || 'ui-tag ui-tag-neutral'}>
      {type}
    </span>
  );
}
