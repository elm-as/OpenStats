import { useEffect } from 'react';
import { useParams, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useGetDatasetQuery } from '../store/api';
import { useAppDispatch } from '../hooks';
import { setCurrentDataset } from '../store/slices/datasetSlice';
import FileUpload from '../components/FileUpload';
import DataProfile from '../components/DataProfile';
import CleaningPanel from '../components/CleaningPanel';
import AnalysisWizard from '../components/AnalysisWizard';
import ReportPanel from '../components/ReportPanel';
import HistoryPanel from '../components/HistoryPanel';
import JobQueue from '../components/JobQueue';
import AdvisoryPanel from '../components/AdvisoryPanel';
import ResultsWizard from '../components/ResultsWizard';
import {
  Upload, Search, Sparkles, BarChart3, FileText,
  ChevronRight, CheckCircle2,
} from 'lucide-react';

const STEPS = [
  { key: 'upload', label: 'Import', icon: Upload },
  { key: 'profile', label: 'Profilage', icon: Search },
  { key: 'clean', label: 'Nettoyage', icon: Sparkles },
  { key: 'analyze', label: 'Analyse & Modélisation', icon: BarChart3 },
  { key: 'report', label: 'Rapport', icon: FileText },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const VALID_STEPS = new Set<string>(STEPS.map((s) => s.key));

export default function WorkflowPage() {
  const { datasetId, step: urlStep } = useParams<{ datasetId: string; step: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Déterminer l'étape courante depuis l'URL
  const currentStep: StepKey = (urlStep && VALID_STEPS.has(urlStep) ? urlStep : 'upload') as StepKey;

  const { data: dataset } = useGetDatasetQuery(datasetId!, { skip: !datasetId });

  // Sync le Redux store pour les composants qui en dépendent
  useEffect(() => {
    if (datasetId) {
      dispatch(setCurrentDataset(datasetId));
    }
  }, [datasetId, dispatch]);

  // Si on a un step invalide dans l'URL, rediriger
  if (urlStep && !VALID_STEPS.has(urlStep)) {
    return <Navigate to={datasetId ? `/workflow/${datasetId}/profile` : '/workflow'} replace />;
  }

  // Si on essaie d'accéder à une étape sans dataset
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

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stepper */}
      {datasetId && (
        <div className="card p-3">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = step.key === currentStep;
              const isPast = i < stepIndex;
              const isClickable = isPast || (!!datasetId && step.key !== 'upload');

              return (
                <div key={step.key} className="flex items-center">
                  <button
                    onClick={() => isClickable && goToStep(step.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200
                      ${isActive
                        ? 'bg-accent-400/10 text-accent-300 font-semibold ring-1 ring-accent-400/30'
                        : isPast
                          ? 'text-emerald-400 cursor-pointer hover:bg-emerald-400/5'
                          : isClickable
                            ? 'text-surface-400 cursor-pointer hover:bg-white/[0.04] hover:text-surface-200'
                            : 'text-surface-600 cursor-default'
                      }
                    `}
                    disabled={!isClickable}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span className="hidden md:inline">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-px mx-1 ${isPast ? 'bg-emerald-400/30' : 'bg-surface-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Contenu de l'étape */}
      {currentStep === 'upload' && (
        <FileUpload onUploaded={handleUploaded} />
      )}

      {currentStep === 'profile' && dataset && (
        <div className="space-y-4">
          <DataProfile profile={dataset.profile} datasetId={datasetId!} />
          <div className="flex justify-end">
            <button onClick={() => goToStep('clean')} className="btn-primary flex items-center gap-2">
              Nettoyage <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'clean' && datasetId && (
        <div className="space-y-4">
          <CleaningPanel datasetId={datasetId} onCleaned={() => {}} />
          <div className="flex justify-end">
            <button onClick={() => goToStep('analyze')} className="btn-primary flex items-center gap-2">
              Analyse <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'analyze' && datasetId && (
        <div className="space-y-4">
          <AdvisoryPanel datasetId={datasetId} />
          <AnalysisWizard datasetId={datasetId} />
          <div className="flex justify-end">
            <button onClick={() => goToStep('report')} className="btn-primary flex items-center gap-2">
              Rapport <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {currentStep === 'report' && datasetId && (
        <ReportPanel datasetId={datasetId} />
      )}

      {/* Historique & Traçabilité — visible dès qu'un dataset est chargé */}
      {datasetId && currentStep !== 'upload' && (
        <>
          <JobQueue datasetId={datasetId} />
          <HistoryPanel datasetId={datasetId} />
        </>
      )}
    </div>
  );
}
