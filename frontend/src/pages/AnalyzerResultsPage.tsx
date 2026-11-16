import { useLocation, useNavigate } from 'react-router-dom';
import ResultsWizard from '../components/wizard/ResultsWizard';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function AnalyzerResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  let state = location.state as { autoPipelineExecution?: any; datasetId?: string } | null;

  if (!state?.autoPipelineExecution || !state?.datasetId) {
    try {
      const stored = sessionStorage.getItem('autoPipelineExecution');
      const storedDs = sessionStorage.getItem('autoPipelineDatasetId');
      if (stored && storedDs) {
        state = {
          autoPipelineExecution: JSON.parse(stored),
          datasetId: storedDs,
        };
      }
    } catch {}
  }

  if (!state?.autoPipelineExecution || !state?.datasetId) {
    navigate('/analyzer', { replace: true });
    return null;
  }

  const { autoPipelineExecution: execution, datasetId } = state;
  const stats = execution.steps ?? {};
  const stepEntries = Object.entries(stats) as [string, { status: string }][];
  const successCount = stepEntries.filter(([, s]) => s.status === 'success').length;
  const errorCount = stepEntries.filter(([, s]) => s.status === 'error').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="ui-panel">
        <div className="px-6 py-5 md:px-8 md:py-6">
          <button
            onClick={() => navigate('/analyzer')}
            className="mb-3 flex items-center gap-1.5 text-xs text-muted hover:text-accent-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour à l'analyseur
          </button>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <span className="ui-tag bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                Analyse terminée
              </span>
              <h1 className="text-2xl font-bold text-surface-100 tracking-tight leading-tight">
                Résultats de l'Analyseur
              </h1>
            </div>
            <div className="flex items-center gap-2.5 ui-num">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  {successCount}/{stepEntries.length} étapes réussies
                </span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25">
                  <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">
                    {errorCount} erreur{errorCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <ResultsWizard
        datasetId={datasetId}
        execution={execution}
        onReset={() => navigate('/analyzer')}
        onLowCode={() => navigate('/canvas')}
      />
    </div>
  );
}
