import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  LayoutGrid,
  Clock,
  Target,
  FileText,
} from 'lucide-react';
import { useGenerateProfessionalReportMutation } from '../store/api';
import { StatCard } from './results/ResultAtoms';
import { OverviewTab } from './results/OverviewTab';
import { CleaningTab, DescriptiveTab, TransformsTab } from './results/DataPrepTabs';
import { CorrelationsTab } from './results/CorrelationsTab';
import { ModelingTab } from './results/ModelingTab';
import { ShapTab, InsightsTab, ReportTab } from './results/InsightsAndReportTabs';
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
} from './results/ResultsWizardTypes';

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

export default function ResultsWizard({
  datasetId,
  execution,
  execError,
  onReset,
  onLowCode,
}: Props) {
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
    switch (tab) {
      case 'overview':
        return true;
      case 'cleaning':
        return hasStep('clean') || hasStep('cleaning');
      case 'descriptive':
        return hasStep('descriptive');
      case 'correlations':
        return hasStep('correlations');
      case 'transforms':
        return (
          hasStep('transform_recommendations') ||
          hasStep('transforms') ||
          hasStep('transform') ||
          hasStep('stationarization_transform') ||
          hasStep('transform_recommend')
        );
      case 'modeling':
        return (
          hasStep('model') ||
          hasStep('timeseries') ||
          hasStep('timeseries_multivariate')
        );
      case 'shap':
        return hasStep('explainability') || hasStep('shap');
      case 'insights':
        return hasStep('insights');
      case 'report':
        return stats.success > 0;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-surface-50 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Résultats de l'analyse
          </h2>
          <p className="text-sm text-surface-300 mt-1">
            {execution.title} • {stats.success} étapes réussies
            {stats.error > 0 && <span className="text-red-400 ml-2">{stats.error} erreurs</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 bg-surface-800 text-surface-200 hover:text-white hover:bg-surface-700 text-sm font-medium transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Nouvelle analyse
          </button>
          {onLowCode && (
            <button
              onClick={onLowCode}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent-500/30 bg-accent-500/10 text-accent-400 hover:bg-accent-500/20 text-sm font-medium transition-colors"
            >
              <LayoutGrid className="w-4 h-4" />
              Mode Canevas
            </button>
          )}
        </div>
      </div>

      {/* Stats summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Étapes réussies"
          value={stats.success}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <StatCard
          icon={XCircle}
          label="Erreurs"
          value={stats.error}
          color={stats.error > 0 ? 'text-red-400' : 'text-surface-400'}
          bg={stats.error > 0 ? 'bg-red-500/10' : 'bg-surface-500/10'}
        />
        <StatCard
          icon={Clock}
          label="Durée totale"
          value={`${(stats.totalDuration / 1000).toFixed(1)}s`}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={Target}
          label="Variable cible"
          value={execution.target ?? '—'}
          color="text-cyan-400"
          bg="bg-cyan-500/10"
        />
        <StatCard
          icon={FileText}
          label="Type de problème"
          value={execution.problem_type?.replace(/_/g, ' ') ?? '—'}
          color="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 bg-surface-800/50 p-1 rounded-lg border border-white/10">
        {(Object.keys(TAB_META) as ResultTab[]).map(tab => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          const hasContent = checkTabContent(tab);

          return (
            <button
              key={tab}
              onClick={() => hasContent && setActiveTab(tab)}
              disabled={!hasContent}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? `${meta.bg} ${meta.color} border border-white/10 shadow-sm`
                  : hasContent
                  ? 'text-surface-300 hover:text-white hover:bg-white/10'
                  : 'text-surface-600 cursor-not-allowed opacity-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <OverviewTab steps={steps} stats={stats} execution={execution} />
        )}
        {activeTab === 'cleaning' && (hasStep('clean') || hasStep('cleaning')) && (
          <CleaningTab
            result={
              (getStepResult('clean') || getStepResult('cleaning')) as CleaningResult
            }
          />
        )}
        {activeTab === 'descriptive' && hasStep('descriptive') && (
          <DescriptiveTab result={getStepResult('descriptive') as DescriptiveResult} />
        )}
        {activeTab === 'correlations' && hasStep('correlations') && (
          <CorrelationsTab result={getStepResult('correlations') as CorrelationResult} />
        )}
        {activeTab === 'transforms' && (
          <TransformsTab
            recommendations={
              getStepResult('transform_recommendations') as TransformRecommendation[]
            }
            applied={
              (getStepResult('transforms') ||
                getStepResult('transform') ||
                getStepResult('stationarization_transform')) as TransformAppliedResult
            }
          />
        )}
        {activeTab === 'modeling' &&
          (hasStep('model') ||
            hasStep('timeseries') ||
            hasStep('timeseries_multivariate')) && (
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
          <ShapTab
            result={
              (getStepResult('explainability') || getStepResult('shap')) as ShapResult
            }
          />
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

      {/* Global errors */}
      {execError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Erreur globale</p>
            <p className="text-sm text-red-200/70 mt-1">{execError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
