import { useLocation, useNavigate } from 'react-router-dom';
import ResultsWizard from '../components/wizard/ResultsWizard';
import { ArrowLeft } from 'lucide-react';

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
    } catch {
      // sessionStorage indisponible
    }
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
    <div className="space-y-3 animate-fade-in">
      <div className="ui-panel px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/analyzer')}
            className="ui-btn ui-btn-ghost ui-focusable text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retour
          </button>
          <span className="ui-sep" aria-hidden />
          <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
            Résultats du pipeline
          </span>
        </div>

        <div className="flex items-center gap-2 ui-num">
          <span className="ui-tag ui-tag-ok">
            {successCount}/{stepEntries.length} étape(s) réussie(s)
          </span>
          {errorCount > 0 && (
            <span className="ui-tag ui-tag-danger">
              {errorCount} erreur{errorCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <ResultsWizard
        datasetId={datasetId}
        execution={execution}
        onReset={() => navigate('/analyzer')}
        onLowCode={() => navigate('/canvas')}
      />
    </div>
  );
}
