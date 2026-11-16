import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Database, Upload, Trash2, Compass, Workflow, Sliders, Network,
  FileSpreadsheet, Loader2,
} from 'lucide-react';
import { useDeleteDatasetMutation, useGetDatasetQuery } from '../store/api';
import { useWorkspace } from '../components/shell/useWorkspace';
import { useStatus } from '../components/shell/StatusBar';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';
import VariableDockList from '../components/dataset/VariableDockList';
import SpreadsheetWorkbench from '../components/dataset/SpreadsheetWorkbench';
import FileUpload from '../components/dataset/FileUpload';
import type { DatasetSummary } from '../types';

/**
 * Poste de travail Données & Variables (ergonomie logiciel statistique de bureau).
 * Combine l'explorateur de session, la liste typée des variables et la grille tableur en direct.
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const { datasets, active, activeId, isLoading, selectDataset } = useWorkspace();
  const [deleteDataset, { isLoading: isDeleting }] = useDeleteDatasetMutation();
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const { setStatus } = useStatus();
  const toast = useToast();

  const { data: datasetDetail, isFetching: isDetailFetching } = useGetDatasetQuery(activeId!, {
    skip: !activeId,
  });

  useEffect(() => {
    setSelectedColumn(null);
  }, [activeId]);

  useEffect(() => {
    if (!active) {
      setStatus({ busy: false, message: 'Aucune session active', items: [] });
      return;
    }
    const colsCount = datasetDetail?.profile?.dictionary?.length ?? active.shape.columns;
    setStatus({
      busy: isDetailFetching,
      message: 'Tableur DuckDB / Parquet prêt',
      items: [
        { id: 'vars', label: `${colsCount} variables`, tone: 'accent' },
        ...(datasetDetail?.profile?.memory_usage_mb != null
          ? [{ id: 'ram', label: `${datasetDetail.profile.memory_usage_mb.toFixed(1)} Mo`, tone: 'neutral' as const }]
          : []),
      ],
    });
  }, [active, datasetDetail, isDetailFetching, setStatus]);

  const handleDelete = async (datasetId: string, datasetName: string) => {
    const confirmed = window.confirm(`Supprimer définitivement le dataset « ${datasetName} » ?`);
    if (!confirmed) return;
    try {
      await deleteDataset(datasetId).unwrap();
      toast.success({ title: 'Dataset supprimé', description: `« ${datasetName} » retiré de la session locale.` });
    } catch (error) {
      toast.error({ title: 'Suppression impossible', description: extractErrorMessage(error) });
    }
  };

  const dictionary = datasetDetail?.profile?.dictionary ?? [];

  return (
    <div className="h-full flex min-h-0 overflow-hidden">
      {/* ── Dock latéral gauche : Jeux de données + Liste des Variables (type Jamovi) ── */}
      <aside
        className="hidden md:flex w-[276px] shrink-0 flex-col min-h-0"
        style={{ background: 'var(--ui-bg-panel)', borderRight: '1px solid var(--ui-border)' }}
        aria-label="Inspecteur de session et variables"
      >
        <DatasetSessionList
          datasets={datasets}
          activeId={activeId}
          isLoading={isLoading}
          isDeleting={isDeleting}
          onSelect={selectDataset}
          onDelete={handleDelete}
        />

        {active && (
          <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: '1px solid var(--ui-border)' }}>
            <VariableDockList
              columns={dictionary}
              selectedColumn={selectedColumn}
              onSelectColumn={col => setSelectedColumn(col || null)}
            />
          </div>
        )}
      </aside>

      {/* ── Zone principale : Tableur en direct ou ouverture de fichier ── */}
      <section className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 ui-t-muted">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ui-accent)' }} />
            <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Chargement des données locales…</span>
          </div>
        ) : active ? (
          <>
            <ActiveDatasetToolbar
              active={active}
              sheetName={datasetDetail?.profile?.selected_sheet}
              memoryMb={datasetDetail?.profile?.memory_usage_mb}
              onNavigate={path => navigate(`${path}${path.includes('?') ? '&' : '?'}dataset=${encodeURIComponent(active.id)}`)}
            />
            <SpreadsheetWorkbench
              datasetId={active.id}
              dictionary={dictionary}
              selectedColumn={selectedColumn}
              onSelectColumn={col => setSelectedColumn(col || null)}
            />
          </>
        ) : (
          <div className="flex-1 overflow-y-auto ui-scroll p-6 flex flex-col">
            <div className="max-w-2xl w-full mx-auto my-auto">
              <FileUpload onUploaded={id => navigate(`/workflow/${id}/profile`)} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DatasetSessionList({
  datasets, activeId, isLoading, isDeleting, onSelect, onDelete,
}: {
  datasets: DatasetSummary[];
  activeId: string | null;
  isLoading: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col max-h-[42%] shrink-0">
      <div
        className="px-2.5 flex items-center justify-between shrink-0"
        style={{ height: 30, borderBottom: '1px solid var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
      >
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3" style={{ color: 'var(--ui-accent)' }} />
          <span className="ui-label">Jeux de données</span>
          <span className="ui-tag ui-tag-neutral ui-num">{datasets.length}</span>
        </div>
        <Link to="/workflow" className="text-[11px] font-bold ui-t-accent hover:underline flex items-center gap-1">
          <Upload className="w-3 h-3" /> Ouvrir
        </Link>
      </div>

      <ul className="overflow-y-auto ui-scroll p-1 space-y-0.5">
        {isLoading && (
          <li className="px-2 py-3 text-center ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
            Lecture du catalogue…
          </li>
        )}

        {!isLoading && datasets.length === 0 && (
          <li className="px-2 py-4 text-center ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
            Aucun jeu chargé en mémoire
          </li>
        )}

        {datasets.map(ds => {
          const isCurrent = ds.id === activeId;
          return (
            <li key={ds.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(ds.id)}
                className="ui-focusable flex-1 min-w-0 flex items-center gap-2 px-2 rounded-[var(--ui-radius-sm)] text-left"
                style={{
                  height: 28,
                  background: isCurrent ? 'var(--ui-accent-soft)' : 'transparent',
                  color: isCurrent ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                  borderLeft: isCurrent ? '2px solid var(--ui-accent)' : '2px solid transparent',
                }}
              >
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: isCurrent ? 700 : 500 }}>
                  {ds.name}
                </span>
                <span className="ui-mono ui-num shrink-0" style={{ fontSize: 10, color: 'var(--ui-text-faint)' }}>
                  {ds.shape.rows.toLocaleString('fr-FR')}×{ds.shape.columns}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(ds.id, ds.name)}
                disabled={isDeleting}
                className="opacity-0 group-hover:opacity-100 p-1 rounded ui-t-faint hover:text-[var(--ui-danger)] transition-opacity ui-focusable"
                title={`Supprimer ${ds.name}`}
                aria-label={`Supprimer ${ds.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActiveDatasetToolbar({
  active, sheetName, memoryMb, onNavigate,
}: {
  active: DatasetSummary;
  sheetName?: string;
  memoryMb?: number;
  onNavigate: (path: string) => void;
}) {
  return (
    <div
      className="px-3 flex items-center justify-between gap-2 shrink-0 overflow-x-auto no-scrollbar"
      style={{
        height: 36,
        background: 'var(--ui-bg-panel)',
        borderBottom: '1px solid var(--ui-border)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold truncate ui-t" style={{ fontSize: 'var(--ui-fs-base)' }} title={active.name}>
          {active.name}
        </span>
        <span className="ui-tag ui-tag-neutral ui-num shrink-0">
          {active.shape.rows.toLocaleString('fr-FR')} × {active.shape.columns}
        </span>
        {sheetName && (
          <span className="ui-tag ui-tag-accent shrink-0">{sheetName}</span>
        )}
        {memoryMb != null && (
          <span className="hidden lg:inline-flex ui-tag ui-tag-neutral ui-num shrink-0">
            {memoryMb.toFixed(1)} Mo
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onNavigate(`/workflow/${active.id}/profile`)}
          className="ui-btn ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
        >
          <FileSpreadsheet className="w-3 h-3" /> Typage
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/explorer')}
          className="ui-btn ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
        >
          <Compass className="w-3 h-3 ui-t-accent" /> Explorer
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/analyzer')}
          className="ui-btn ui-btn-primary ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
        >
          <Workflow className="w-3 h-3" /> Méthodologie
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/analyzer?tab=studio')}
          className="ui-btn ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
        >
          <Sliders className="w-3 h-3 ui-t-warning" /> Tests &amp; Séries
        </button>
        <button
          type="button"
          onClick={() => onNavigate('/canvas')}
          className="ui-btn ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
        >
          <Network className="w-3 h-3 text-[var(--ui-info)]" /> Canvas
        </button>
      </div>
    </div>
  );
}
