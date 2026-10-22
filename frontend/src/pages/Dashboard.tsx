import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDeleteDatasetMutation, useListDatasetsQuery } from '../store/api';
import {
  Upload, Database, Clock, ArrowRight, Sigma, Trash2,
  Compass, Workflow, Network, Cpu, ShieldCheck, Layers, FileCode2,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';

interface DatasetItem {
  id: string;
  name: string;
  created_at: string;
  shape?: { rows: number; columns: number };
  versions_count?: number;
  file_size?: number;
}

export default function Dashboard() {
  const { data: result, isLoading } = useListDatasetsQuery();
  const datasets: DatasetItem[] = result?.datasets ?? [];
  const [deleteDataset, { isLoading: isDeleting }] = useDeleteDatasetMutation();
  const navigate = useNavigate();
  const toast = useToast();

  const totalRows = useMemo(
    () => datasets.reduce((acc, d) => acc + (d.shape?.rows ?? 0), 0),
    [datasets],
  );
  const totalCols = useMemo(
    () => datasets.reduce((acc, d) => acc + (d.shape?.columns ?? 0), 0),
    [datasets],
  );

  const handleDelete = async (datasetId: string, datasetName: string) => {
    const confirmed = window.confirm(`Supprimer définitivement le dataset "${datasetName}" ?`);
    if (!confirmed) return;
    try {
      await deleteDataset(datasetId).unwrap();
      toast.success({ title: 'Dataset supprimé', description: `"${datasetName}" a été retiré de la mémoire locale.` });
    } catch (error) {
      toast.error({ title: 'Suppression impossible', description: extractErrorMessage(error) });
    }
  };

  return (
    <div className="flex flex-col space-y-5 animate-fade-in">
      {/* ── Console Header (En-tête Station) ── */}
      <header className="ui-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="ui-tag ui-tag-success">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Moteur Local Actif
            </span>
            <span className="ui-tag ui-tag-neutral">DuckDB 1.0</span>
            <span className="ui-tag ui-tag-accent">Zero Lock-in</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            Console d'Ingénierie Statistique
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Exploration heuristique, diagnostics méthodiques en 11 étapes et modélisation nodale sans dépendance cloud.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/workflow" className="ui-btn ui-btn-primary ui-focusable">
            <Upload className="w-3.5 h-3.5" />
            Importer des données
          </Link>
          <Link to="/canvas" className="ui-btn ui-focusable">
            <Network className="w-3.5 h-3.5" />
            Nouveau Canvas
          </Link>
          <Link to="/docs" className="ui-btn ui-btn-ghost ui-focusable text-xs">
            Documentation
          </Link>
        </div>
      </header>

      {/* ── Télémétrie Système (4 Indicateurs clés) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="ui-panel p-3">
          <div className="flex items-center justify-between text-muted text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Jeux de données</span>
            <Database className="w-3.5 h-3.5 text-accent-400" />
          </div>
          <div className="text-xl font-bold text-white ui-num">
            {datasets.length}
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">Disponibles en session</div>
        </div>

        <div className="ui-panel p-3">
          <div className="flex items-center justify-between text-muted text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Enregistrements</span>
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white ui-num">
            {totalRows.toLocaleString()}
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">Lignes indexées DuckDB</div>
        </div>

        <div className="ui-panel p-3">
          <div className="flex items-center justify-between text-muted text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Dimensions</span>
            <Sigma className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white ui-num">
            {totalCols}
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">Variables réparties</div>
        </div>

        <div className="ui-panel p-3">
          <div className="flex items-center justify-between text-muted text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>Rigueur Statistique</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-white mt-1">
            FDR Benjamini-H.
          </div>
          <div className="text-[10.5px] text-muted mt-0.5">Contrôle des faux positifs</div>
        </div>
      </div>

      {/* ── Les 3 Piliers d'Analyse (Portails d'Action) ── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Piliers d'Analyse & Modélisation
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Pilier 1 : Explorateur */}
          <div className="ui-panel p-4 flex flex-col justify-between hover:border-accent-400/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="ui-tag ui-tag-accent">Découverte Adaptative</span>
                <Compass className="w-4 h-4 text-accent-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Explorateur de Données</h3>
              <p className="text-xs text-muted leading-relaxed mb-4">
                Sondes heuristiques automatisées, information mutuelle non-linéaire et contrôle strict du taux de fausses découvertes (FDR).
              </p>
            </div>
            <Link
              to="/explorer"
              className="text-xs font-semibold text-accent-400 hover:text-accent-300 flex items-center gap-1 mt-auto"
            >
              Lancer l'exploration <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Pilier 2 : Analyse Méthodique */}
          <div className="ui-panel p-4 flex flex-col justify-between hover:border-emerald-400/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="ui-tag ui-tag-success">Processus en 11 Étapes</span>
                <Workflow className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Analyse Méthodique</h3>
              <p className="text-xs text-muted leading-relaxed mb-4">
                Cadrage, audit qualité, remédiations statistiques validées et benchmark prédictif contre références naïves.
              </p>
            </div>
            <Link
              to="/analyzer"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-auto"
            >
              Démarrer le diagnostic <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Pilier 3 : Canvas Nodal */}
          <div className="ui-panel p-4 flex flex-col justify-between hover:border-blue-400/40 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="ui-tag ui-tag-info">Studio Nodal</span>
                <Network className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Canvas Nodal Interactif</h3>
              <p className="text-xs text-muted leading-relaxed mb-4">
                Graphe visuel libre de 25+ blocs, requêtes SQL DuckDB et export direct en scripts Python, R ou Notebooks Jupyter.
              </p>
            </div>
            <Link
              to="/canvas"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-auto"
            >
              Ouvrir le canvas <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Bibliothèque de Données (Data Grid Pro) ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
              Bibliothèque de Données en Mémoire
            </h2>
            <span className="ui-tag ui-tag-neutral">{datasets.length}</span>
          </div>
          <Link to="/workflow" className="text-xs font-semibold text-accent-400 hover:underline">
            + Ajouter un dataset
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ui-panel h-32 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : datasets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {datasets.map((ds) => (
              <DatasetCard key={ds.id} ds={ds} onDelete={handleDelete} isDeleting={isDeleting} />
            ))}
          </div>
        ) : (
          <div className="ui-panel p-8 text-center flex flex-col items-center justify-center">
            <Database className="w-10 h-10 text-muted mb-3 opacity-60" />
            <h3 className="text-sm font-bold text-white mb-1">Aucun jeu de données chargé</h3>
            <p className="text-xs text-muted max-w-sm mb-4">
              Importez un fichier CSV, XLSX, Parquet ou JSON pour démarrer vos analyses statistiques.
            </p>
            <Link to="/workflow" className="ui-btn ui-btn-primary ui-focusable">
              <Upload className="w-3.5 h-3.5" />
              Importer un fichier
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function DatasetCard({
  ds,
  onDelete,
  isDeleting,
}: {
  ds: DatasetItem;
  onDelete: (id: string, name: string) => Promise<void>;
  isDeleting: boolean;
}) {
  const navigate = useNavigate();
  const rows = ds.shape?.rows ?? 0;
  const cols = ds.shape?.columns ?? 0;

  return (
    <div className="ui-panel p-3.5 flex flex-col justify-between space-y-3 hover:border-accent-500/30 transition-colors group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="text-xs font-bold text-white truncate group-hover:text-accent-300 transition-colors" title={ds.name}>
            {ds.name}
          </h4>
          <button
            onClick={() => onDelete(ds.id, ds.name)}
            disabled={isDeleting}
            className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Supprimer définitivement"
            aria-label="Supprimer ce jeu de données"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted font-mono">
          <span>{rows.toLocaleString()} L</span>
          <span>•</span>
          <span>{cols} col.</span>
          {ds.versions_count != null && ds.versions_count > 1 && (
            <>
              <span>•</span>
              <span>v{ds.versions_count}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--ui-border)]">
        <button
          onClick={() => navigate(`/explorer?dataset=${ds.id}`)}
          className="flex-1 ui-btn text-[11px] py-1 h-7"
          title="Explorer les signaux"
        >
          <Compass className="w-3 h-3 text-accent-400" />
          Explorer
        </button>
        <button
          onClick={() => navigate(`/analyzer?dataset=${ds.id}`)}
          className="flex-1 ui-btn text-[11px] py-1 h-7"
          title="Diagnostic méthodique 11 étapes"
        >
          <Workflow className="w-3 h-3 text-emerald-400" />
          Méthode
        </button>
        <button
          onClick={() => navigate(`/canvas?dataset=${ds.id}`)}
          className="flex-1 ui-btn text-[11px] py-1 h-7"
          title="Ouvrir dans le Canvas nodal"
        >
          <Network className="w-3 h-3 text-blue-400" />
          Canvas
        </button>
      </div>
    </div>
  );
}
