import { useLocation, useNavigate } from 'react-router-dom';
import ResultsWizard from '../components/ResultsWizard';
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
      <section className="relative rounded-2xl bg-surface-900 border border-white/5 shadow-sm">
        <div className="relative z-10 px-6 py-6 md:px-8 md:py-8">
          <button
            onClick={() => navigate('/analyzer')}
            className="mb-4 flex items-center gap-1.5 text-xs text-muted hover:text-accent-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour a l'analyseur
          </button>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-3">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Analyse terminee</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-[1.1]">
                Resultats de l'Analyseur
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                  {successCount}/{stepEntries.length} etapes reussies
                </span>
              </div>
              {errorCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-[10px] font-semibold text-red-300 uppercase tracking-wider">
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
