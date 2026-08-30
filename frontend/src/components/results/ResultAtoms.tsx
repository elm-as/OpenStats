import React from 'react';
import { BarChart3, Info } from 'lucide-react';

export function StatCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: typeof BarChart3;
  label: string;
  value: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-lg p-3 border border-white/10`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${color} mb-1`}>
        <Icon className="w-3 h-3" />
        <span className="font-semibold">{label}</span>
      </div>
      <div className="text-lg font-semibold text-surface-50">{value}</div>
    </div>
  );
}

export function StepStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
    skipped: 'bg-surface-500/20 text-surface-300 border-gray-500/30',
    running: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse',
  };
  const labels: Record<string, string> = {
    success: 'Réussi',
    error: 'Erreur',
    skipped: 'Ignoré',
    running: 'En cours',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.skipped}`}>
      {labels[status] || status}
    </span>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: typeof Info }) {
  const DefaultIcon = Icon || Info;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-surface-400">
      <DefaultIcon className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function MetricBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80 mt-1">{label}</div>
    </div>
  );
}

export function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null) return '—';
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(2) + 'k';
  if (Math.abs(val) >= 1) return val.toFixed(2);
  if (val === 0) return '0';
  return val.toExponential(2);
}

export function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    numeric: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    categorical: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    datetime: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    boolean: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[type] || colors.numeric}`}>
      {type}
    </span>
  );
}
