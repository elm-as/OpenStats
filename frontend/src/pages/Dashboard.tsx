import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useDeleteDatasetMutation, useGetDatasetQuery } from '../store/api';
import { useWorkspace } from '../components/shell/useWorkspace';
import { useStatus } from '../components/shell/StatusBar';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';
import DatasetSessionList from '../components/dataset/DatasetSessionList';
import VariableDockList from '../components/dataset/VariableDockList';
import SpreadsheetWorkbench from '../components/dataset/SpreadsheetWorkbench';
import FileUpload from '../components/dataset/FileUpload';

/**
 * Poste de travail Données & Variables (ergonomie logiciel statistique de bureau).
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
  const sheetName = datasetDetail?.profile?.selected_sheet;
  const memoryMb = datasetDetail?.profile?.memory_usage_mb;

  return (
    <div className="h-full flex min-h-0 overflow-hidden">
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

      <section className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center gap-2 ui-t-muted">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ui-accent)' }} />
            <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Chargement des données locales…</span>
          </div>
        ) : active ? (
          <>
            <div
              className="px-3 flex items-center gap-2 shrink-0"
              style={{
                height: 32,
                background: 'var(--ui-bg-panel)',
                borderBottom: '1px solid var(--ui-border)',
              }}
            >
              <span className="font-semibold truncate ui-t" style={{ fontSize: 'var(--ui-fs-sm)' }} title={active.name}>
                {active.name}
              </span>
              <span className="ui-tag ui-tag-neutral ui-num shrink-0">
                {active.shape.rows.toLocaleString('fr-FR')} × {active.shape.columns}
              </span>
              {sheetName && <span className="ui-tag ui-tag-accent shrink-0">{sheetName}</span>}
              {memoryMb != null && (
                <span className="ui-tag ui-tag-neutral ui-num shrink-0">{memoryMb.toFixed(1)} Mo</span>
              )}
            </div>
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
