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
} from '../../store/api';
import type { DatasetVersion, AnalysisHistoryEntry, AuditLogEntry } from '../../types';

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
    { key: 'history', label: 'Analyses', icon: <Activity size={14} />, count: history?.length },
    { key: 'versions', label: 'Versions', icon: <GitBranch size={14} />, count: versions?.length },
    { key: 'audit', label: 'Audit', icon: <FileText size={14} />, count: audit?.length },
  ];

  return (
    <div className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Clock size={14} style={{ color: 'var(--ui-accent)' }} />
          Historique &amp; traçabilité
        </span>
      </header>

      <div className="p-3 space-y-3">
        <div
          className="flex gap-1 p-1 rounded-[var(--ui-radius-sm)]"
          style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
        >
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`ui-btn flex-1 justify-center text-xs ${tab === t.key ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              {t.icon}
              {t.label}
              {t.count != null && <span className="ui-tag ui-num">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="max-h-[500px] overflow-y-auto ui-scroll">
          {tab === 'history' && (
            <HistoryTab entries={history ?? []} expandedId={expandedId} onToggle={setExpandedId} />
          )}
          {tab === 'versions' && (
            <VersionsTab
              versions={versions ?? []}
              onRestore={v => restoreVersion({ id: datasetId, versionNumber: v })}
              restoring={restoring}
            />
          )}
          {tab === 'audit' && <AuditTab entries={audit ?? []} />}
        </div>
      </div>
    </div>
  );
}

function HistoryTab(props: {
  entries: AnalysisHistoryEntry[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
}) {
  if (props.entries.length === 0) return <EmptyState message="Aucune analyse exécutée." />;

  return (
    <div className="space-y-1.5">
      {props.entries.map(e => {
        const expanded = props.expandedId === e.id;
        return (
          <div key={e.id} className="ui-panel overflow-hidden">
            <button
              onClick={() => props.onToggle(expanded ? null : e.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.02]"
            >
              <StatusIcon status={e.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--ui-text)' }}>
                  {ANALYSIS_LABELS[e.analysis_type] ?? e.analysis_type}
                </p>
                <p className="text-[11px] ui-t-muted ui-num">
                  {formatDate(e.created_at)}
                  {e.duration_ms != null && ` · ${formatDuration(e.duration_ms)}`}
                  {` · v${e.dataset_version}`}
                </p>
              </div>
              {expanded ? <ChevronDown size={14} className="ui-t-faint" /> : <ChevronRight size={14} className="ui-t-faint" />}
            </button>
            {expanded && (
              <div className="px-3 pb-2.5 pt-2 space-y-2" style={{ borderTop: '1px solid var(--ui-border)' }}>
                {e.parameters && Object.keys(e.parameters).length > 0 && (
                  <pre className="text-[11px] p-2 rounded-[var(--ui-radius-sm)] overflow-x-auto ui-mono" style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}>
                    {JSON.stringify(e.parameters, null, 2)}
                  </pre>
                )}
                {e.result_summary && (
                  <pre className="text-[11px] p-2 rounded-[var(--ui-radius-sm)] overflow-x-auto ui-mono" style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}>
                    {JSON.stringify(e.result_summary, null, 2)}
                  </pre>
                )}
                {e.error_message && <p className="text-xs ui-t-danger">{e.error_message}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VersionsTab(props: {
  versions: DatasetVersion[];
  onRestore: (vn: number) => void;
  restoring: boolean;
}) {
  if (props.versions.length === 0) return <EmptyState message="Aucune version disponible." />;

  return (
    <div className="space-y-1.5">
      {[...props.versions].reverse().map((v, i) => (
        <div
          key={v.id}
          className="ui-panel flex items-center gap-3 px-3 py-2"
          style={i === 0 ? { borderColor: 'var(--ui-accent)', background: 'var(--ui-accent-soft)' } : undefined}
        >
          <span className="ui-tag ui-tag-accent ui-num shrink-0 font-bold">v{v.version_number}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
              {v.label === 'raw' ? 'Données brutes'
                : v.label === 'cleaned' ? 'Nettoyé'
                : v.label === 'transformed' ? 'Transformé'
                : v.label === 'restored' ? 'Restauré'
                : v.label}
              {i === 0 && <span className="ml-1.5 ui-t-accent">(actuelle)</span>}
            </p>
            <p className="text-[11px] ui-t-muted ui-num">
              {v.rows.toLocaleString('fr-FR')} × {v.columns} · {formatDate(v.created_at)}
            </p>
            {v.description && <p className="text-[11px] ui-t-faint mt-0.5">{v.description}</p>}
          </div>
          {i > 0 && (
            <button
              onClick={() => props.onRestore(v.version_number)}
              disabled={props.restoring}
              className="ui-btn ui-focusable text-xs shrink-0"
            >
              {props.restoring ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Restaurer
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditTab({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) return <EmptyState message="Aucune action enregistrée." />;

  return (
    <div className="space-y-1.5">
      {entries.map(e => (
        <div key={e.id} className="ui-panel px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
              {ACTION_LABELS[e.action] ?? e.action}
            </span>
            {e.version_before != null && e.version_after != null && (
              <span className="ui-tag ui-num">v{e.version_before} → v{e.version_after}</span>
            )}
            <span className="ml-auto text-[11px] ui-t-muted ui-num">{formatDate(e.created_at)}</span>
          </div>
          {e.parameters && Object.keys(e.parameters).length > 0 && (
            <div className="mt-1 text-[11px] ui-t-muted flex flex-wrap gap-x-3 gap-y-0.5">
              {Object.entries(e.parameters).map(([k, v]) => (
                <span key={k}>
                  <span className="ui-t-faint">{k}:</span>{' '}
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 size={15} className="shrink-0" style={{ color: 'var(--ui-success)' }} />;
  if (status === 'failed') return <XCircle size={15} className="shrink-0" style={{ color: 'var(--ui-danger)' }} />;
  return <Loader2 size={15} className="animate-spin shrink-0" style={{ color: 'var(--ui-accent)' }} />;
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-6 ui-t-muted text-xs">{message}</div>;
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
