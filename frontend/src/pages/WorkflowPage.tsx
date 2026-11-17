import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useGetDatasetQuery } from '../store/api';
import { useAppDispatch } from '../hooks';
import { setCurrentDataset } from '../store/slices/datasetSlice';
import FileUpload from '../components/dataset/FileUpload';
import DataProfile from '../components/dataset/DataProfile';
import CleaningPanel from '../components/transform/CleaningPanel';
import HistoryPanel from '../components/dataset/HistoryPanel';
import {
  Upload, Sparkles, Workflow, ArrowRight, FileSpreadsheet, Clock,
} from 'lucide-react';

const VALID_STEPS = new Set<string>(['upload', 'profile', 'clean']);
type StepKey = 'upload' | 'profile' | 'clean';

export default function WorkflowPage() {
  const { datasetId, step: urlStep } = useParams<{ datasetId: string; step: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

  const currentStep: StepKey = (urlStep && VALID_STEPS.has(urlStep) ? urlStep : 'upload') as StepKey;

  const { data: dataset, isLoading } = useGetDatasetQuery(datasetId!, { skip: !datasetId });

  useEffect(() => {
    if (datasetId) {
      dispatch(setCurrentDataset(datasetId));
    }
  }, [datasetId, dispatch]);

  if (urlStep && !VALID_STEPS.has(urlStep)) {
    return <Navigate to={datasetId ? `/workflow/${datasetId}/profile` : '/workflow'} replace />;
  }

  if (!datasetId && currentStep !== 'upload') {
    return <Navigate to="/workflow" replace />;
  }

  const handleUploaded = (id: string) => {
    navigate(`/workflow/${id}/profile`, { replace: true });
  };

  const goToStep = (step: StepKey) => {
    if (step === 'upload') {
      navigate('/workflow');
      return;
    }
    if (datasetId && step !== currentStep) {
      navigate(`/workflow/${datasetId}/${step}`);
    }
  };

  const showProfile = currentStep === 'profile' && activeTab === 'profile';
  const showHistory = currentStep === 'profile' && activeTab === 'history';
  const showClean = currentStep === 'clean';

  return (
    <div className="flex flex-col space-y-3 animate-fade-in">
      {!datasetId ? (
        <>
          <header className="ui-panel px-4 py-2.5 flex items-center justify-between gap-3">
            <h1 className="text-sm font-bold text-surface-100">
              Importer un jeu de données
              <span className="font-normal text-muted ml-2">
                — CSV, Parquet, Excel (.xlsx) ou JSON
              </span>
            </h1>
          </header>
          <FileUpload onUploaded={handleUploaded} />
        </>
      ) : (
        <>
          <div
            className="ui-panel px-2.5 flex flex-wrap items-center justify-between gap-2"
            style={{ minHeight: 42 }}
          >
            <div className="flex items-center gap-1" role="tablist">
              <button
                role="tab"
                aria-selected={showProfile}
                onClick={() => { setActiveTab('profile'); goToStep('profile'); }}
                className={`ui-btn text-xs ${showProfile ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Variables &amp; Typage
              </button>
              <button
                role="tab"
                aria-selected={showClean}
                onClick={() => goToStep('clean')}
                className={`ui-btn text-xs ${showClean ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Nettoyage rapide
              </button>
              <button
                role="tab"
                aria-selected={showHistory}
                onClick={() => { setActiveTab('history'); goToStep('profile'); }}
                className={`ui-btn text-xs ${showHistory ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
              >
                <Clock className="w-3.5 h-3.5" />
                Versions
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/workflow" className="ui-btn ui-focusable text-xs">
                <Upload className="w-3.5 h-3.5" />
                Nouveau fichier
              </Link>
              <button
                onClick={() => navigate(`/analyzer?dataset=${encodeURIComponent(datasetId)}`)}
                className="ui-btn ui-btn-primary ui-focusable text-xs"
                title="Lancer l'audit qualité et les 11 étapes méthodiques"
              >
                <Workflow className="w-3.5 h-3.5" />
                Lancer la Méthodologie
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {currentStep === 'upload' && <FileUpload onUploaded={handleUploaded} />}

          {currentStep === 'profile' && isLoading && !dataset && (
            <div className="ui-panel p-8 text-center text-xs ui-t-muted">
              Chargement du profil du jeu de données…
            </div>
          )}

          {currentStep === 'profile' && dataset && (
            <>
              {activeTab === 'profile' && (
                <DataProfile profile={dataset.profile} datasetId={datasetId} />
              )}
              {activeTab === 'history' && <HistoryPanel datasetId={datasetId} />}
            </>
          )}

          {showClean && (
            <CleaningPanel datasetId={datasetId} onCleaned={() => goToStep('profile')} />
          )}
        </>
      )}
    </div>
  );
}
