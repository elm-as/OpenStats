import { useState, useMemo } from 'react';
import {
  AlertCircle,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import { useGenerateProfessionalReportMutation } from '../../store/api';
import { SummaryCell } from '../results/ResultAtoms';
import { OverviewTab } from '../results/OverviewTab';
import { CleaningTab, DescriptiveTab, TransformsTab } from '../results/DataPrepTabs';
import { CorrelationsTab } from '../results/CorrelationsTab';
import { ModelingTab } from '../results/ModelingTab';
import { ShapTab, InsightsTab, ReportTab } from '../results/InsightsAndReportTabs';
import {
  type ResultTab,
  TAB_META,
  type CleaningResult,
  type DescriptiveResult,
  type CorrelationResult,
  type ModelResult,
  type ShapResult,
  type InsightsResult,
  type TransformRecommendation,
  type TransformAppliedResult,
} from '../results/ResultsWizardTypes';

interface Props {
  datasetId: string;
  execution: {
    title: string;
    problem_type: string;
    target: string | null;
    steps: Record<
      string,
      {
        status: 'success' | 'error' | 'skipped';
        label: string;
        operation?: string;
        duration_ms?: number;
        result?: unknown;
        error?: string;
        reason?: string;
      }
    >;
  };
  execError?: string | null;
  onReset?: () => void;
  onLowCode?: () => void;
}

export default function ResultsWizard(props: Props) {
  const { datasetId, execution, execError, onReset, onLowCode } = props;
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'docx'>('pdf');

  const [generateProfessionalReport, { isLoading: isGeneratingReport }] =
    useGenerateProfessionalReportMutation();

  const steps = execution.steps ?? {};
  const stepEntries = Object.entries(steps);

  const stats = useMemo(() => {
    const success = stepEntries.filter(([, s]) => s.status === 'success').length;
    const error = stepEntries.filter(([, s]) => s.status === 'error').length;
    const skipped = stepEntries.filter(([, s]) => s.status === 'skipped').length;
    const totalDuration = stepEntries.reduce((sum, [, s]) => sum + (s.duration_ms || 0), 0);
    return { success, error, skipped, totalDuration };
  }, [stepEntries]);

  const handleDownloadReport = async () => {
    try {
      const blob = await generateProfessionalReport({
        id: datasetId,
        format: reportFormat,
        title: execution.title,
      }).unwrap();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rapport_${execution.title.replace(/\s+/g, '_').toLowerCase()}_${new Date()
        .toISOString()
        .slice(0, 10)}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement rapport:', err);
    }
  };

  const getStepResult = (key: string) => steps[key]?.result;
  const hasStep = (key: string) => !!steps[key];

  const checkTabContent = (tab: ResultTab): boolean => {
    if (tab === 'overview') return true;
    if (tab === 'cleaning') return hasStep('clean') || hasStep('cleaning');
    if (tab === 'descriptive') return hasStep('descriptive');
    if (tab === 'correlations') return hasStep('correlations');
    if (tab === 'transforms') {
      return (
        hasStep('transform_recommendations') ||
        hasStep('transforms') ||
        hasStep('transform') ||
        hasStep('stationarization_transform') ||
        hasStep('transform_recommend')
      );
    }
    if (tab === 'modeling') {
      return hasStep('model') || hasStep('timeseries') || hasStep('timeseries_multivariate');
    }
    if (tab === 'shap') return hasStep('explainability') || hasStep('shap');
    if (tab === 'insights') return hasStep('insights');
    if (tab === 'report') return stats.success > 0;
    return false;
  };

  return (
    <div className="space-y-3">
      <div className="ui-panel px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold" style={{ color: 'var(--ui-text)' }}>{execution.title}</span>
          <span className="ui-sep" aria-hidden />
          <span className="ui-tag ui-tag-ok ui-num">{stats.success} réussie(s)</span>
          {stats.error > 0 && <span className="ui-tag ui-tag-danger ui-num">{stats.error} erreur(s)</span>}
          <span className="ui-tag ui-num">{(stats.totalDuration / 1000).toFixed(1)} s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onReset} className="ui-btn ui-focusable text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Nouvelle analyse
          </button>
          {onLowCode && (
            <button onClick={onLowCode} className="ui-btn ui-focusable text-xs">
              <LayoutGrid className="w-3.5 h-3.5" /> Canvas
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ui-num">
        <SummaryCell label="Étapes" value={`${stats.success}/${stepEntries.length}`} tone={stats.error > 0 ? 'warning' : 'success'} />
        <SummaryCell label="Durée" value={`${(stats.totalDuration / 1000).toFixed(1)} s`} />
        <SummaryCell label="Cible" value={execution.target ?? '—'} />
        <SummaryCell label="Problème" value={execution.problem_type?.replace(/_/g, ' ') ?? '—'} />
      </div>

      <div className="ui-panel flex flex-wrap gap-1 p-1" role="tablist">
        {(Object.keys(TAB_META) as ResultTab[]).map(tab => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          const hasContent = checkTabContent(tab);

          return (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => hasContent && setActiveTab(tab)}
              disabled={!hasContent}
              className={`ui-btn text-xs ${
                activeTab === tab ? 'ui-btn-primary' : hasContent ? 'ui-btn-ghost' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[360px]">
        {activeTab === 'overview' && <OverviewTab steps={steps} stats={stats} execution={execution} />}
        {activeTab === 'cleaning' && (hasStep('clean') || hasStep('cleaning')) && (
          <CleaningTab result={(getStepResult('clean') || getStepResult('cleaning')) as CleaningResult} />
        )}
        {activeTab === 'descriptive' && hasStep('descriptive') && (
          <DescriptiveTab result={getStepResult('descriptive') as DescriptiveResult} />
        )}
        {activeTab === 'correlations' && hasStep('correlations') && (
          <CorrelationsTab result={getStepResult('correlations') as CorrelationResult} />
        )}
        {activeTab === 'transforms' && (
          <TransformsTab
            recommendations={getStepResult('transform_recommendations') as TransformRecommendation[]}
            applied={
              (getStepResult('transforms') ||
                getStepResult('transform') ||
                getStepResult('stationarization_transform')) as TransformAppliedResult
            }
          />
        )}
        {activeTab === 'modeling' &&
          (hasStep('model') || hasStep('timeseries') || hasStep('timeseries_multivariate')) && (
            <ModelingTab
              result={
                (getStepResult('model') ||
                  getStepResult('timeseries') ||
                  getStepResult('timeseries_multivariate')) as ModelResult
              }
              problemType={execution.problem_type}
              target={execution.target}
            />
          )}
        {activeTab === 'shap' && (hasStep('explainability') || hasStep('shap')) && (
          <ShapTab result={(getStepResult('explainability') || getStepResult('shap')) as ShapResult} />
        )}
        {activeTab === 'insights' && hasStep('insights') && (
          <InsightsTab result={getStepResult('insights') as InsightsResult} />
        )}
        {activeTab === 'report' && (
          <ReportTab
            format={reportFormat}
            setFormat={setReportFormat}
            onDownload={handleDownloadReport}
            isGenerating={isGeneratingReport}
            hasResults={stats.success > 0}
          />
        )}
      </div>

      {execError && (
        <div
          className="ui-panel p-3 flex items-start gap-2 text-xs ui-t-danger"
          style={{ background: 'var(--ui-danger-soft)', borderColor: 'var(--ui-danger)' }}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{execError}</span>
        </div>
      )}
    </div>
  );
}
