import { useState } from 'react';
import {
  Clock, RotateCcw, FileText, GitBranch, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Loader2, Activity,
} from 'lucide-react';
import {
  useGetDatasetVersionsQuery,
  useGetAnalysisHistoryQuery,
  useGetAuditTrailQuery,
  useRestoreVersionMutation,
} from '../store/api';
import type { DatasetVersion, AnalysisHistoryEntry, AuditLogEntry } from '../types';

interface Props {
  datasetId: string;
}

type Tab = 'history' | 'versions' | 'audit';

const ANALYSIS_LABELS: Record<string, string> = {
  descriptive: 'Analyse descriptive',
  correlation: 'Corrélations',
  test: "Test d'hypothèse",
  modeling: 'Modélisation',
  timeseries: 'Série temporelle',
  multivariate_ts: 'Série temporelle multivariée',
  pca: 'ACP',
  ca: 'AFC',
  mca: 'ACM',
  transforms: 'Transformations',
  report: 'Rapport',
};

const ACTION_LABELS: Record<string, string> = {
  upload: 'Import',
  clean: 'Nettoyage',
  transform: 'Transformation',
  analyze: 'Analyse',
  train: 'Entraînement',
  type_change: 'Changement de type',
  exclude_columns: 'Exclusion de colonnes',
  report: 'Rapport',
  restore: 'Restauration',
};

export default function HistoryPanel({ datasetId }: Props) {
  const [tab, setTab] = useState<Tab>('history');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: versions } = useGetDatasetVersionsQuery(datasetId);
  const { data: history } = useGetAnalysisHistoryQuery({ id: datasetId });
  const { data: audit } = useGetAuditTrailQuery({ id: datasetId });
  const [restoreVersion, { isLoading: restoring }] = useRestoreVersionMutation();

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'history', label: 'Analyses', icon: <Activity size={16} />, count: history?.length },
    { key: 'versions', label: 'Versions', icon: <GitBranch size={16} />, count: versions?.length },
    { key: 'audit', label: 'Audit', icon: <FileText size={16} />, count: audit?.length },
  ];

  return (
    <div className="card shadow-sm border border-white/5 !p-6">
      <h3 className="text-lg font-semibold text-strong mb-4 flex items-center gap-2">
        <Clock size={20} className="text-accent-400" />
        Historique & Traçabilité
      </h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-white/[0.02] border border-white/5 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-accent-500/10 text-accent-300 shadow-sm border border-accent-500/20'
                : 'text-muted hover:text-default'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className="ml-1 bg-white/10 text-default text-xs px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {tab === 'history' && (
          <HistoryTab entries={history ?? []} expandedId={expandedId} onToggle={setExpandedId} />
        )}
        {tab === 'versions' && (
          <VersionsTab
            versions={versions ?? []}
            onRestore={(v) => restoreVersion({ id: datasetId, versionNumber: v })}
            restoring={restoring}
          />
        )}
        {tab === 'audit' && <AuditTab entries={audit ?? []} />}
      </div>
    </div>
  );
}

function HistoryTab({
  entries, expandedId, onToggle,
}: {
  entries: AnalysisHistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (entries.length === 0) {
    return <EmptyState message="Aucune analyse exécutée." />;
  }

  return (
    <div className="space-y-2">
      {entries.map(e => {
        const expanded = expandedId === e.id;
        return (
          <div key={e.id} className="border border-white/5 rounded-lg overflow-hidden bg-white/[0.01]">
            <button
              onClick={() => onToggle(expanded ? null : e.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] text-left"
            >
              <StatusIcon status={e.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-strong truncate">
                  {ANALYSIS_LABELS[e.analysis_type] ?? e.analysis_type}
                </p>
                <p className="text-xs text-muted">
                  {formatDate(e.created_at)}
                  {e.duration_ms != null && ` · ${formatDuration(e.duration_ms)}`}
                  {` · v${e.dataset_version}`}
                </p>
              </div>
              {expanded ? <ChevronDown size={16} className="text-faint" /> : <ChevronRight size={16} className="text-faint" />}
            </button>
            {expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
                {e.parameters && Object.keys(e.parameters).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted mb-1">Paramètres</p>
                    <pre className="text-xs bg-white/[0.02] border border-white/5 text-default p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.parameters, null, 2)}
                    </pre>
                  </div>
                )}
                {e.result_summary && (
                  <div>
                    <p className="text-xs font-medium text-muted mb-1">Résumé</p>
                    <pre className="text-xs bg-white/[0.02] border border-white/5 text-default p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.result_summary, null, 2)}
                    </pre>
                  </div>
                )}
                {e.error_message && (
                  <p className="text-xs text-red-500 mt-1">{e.error_message}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VersionsTab({
  versions, onRestore, restoring,
}: {
  versions: DatasetVersion[];
  onRestore: (vn: number) => void;
  restoring: boolean;
}) {
  if (versions.length === 0) {
    return <EmptyState message="Aucune version disponible." />;
  }

  return (
    <div className="space-y-2">
      {[...versions].reverse().map((v, i) => (
        <div
          key={v.id}
          className={`flex items-center gap-3 p-3 rounded-lg border ${
            i === 0 ? 'border-accent-500/30 bg-accent-500/5' : 'border-white/5 bg-white/[0.01]'
          }`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/10 text-accent-400 flex items-center justify-center text-sm font-bold border border-accent-500/20">
            {v.version_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-strong">
              {v.label === 'raw' ? 'Données brutes' :
               v.label === 'cleaned' ? 'Nettoyé' :
               v.label === 'transformed' ? 'Transformé' :
               v.label === 'restored' ? 'Restauré' : v.label}
              {i === 0 && <span className="ml-2 text-xs text-accent-400">(actuelle)</span>}
            </p>
            <p className="text-xs text-muted">
              {v.rows} × {v.columns} · {formatDate(v.created_at)}
            </p>
            {v.description && <p className="text-xs text-faint mt-0.5">{v.description}</p>}
          </div>
          {i > 0 && (
            <button
              onClick={() => onRestore(v.version_number)}
              disabled={restoring}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-accent-300 bg-accent-500/10 hover:bg-accent-500/20 rounded-md transition-colors disabled:opacity-50 border border-accent-500/20"
            >
              {restoring ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Restaurer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditTab({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="Aucune action enregistrée." />;
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/10" />
      <div className="space-y-3">
        {entries.map(e => (
          <div key={e.id} className="relative">
            <div className="absolute -left-[14px] top-1.5 w-2.5 h-2.5 rounded-full bg-accent-500 border-2 border-surface-950" />
            <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-strong">
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                {e.version_before != null && e.version_after != null && (
                  <span className="text-xs text-muted">
                    v{e.version_before} → v{e.version_after}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">{formatDate(e.created_at)}</p>
              {e.parameters && Object.keys(e.parameters).length > 0 && (
                <div className="mt-1.5 text-xs text-muted">
                  {Object.entries(e.parameters).map(([k, v]) => (
                    <span key={k} className="inline-block mr-3">
                      <span className="text-faint">{k}:</span>{' '}
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />;
  if (status === 'failed') return <XCircle size={18} className="text-red-500 flex-shrink-0" />;
  return <Loader2 size={18} className="text-blue-500 animate-spin flex-shrink-0" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-muted text-sm">{message}</div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
