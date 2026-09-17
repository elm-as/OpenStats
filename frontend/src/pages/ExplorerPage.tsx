import { Database, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import ExplorerPanel from '../components/explorer/ExplorerPanel';
import { useWorkspace } from '../components/shell/useWorkspace';

/**
 * Écran Explorateur.
 *
 * Le dataset actif vient du châssis (barre de contexte) : cette page ne
 * propose plus son propre sélecteur.
 */
export default function ExplorerPage() {
  const { active, isLoading, datasets } = useWorkspace();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div
          className="w-5 h-5 rounded-full animate-spin"
          style={{ border: '2px solid var(--ui-border)', borderTopColor: 'var(--ui-accent)' }}
        />
      </div>
    );
  }

  if (datasets.length === 0 || !active) {
    return (
      <div
        className="ui-panel flex flex-col items-center justify-center text-center"
        style={{ minHeight: '46vh', padding: 'var(--ui-gap-5)' }}
      >
        <Database className="w-8 h-8 mb-3" style={{ color: 'var(--ui-text-faint)' }} />
        <p style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700, marginBottom: 4 }}>
          Aucun dataset à explorer
        </p>
        <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)', marginBottom: 16 }}>
          Importez un fichier CSV, XLSX ou JSON pour commencer.
        </p>
        <Link to="/workflow" className="ui-btn ui-btn-primary ui-focusable">
          <Upload className="w-3.5 h-3.5" />
          Importer un dataset
        </Link>
      </div>
    );
  }

  return <ExplorerPanel key={active.id} datasetId={active.id} datasetName={active.name} />;
}
