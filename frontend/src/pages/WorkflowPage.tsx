import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useGetDatasetQuery } from '../store/api';
import { useAppDispatch } from '../hooks';
import { setCurrentDataset } from '../store/slices/datasetSlice';
import FileUpload from '../components/dataset/FileUpload';
import DataProfile from '../components/dataset/DataProfile';
import CleaningPanel from '../components/transform/CleaningPanel';
import HistoryPanel from '../components/dataset/HistoryPanel';
import JobQueue from '../components/dataset/JobQueue';
import {
  Upload, Search, Sparkles, Workflow, Network, Compass,
  ArrowRight, FileSpreadsheet, Database, Clock,
} from 'lucide-react';

const STEPS = [
  { key: 'upload', label: '1. Ingestion', icon: Upload },
  { key: 'profile', label: '2. Profilage & Typage', icon: Search },
  { key: 'clean', label: '3. Nettoyage rapide (optionnel)', icon: Sparkles },
] as const;

type StepKey = (typeof STEPS)[number]['key'];
const VALID_STEPS = new Set<string>(STEPS.map((s) => s.key));

export default function WorkflowPage() {
  const { datasetId, step: urlStep } = useParams<{ datasetId: string; step: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'jobs'>('profile');

  // Déterminer l'étape courante depuis l'URL
  const currentStep: StepKey = (urlStep && VALID_STEPS.has(urlStep) ? urlStep : 'upload') as StepKey;

  const { data: dataset, isLoading } = useGetDatasetQuery(datasetId!, { skip: !datasetId });

  // Sync le Redux store pour le dataset actif
  useEffect(() => {
    if (datasetId) {
      dispatch(setCurrentDataset(datasetId));
    }
  }, [datasetId, dispatch]);

  // Si étape invalide dans l'URL
  if (urlStep && !VALID_STEPS.has(urlStep)) {
    return <Navigate to={datasetId ? `/workflow/${datasetId}/profile` : '/workflow'} replace />;
  }

  // Accès sans dataset redirigé vers l'upload
  if (!datasetId && currentStep !== 'upload') {
    return <Navigate to="/workflow" replace />;
  }

  const handleUploaded = (id: string) => {
    navigate(`/workflow/${id}/profile`, { replace: true });
  };

  const goToStep = (step: StepKey) => {
    if (step === 'upload') {
      navigate('/workflow');
    } else if (datasetId) {
      navigate(`/workflow/${datasetId}/${step}`);
    }
  };

  return (
    <div className="flex flex-col space-y-4 animate-fade-in">
      {/* ── En-tête Ingestion & Profilage ── */}
      <header className="ui-panel p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="ui-tag ui-tag-accent">Module Ingestion</span>
            <span className="ui-tag ui-tag-neutral">DuckDB Engine</span>
          </div>
          <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
            {dataset ? `Fiche de Données : ${dataset.name}` : 'Ingestion & Profilage de Données'}
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Chargement local de fichiers plats (CSV, Parquet, XLSX, JSON) avec détection automatique de schémas et typage statistique.
          </p>
        </div>

        {datasetId && (
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/workflow" className="ui-btn ui-focusable text-xs">
              <Upload className="w-3.5 h-3.5" />
              Nouveau fichier
            </Link>
          </div>
        )}
      </header>

      {/* ── Stepper d'ingestion épuré ── */}
      {datasetId && (
        <div className="ui-panel p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              return (
                <button
                  key={step.key}
                  onClick={() => goToStep(step.key)}
                  className={`ui-btn text-xs ${isActive ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* Raccourci vers les analyses majeures */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={() => navigate(`/analyzer?dataset=${datasetId}`)}
              className="ui-btn ui-btn-primary text-xs"
              title="Lancer l'audit qualité et les 11 étapes méthodiques"
            >
              <Workflow className="w-3.5 h-3.5 text-emerald-400" />
              Lancer la Méthodologie
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => navigate(`/canvas?dataset=${datasetId}`)}
              className="ui-btn text-xs"
              title="Ouvrir dans le Studio Canvas Nodal"
            >
              <Network className="w-3.5 h-3.5 text-blue-400" />
              Studio Canvas
            </button>
          </div>
        </div>
      )}

      {/* ── Étape 1 : Téléversement / Ingestion ── */}
      {currentStep === 'upload' && (
        <FileUpload onUploaded={handleUploaded} />
      )}

      {/* ── Étape 2 : Profilage & Validation des Types ── */}
      {currentStep === 'profile' && dataset && (
        <div className="space-y-4">
          {/* Bannière de lancement d'analyse */}
          <div className="ui-panel p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-l-4 border-l-emerald-500">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Données Prêtes pour Analyse
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Vérifiez les types statistiques détectés ci-dessous, puis choisissez votre approche d'analyse :
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate(`/analyzer?dataset=${datasetId}`)}
                className="ui-btn ui-btn-primary text-xs"
              >
                <Workflow className="w-3.5 h-3.5" />
                Analyse Méthodique (11 étapes)
              </button>
              <button
                onClick={() => navigate(`/canvas?dataset=${datasetId}`)}
                className="ui-btn text-xs"
              >
                <Network className="w-3.5 h-3.5 text-blue-400" />
                Canvas Nodal
              </button>
              <button
                onClick={() => navigate(`/explorer?dataset=${datasetId}`)}
                className="ui-btn text-xs"
              >
                <Compass className="w-3.5 h-3.5 text-accent-400" />
                Explorateur
              </button>
            </div>
          </div>

          {/* Onglets d'inspection du Dataset */}
          <div className="ui-panel p-1 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('profile')}
              className={`ui-btn text-xs ${activeTab === 'profile' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Variables & Typage
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`ui-btn text-xs ${activeTab === 'history' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <Clock className="w-3.5 h-3.5" />
              Historique des Versions
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`ui-btn text-xs ${activeTab === 'jobs' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <Database className="w-3.5 h-3.5" />
              Tâches Asynchrones
            </button>
          </div>

          {activeTab === 'profile' && (
            <DataProfile profile={dataset.profile} datasetId={datasetId!} />
          )}
          {activeTab === 'history' && (
            <HistoryPanel datasetId={datasetId!} />
          )}
          {activeTab === 'jobs' && (
            <JobQueue datasetId={datasetId!} />
          )}
        </div>
      )}

      {/* ── Étape 3 : Nettoyage Rapide (Optionnel) ── */}
      {currentStep === 'clean' && datasetId && (
        <div className="space-y-4">
          <CleaningPanel datasetId={datasetId} onCleaned={() => goToStep('profile')} />
        </div>
      )}
    </div>
  );
}
