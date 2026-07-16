import { Link, useNavigate } from 'react-router-dom';
import { useDeleteDatasetMutation, useListDatasetsQuery } from '../store/api';
import { Upload, Database, Clock, ArrowRight, Sigma, Trash2, BarChart3, Network, Sparkles, Play } from 'lucide-react';
import logoOS from '../assets/logoOS.png';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';

export default function Dashboard() {
  const { data: result, isLoading } = useListDatasetsQuery();
  const datasets = result?.datasets ?? [];
  const [deleteDataset, { isLoading: isDeleting }] = useDeleteDatasetMutation();
  const navigate = useNavigate();
  const toast = useToast();

  const handleDelete = async (datasetId: string, datasetName: string) => {
    const confirmed = window.confirm(`Supprimer définitivement le dataset "${datasetName}" ?`);
    if (!confirmed) return;
    try {
      await deleteDataset(datasetId).unwrap();
      toast.success({ title: 'Dataset supprimé', description: `"${datasetName}" a été retiré.` });
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error({ title: 'Suppression échouée', description: extractErrorMessage(error) });
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl bg-surface-900 border border-white/5 shadow-sm">
        <div className="relative z-10 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">Plateforme d'analyse statistique</p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter leading-[1.1] mb-3">
              OpenStats
            </h1>
            <p className="text-surface-400 text-[13px] md:text-sm mb-5 leading-relaxed max-w-lg">
              Importez vos donnees, construisez des pipelines visuels, executez des analyses statistiques et exportez vos resultats.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <Link to="/workflow" className="btn-primary">
                <Upload className="w-4 h-4" />
                Importer un dataset
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/canvas" className="btn-secondary">
                <Network className="w-4 h-4" />
                Canvas
              </Link>
              <Link to="/docs" className="btn-secondary text-xs">
                Documentation
              </Link>
            </div>
          </div>
          <div className="hidden md:block shrink-0 text-center">
            <div className="w-48 h-48 rounded-2xl bg-surface-800/50 border border-white/5 flex items-center justify-center mb-3">
              <img src={logoOS} alt="OpenStats" className="w-24 h-24 object-contain opacity-90" />
            </div>
            <a
              href="https://elmas.solutions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[9px] font-black text-surface-500 hover:text-accent-400 uppercase tracking-[0.25em] transition-colors"
            >
              Powered by Elmas
            </a>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-900/50 border border-white/5">
        <Database className="w-5 h-5 text-accent-400" />
        <div>
          <p className="text-sm font-bold text-white">{datasets.length} dataset{datasets.length !== 1 ? 's' : ''} importe{datasets.length !== 1 ? 's' : ''}</p>
          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Pret{datasets.length !== 1 ? 's' : ''} pour l'analyse</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-5 bg-accent-500 rounded-full" />
            <h3 className="text-base md:text-lg font-black text-white tracking-tight">Bibliothèque de Données</h3>
          </div>
          <Link to="/workflow" className="text-xs font-bold text-accent-400 hover:text-accent-300 transition-colors flex items-center gap-1.5">
            Tout voir <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card h-40 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : datasets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((ds) => (
              <DatasetCard key={ds.id} ds={ds} onDelete={handleDelete} isDeleting={isDeleting} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Database className="w-16 h-16 text-surface-600 mx-auto mb-4 opacity-50" />
            <p className="text-surface-400 text-lg mb-2">Aucun dataset pour le moment</p>
            <p className="text-surface-600 text-sm mb-4">Importez un fichier CSV, XLSX ou JSON pour commencer.</p>
            <Link to="/workflow" className="btn-primary">
              <Upload className="w-4 h-4" />
              Importer un dataset
            </Link>
          </div>
        )}
      </div>

      <section className="card !p-5 md:!p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-5 bg-accent-500 rounded-full" />
          <h3 className="text-base font-black text-white tracking-tight">Comment analyser vos données ?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-accent-500/20 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-accent-500/10 flex items-center justify-center mb-3 group-hover:bg-accent-500/20 transition-colors">
              <Play className="w-4 h-4 text-accent-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Analyse Guidée</h4>
            <p className="text-[11px] text-surface-500 leading-relaxed mb-3">
              Workflow pas-à-pas : import → profilage → nettoyage → analyses → rapport. Idéal pour débuter.
            </p>
            <Link to="/workflow" className="text-[10px] font-bold text-accent-400 hover:text-accent-300 transition-colors flex items-center gap-1">
              Démarrer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-purple-500/20 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
              <Network className="w-4 h-4 text-purple-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Canvas Libre</h4>
            <p className="text-[11px] text-surface-500 leading-relaxed mb-3">
              Glissez-déposez des nœuds pour construire des pipelines complexes. 25+ blocs, templates, paramètres avancés.
            </p>
            <Link to="/canvas" className="text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1">
              Ouvrir <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-emerald-500/20 transition-all group">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Analyse Auto IA</h4>
            <p className="text-[11px] text-surface-500 leading-relaxed mb-3">
              L'IA détecte votre problème et construit le pipeline optimal. Nettoyage, modélisation, insights — tout automatique.
            </p>
            <Link to="/analyzer" className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1">
              Lancer <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function DatasetCard({ ds, onDelete, isDeleting }: { ds: { id: string; name: string; created_at: string; shape?: { rows: number; columns: number }; versions_count?: number; file_size?: number }; onDelete: (id: string, name: string) => Promise<void>; isDeleting: boolean }) {
  const navigate = useNavigate();

  const rows = ds.shape?.rows ?? 0;
  const cols = ds.shape?.columns ?? 0;

  return (
    <div className="card group hover:border-accent-500/30 !p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <Link to={`/workflow/${ds.id}/profile`} className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-accent-500/10 transition-colors">
            <BarChart3 className="w-4 h-4 text-surface-400 group-hover:text-accent-400 transition-colors" />
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(ds.id, ds.name); }}
            disabled={isDeleting}
            className="p-1.5 rounded-md text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <Link to={`/workflow/${ds.id}/profile`} className="block mb-3">
          <h4 className="text-sm font-bold text-white mb-1 group-hover:text-accent-400 transition-colors truncate">{ds.name}</h4>
          <div className="flex items-center gap-3 text-[10px] font-bold text-surface-500 uppercase tracking-wider">
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {rows.toLocaleString()}L</span>
            <span className="flex items-center gap-1"><Sigma className="w-3 h-3" /> {cols}C</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/workflow/${ds.id}/profile`)}
            className="flex-1 py-1.5 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 text-accent-300 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-accent-500/15"
            title="Analyse Guidée pas-à-pas"
          >
            <Play className="w-3 h-3" /> Guidée
          </button>
          <button
            onClick={() => navigate(`/canvas?dataset=${ds.id}`)}
            className="flex-1 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-purple-500/15"
            title="Ouvrir dans le Canvas nodal"
          >
            <Network className="w-3 h-3" /> Canvas
          </button>
          <button
            onClick={() => navigate(`/analyzer?dataset=${ds.id}`)}
            className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5 border border-emerald-500/15"
            title="Analyse automatique par IA"
          >
            <Sparkles className="w-3 h-3" /> Auto
          </button>
        </div>
      </div>
      <div className="px-4 py-2.5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-surface-600 uppercase tracking-widest">
          <Clock className="w-3 h-3" />
          {new Date(ds.created_at).toLocaleDateString('fr-FR')}
        </div>
        {ds.versions_count != null && (
          <span className="text-[9px] text-surface-600">{ds.versions_count} versions</span>
        )}
      </div>
    </div>
  );
}
