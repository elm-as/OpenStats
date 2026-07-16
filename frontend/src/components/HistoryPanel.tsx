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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock size={20} className="text-blue-600" />
        Historique & Traçabilité
      </h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-50 rounded-lg p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className="ml-1 bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
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
          <div key={e.id} className="border border-gray-100 rounded-lg overflow-hidden">
            <button
              onClick={() => onToggle(expanded ? null : e.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
            >
              <StatusIcon status={e.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {ANALYSIS_LABELS[e.analysis_type] ?? e.analysis_type}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(e.created_at)}
                  {e.duration_ms != null && ` · ${formatDuration(e.duration_ms)}`}
                  {` · v${e.dataset_version}`}
                </p>
              </div>
              {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </button>
            {expanded && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-50">
                {e.parameters && Object.keys(e.parameters).length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-500 mb-1">Paramètres</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.parameters, null, 2)}
                    </pre>
                  </div>
                )}
                {e.result_summary && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Résumé</p>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.result_summary, null, 2)}
                    </pre>
                  </div>
                )}
                {e.error_message && (
                  <p className="text-xs text-red-600 mt-1">{e.error_message}</p>
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
            i === 0 ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100'
          }`}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
            {v.version_number}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">
              {v.label === 'raw' ? 'Données brutes' :
               v.label === 'cleaned' ? 'Nettoyé' :
               v.label === 'transformed' ? 'Transformé' :
               v.label === 'restored' ? 'Restauré' : v.label}
              {i === 0 && <span className="ml-2 text-xs text-blue-600">(actuelle)</span>}
            </p>
            <p className="text-xs text-gray-500">
              {v.rows} × {v.columns} · {formatDate(v.created_at)}
            </p>
            {v.description && <p className="text-xs text-gray-400 mt-0.5">{v.description}</p>}
          </div>
          {i > 0 && (
            <button
              onClick={() => onRestore(v.version_number)}
              disabled={restoring}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors disabled:opacity-50"
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
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gray-200" />
      <div className="space-y-3">
        {entries.map(e => (
          <div key={e.id} className="relative">
            <div className="absolute -left-[14px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {ACTION_LABELS[e.action] ?? e.action}
                </span>
                {e.version_before != null && e.version_after != null && (
                  <span className="text-xs text-gray-400">
                    v{e.version_before} → v{e.version_after}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(e.created_at)}</p>
              {e.parameters && Object.keys(e.parameters).length > 0 && (
                <div className="mt-1.5 text-xs text-gray-600">
                  {Object.entries(e.parameters).map(([k, v]) => (
                    <span key={k} className="inline-block mr-3">
                      <span className="text-gray-400">{k}:</span>{' '}
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
    <div className="text-center py-8 text-gray-400 text-sm">{message}</div>
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
