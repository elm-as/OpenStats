import { useState, useMemo } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, ChevronRight, ChevronDown,
  Download, FileText, BarChart3, TrendingUp, Sparkles, Zap,
  Brain, Activity, FileSpreadsheet, RotateCcw, LayoutGrid,
  Clock, Trophy, Target, Filter, Info,
} from 'lucide-react';
import { api } from '../store/api';
import { PlotlyChart } from './viz/PlotlyBase';

interface Props {
  datasetId: string;
  execution: {
    title: string;
    problem_type: string;
    target: string | null;
    steps: Record<string, {
      status: 'success' | 'error' | 'skipped';
      label: string;
      operation?: string;
      duration_ms?: number;
      result?: unknown;
      error?: string;
      reason?: string;
    }>;
  };
  execError?: string | null;
  onReset?: () => void;
  onLowCode?: () => void;
}

type ResultTab = 'overview' | 'cleaning' | 'descriptive' | 'correlations' | 'transforms' | 'modeling' | 'shap' | 'insights' | 'report';

const TAB_META: Record<ResultTab, { label: string; icon: typeof BarChart3; color: string; bg: string }> = {
  overview: { label: 'Vue d\'ensemble', icon: LayoutGrid, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  cleaning: { label: 'Nettoyage', icon: Filter, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  descriptive: { label: 'Statistiques', icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  correlations: { label: 'Corrélations', icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  transforms: { label: 'Transformations', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  modeling: { label: 'Modélisation', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  shap: { label: 'Explicabilité', icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  insights: { label: 'Insights IA', icon: Activity, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  report: { label: 'Rapport', icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};


export default function ResultsWizard({ datasetId, execution, execError, onReset, onLowCode }: Props) {
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'docx'>('pdf');

  const [generateProfessionalReport, { isLoading: isGeneratingReport }] = api.useGenerateProfessionalReportMutation();

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
      link.download = `rapport_${execution.title.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${reportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement rapport:', err);
    }
  };

  const getStepResult = (key: string) => steps[key]?.result;
  const getStepStatus = (key: string) => steps[key]?.status;
  const hasStep = (key: string) => !!steps[key];

  const checkTabContent = (tab: ResultTab): boolean => {
    switch (tab) {
      case 'overview': return true;
      case 'cleaning': return hasStep('clean');
      case 'descriptive': return hasStep('descriptive');
      case 'correlations': return hasStep('correlations');
      case 'transforms': return hasStep('transform_recommendations') || hasStep('transforms');
      case 'modeling': return hasStep('model');
      case 'shap': return hasStep('explainability');
      case 'insights': return hasStep('insights');
      case 'report': return stats.success > 0;
      default: return false;
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
            className="px-3 py-2 rounded-lg text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-surface-200 transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Relancer
          </button>
          {onLowCode && (
            <button
              onClick={onLowCode}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90 transition-all flex items-center gap-2"
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
        {(Object.keys(TAB_META) as ResultTab[]).map((tab) => {
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
        {activeTab === 'cleaning' && hasStep('clean') && (
          <CleaningTab result={getStepResult('clean') as CleaningResult} />
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
            applied={getStepResult('transforms') as TransformAppliedResult}
          />
        )}
        {activeTab === 'modeling' && hasStep('model') && (
          <ModelingTab 
            result={getStepResult('model') as ModelResult} 
            problemType={execution.problem_type}
            target={execution.target}
          />
        )}
        {activeTab === 'shap' && hasStep('explainability') && (
          <ShapTab result={getStepResult('explainability') as ShapResult} />
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

// === Sub Components ===

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: typeof BarChart3;
  label: string;
  value: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} rounded-lg p-3 border border-white/10`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider ${color} mb-1`}>
        <Icon className="w-3 h-3" />
        <span className="font-semibold">{label}</span>
      </div>
      <div className="text-lg font-semibold text-surface-50">{value}</div>
    </div>
  );
}

function StepStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    error: 'bg-red-500/20 text-red-300 border-red-500/30',
    skipped: 'bg-surface-500/20 text-surface-300 border-gray-500/30',
    running: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 animate-pulse',
  };
  const labels: Record<string, string> = {
    success: 'Réussi',
    error: 'Erreur',
    skipped: 'Ignoré',
    running: 'En cours',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status] || styles.skipped}`}>
      {labels[status] || status}
    </span>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon?: typeof Info }) {
  const DefaultIcon = Icon || Info;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-surface-400">
      <DefaultIcon className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  };
  
  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color] || colorClasses.blue}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-80 mt-1">{label}</div>
    </div>
  );
}

function formatNumber(val: number | undefined | null): string {
  if (val === undefined || val === null) return '—';
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(2) + 'k';
  if (Math.abs(val) >= 1) return val.toFixed(2);
  if (val === 0) return '0';
  return val.toExponential(2);
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    numeric: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    categorical: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    datetime: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    boolean: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[type] || colors.numeric}`}>
      {type}
    </span>
  );
}

// === Tab Components ===

function OverviewTab({ steps, stats, execution }: { steps: Record<string, any>; stats: any; execution: any }) {
  const stepList = Object.entries(steps);
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-cyan-400" />
          Pipeline exécuté
        </h3>
        
        <div className="space-y-2">
          {stepList.map(([key, step], index) => (
            <div
              key={key}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                step.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' :
                step.status === 'error' ? 'bg-red-500/5 border-red-500/20' :
                'bg-surface-500/5 border-gray-500/20'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-xs text-surface-300 font-mono">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-surface-200">{step.label || key}</span>
                  <StepStatusBadge status={step.status} />
                </div>
                <p className="text-xs text-surface-400 mt-0.5">{step.operation || step.rationale}</p>
              </div>
              {step.duration_ms ? (
                <span className="text-xs text-surface-400 font-mono">{step.duration_ms}ms</span>
              ) : (
                <span className="text-xs text-surface-500 font-mono">—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {execution.target && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20 rounded-xl p-4">
          <h4 className="text-sm font-medium text-cyan-300 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Configuration détectée
          </h4>
          <p className="text-sm text-surface-300 mt-2">
            Problème de <strong className="text-cyan-300">{execution.problem_type?.replace(/_/g, ' ')}</strong>
            {' '}sur la variable <code className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">{execution.target}</code>
          </p>
        </div>
      )}
    </div>
  );
}

function CleaningTab({ result }: { result?: CleaningResult }) {
  if (!result) return <EmptyState message="Pas de résultats de nettoyage disponibles" />;
  
  // Handle both old and new result formats
  const actions = result.actions || [];
  const duplicatesAction = actions.find((a: any) => a.action === 'remove_duplicates');
  const imputeAction = actions.find((a: any) => a.action === 'impute_missing');
  const dropMissingAction = actions.find((a: any) => a.action === 'drop_high_missing_cols');
  const dropConstantAction = actions.find((a: any) => a.action === 'drop_constant_cols');
  
  const duplicatesRemoved = duplicatesAction?.removed ?? result.duplicates_removed ?? 0;
  const missingImputed = imputeAction?.n_imputed ?? result.missing_imputed ?? 0;
  const columnsDropped = (dropMissingAction?.dropped?.length || 0) + (dropConstantAction?.dropped?.length || 0);
  
  const beforeRows = result.before_rows ?? result.shape_before?.rows;
  const afterRows = result.after_rows ?? result.shape_after?.rows;
  const beforeCols = result.before_cols ?? result.shape_before?.columns;
  const afterCols = result.after_cols ?? result.shape_after?.columns;
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-400" />
          Nettoyage des données
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricBox label="Doublons supprimés" value={duplicatesRemoved} color="blue" />
          <MetricBox label="Valeurs imputées" value={missingImputed} color="amber" />
          <MetricBox label="Colonnes supprimées" value={columnsDropped} color="purple" />
          <MetricBox label="Lignes modifiées" value={(beforeRows || 0) - (afterRows || 0)} color="emerald" />
        </div>

        {(beforeRows !== undefined || beforeCols !== undefined) && (
          <div className="mt-4 p-3 bg-surface-700/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-300">Dimensions:</span>
              <span className="text-surface-200">
                <span className="text-surface-400">{beforeRows}×{beforeCols}</span>
                <ChevronRight className="w-4 h-4 inline mx-2 text-surface-500" />
                <span className="text-emerald-300 font-semibold">{afterRows}×{afterCols}</span>
              </span>
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-surface-300 mb-2">Actions effectuées</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {actions.map((action: any, i: number) => (
                <div key={i} className="text-xs text-surface-300 flex items-start gap-2 p-2 bg-surface-700/50 rounded">
                  <span className="text-surface-400 font-mono">[{action.action}]</span>
                  <span>{JSON.stringify(action).slice(0, 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DescriptiveTab({ result }: { result?: DescriptiveResult }) {
  if (!result) return <EmptyState message="Pas de statistiques descriptives disponibles" />;
  
  // Handle different result structures
  const stats = (result.statistics || result.stats || result || {}) as Record<string, any>;
  const columns = Object.keys(stats);
  
  if (columns.length === 0) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <EmptyState message="Aucune statistique disponible" />
        <pre className="text-xs text-surface-500 mt-4 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          Statistiques descriptives
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-300 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left py-2 pr-4">Variable</th>
                <th className="text-right py-2 px-3">Type</th>
                <th className="text-right py-2 px-3">N</th>
                <th className="text-right py-2 px-3">Moyenne</th>
                <th className="text-right py-2 px-3">Médiane</th>
                <th className="text-right py-2 px-3">Écart-type</th>
                <th className="text-right py-2 px-3">Min</th>
                <th className="text-right py-2 px-3">Max</th>
                <th className="text-right py-2 px-3">Manquants</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => {
                const s = stats[col] || {};
                return (
                  <tr key={col} className="border-t border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-4 text-surface-200 font-medium">{col}</td>
                    <td className="py-2 px-3 text-right">
                      <TypeBadge type={s.type || 'numeric'} />
                    </td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">{s.count ?? s.n ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">{formatNumber(s.mean)}</td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">{formatNumber(s.median)}</td>
                    <td className="py-2 px-3 text-right text-surface-200 font-mono">{formatNumber(s.std)}</td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">{formatNumber(s.min)}</td>
                    <td className="py-2 px-3 text-right text-surface-300 font-mono">{formatNumber(s.max)}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={(s.null_rate || s.missing_rate || 0) > 0.1 ? 'text-red-300' : 'text-surface-300'}>
                        {((s.null_rate || s.missing_rate || 0) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CorrelationsTab({ result }: { result?: CorrelationResult }) {
  if (!result) return <EmptyState message="Pas de résultats de corrélation disponibles" />;
  
  const matrix = result.matrix || result.correlations || {};
  const cols = Object.keys(matrix);
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-400" />
          Matrice de corrélation
        </h3>
        
        {cols.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-2 text-surface-300"></th>
                  {cols.map(c => (
                    <th key={c} className="text-right py-2 px-1 text-surface-300 text-xs uppercase max-w-[80px] truncate">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map(row => (
                  <tr key={row} className="border-t border-white/5 hover:bg-white/5">
                    <td className="py-2 pr-2 text-surface-200 text-xs font-medium truncate max-w-[80px]">{row}</td>
                    {cols.map(col => {
                      const val = matrix[row]?.[col];
                      const v = val !== undefined ? Number(val) : null;
                      const abs = v !== null ? Math.abs(v) : 0;
                      const isDiag = row === col;
                      
                      return (
                        <td
                          key={col}
                          className={`py-2 px-1 text-center font-mono text-xs ${
                            isDiag ? 'text-surface-500' : abs > 0.7 ? 'font-semibold' : ''
                          }`}
                          style={{
                            backgroundColor: isDiag
                              ? 'transparent'
                              : v !== null
                                ? v > 0
                                  ? `rgba(249,115,22,${abs * 0.25})`
                                  : `rgba(37,99,235,${abs * 0.25})`
                                : 'transparent',
                            color: isDiag ? '#6b7280' : v !== null ? (v > 0 ? '#fb923c' : '#60a5fa') : '#9ca3af',
                          }}
                        >
                          {v !== null ? v.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Aucune variable numérique pour la corrélation" />
        )}

        {result.significant_pairs && result.significant_pairs.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-surface-200 mb-3">Corrélations significatives</h4>
            <div className="space-y-2">
              {result.significant_pairs.slice(0, 10).map((pair: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-surface-700/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">{pair.var1}</code>
                    <span className="text-surface-400">↔</span>
                    <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">{pair.var2}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pair.coefficient > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.abs(pair.coefficient) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono ${pair.coefficient > 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {pair.coefficient.toFixed(3)}
                    </span>
                  </div>
                  <span className="text-xs text-surface-400">{pair.strength}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Correlation heatmap */}
      {cols.length > 1 && (
        <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
          <h4 className="text-sm font-medium text-surface-200 mb-4">Heatmap</h4>
          <PlotlyChart
            data={[
              {
                z: cols.map(row => cols.map(col => matrix[row]?.[col] || 0)),
                x: cols,
                y: cols,
                type: 'heatmap',
                colorscale: [
                  [0, '#2563eb'],
                  [0.5, '#1e293b'],
                  [1, '#f97316'],
                ],
                zmin: -1,
                zmax: 1,
                zmid: 0,
                showscale: true,
                hovertemplate: '<b>%{y} ↔ %{x}</b><br>r = %{z:.3f}<extra></extra>',
                colorbar: {
                  tickfont: { color: '#a3adc8' },
                  outlinecolor: 'rgba(255,255,255,0.1)',
                  outlinewidth: 1,
                },
              } as any,
            ]}
            layout={{
              margin: { t: 20, r: 80, b: 80, l: 100 },
              xaxis: { tickfont: { size: 10 }, tickangle: -45 },
              yaxis: { tickfont: { size: 10 } },
            }}
            config={{ displayModeBar: false }}
            height={400}
          />
        </div>
      )}
    </div>
  );
}

function TransformsTab({ recommendations, applied }: { recommendations?: any; applied?: TransformAppliedResult }) {
  const recs = recommendations?.recommendations || recommendations || [];
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-400" />
          Recommandations de transformation
        </h3>
        
        {recs.length > 0 ? (
          <div className="space-y-2">
            {recs.map((rec: TransformRecommendation, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-surface-700/50 rounded-lg">
                <code className="text-xs bg-surface-600 px-2 py-1 rounded text-surface-200">{rec.column}</code>
                <span className="text-amber-300 text-sm">→</span>
                <span className="text-sm text-surface-200">{rec.recommended_transform}</span>
                <span className="text-xs text-surface-400 flex-1">{rec.rationale}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucune recommandation de transformation" />
        )}
      </div>
    </div>
  );
}

function ModelingTab({ result, problemType, target }: { result?: ModelResult; problemType?: string; target?: string | null }) {
  if (!result) return <EmptyState message="Pas de résultats de modélisation disponibles" />;
  
  const ranking = result.ranking || [];
  const isRegression = problemType === 'regression';
  const isClassification = problemType?.includes('classification');
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          Modélisation — {problemType?.replace(/_/g, ' ')}
          {target && <span className="text-sm text-surface-300">sur <code className="text-cyan-300 bg-cyan-500/20 px-1 rounded">{target}</code></span>}
        </h3>

        {result.best_model_key && (
          <div className="mb-4 p-3 bg-gradient-to-r from-purple-500/20 to-transparent border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-purple-300">Meilleur modèle:</span>
              <code className="text-purple-200 font-semibold bg-purple-500/20 px-2 py-0.5 rounded">{result.best_model_key}</code>
            </div>
          </div>
        )}

        {ranking.length > 0 ? (
          <div className="space-y-2">
            {ranking.map((r: any) => {
              const metrics = r.metrics || {};
              const primary = metrics.r2 ?? metrics.roc_auc ?? metrics.f1_weighted ?? metrics.accuracy;
              const label = metrics.r2 !== undefined ? 'R²' : metrics.roc_auc !== undefined ? 'AUC' : metrics.f1_weighted !== undefined ? 'F1' : 'Acc';
              
              return (
                <div key={r.model_key} className="flex items-center gap-3 p-3 bg-surface-700/50 rounded-lg">
                  <span className="text-sm text-surface-400 w-8">#{r.rank}</span>
                  <span className="text-sm text-surface-200 flex-1">{r.model_name || r.model_key}</span>
                  {primary !== undefined && (
                    <>
                      <div className="w-32 h-2 bg-surface-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${Math.min(Math.abs(primary) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-emerald-300 w-20 text-right">
                        {label} {(primary * 100).toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Aucun modèle entraîné" />
        )}

        {result.failed && result.failed.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-red-300 mb-2">Modèles en échec</h4>
            <div className="space-y-1">
              {result.failed.map((f: any) => (
                <div key={f.model_key} className="text-xs text-red-200/70 p-2 bg-red-500/10 rounded">
                  {f.model_name}: {f.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShapTab({ result }: { result?: ShapResult }) {
  if (!result) return <EmptyState message="Pas de résultats SHAP disponibles" />;
  
  if (result.note) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-surface-50 mb-2">Explicabilité SHAP</h3>
            <p className="text-surface-300">{result.note}</p>
            <p className="text-sm text-surface-400 mt-2">
              Utilisez l'onglet "Modélisation" puis l'option SHAP pour générer les explications.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  const importance = result.global_importance || [];
  const waterfall = result.waterfall_example || [];
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          Importance des variables (SHAP)
        </h3>
        
        {importance.length > 0 ? (
          <div className="space-y-2">
            {importance.map((imp: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-surface-300 w-32 truncate">{imp.feature}</span>
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full"
                    style={{ width: `${Math.min(imp.mean_shap / importance[0].mean_shap * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-pink-300 w-20 text-right">{imp.mean_shap.toFixed(3)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucune importance SHAP disponible" />
        )}

        {waterfall.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-surface-300 mb-3">Exemple local (waterfall)</h4>
            <div className="space-y-2">
              {waterfall.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-surface-300 w-32 truncate">{item.feature}</span>
                  <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.shap_value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(Math.abs(item.shap_value) * 100, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-mono w-20 text-right ${item.shap_value >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {item.shap_value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightsTab({ result }: { result?: InsightsResult }) {
  if (!result) return <EmptyState message="Pas d'insights disponibles" />;
  
  // Insights is a placeholder in backend
  if ((result as any).note) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-surface-50 mb-2">Insights IA</h3>
            <p className="text-surface-300">{(result as any).note}</p>
          </div>
        </div>
      </div>
    );
  }
  
  const insights = result.insights || [];
  
  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-400" />
          Insights générés
        </h3>
        
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight: any, i: number) => (
              <div key={i} className={`p-3 rounded-lg border ${
                insight.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                insight.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                insight.severity === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
                'bg-blue-500/10 border-blue-500/30'
              }`}>
                <h4 className="text-sm font-medium text-surface-200">{insight.title}</h4>
                <p className="text-sm text-surface-300 mt-1">{insight.message}</p>
                {insight.suggestion && (
                  <p className="text-xs text-surface-400 mt-2">{insight.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucun insight généré" />
        )}
      </div>
    </div>
  );
}

function ReportTab({ format, setFormat, onDownload, isGenerating, hasResults }: {
  format: 'pdf' | 'docx';
  setFormat: (f: 'pdf' | 'docx') => void;
  onDownload: () => void;
  isGenerating: boolean;
  hasResults: boolean;
}) {
  return (
    <div className="card overflow-hidden !p-0">
      <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-orange-500/[0.08] to-red-500/[0.04]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-400/20 blur-lg rounded-full" />
            <FileText className="w-5 h-5 text-orange-400 relative z-10" />
          </div>
          <h3 className="text-sm font-bold text-strong">Generation de rapport professionnel</h3>
        </div>
        <p className="text-xs text-muted mt-1.5">
          Telechargez un rapport complet au format PDF ou Word avec tous les resultats, graphiques et insights.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Format de sortie</p>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('pdf')}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                format === 'pdf'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-default'
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setFormat('docx')}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                format === 'docx'
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-default'
              }`}
            >
              Word (DOCX)
            </button>
          </div>
        </div>

        <button
          onClick={onDownload}
          disabled={isGenerating || !hasResults}
          className="btn-primary w-full text-sm py-3"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Generation en cours...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Telecharger le rapport {format.toUpperCase()}
            </>
          )}
        </button>

        {!hasResults && (
          <p className="text-xs text-amber-400 text-center">
            Executez d'abord le pipeline pour generer un rapport
          </p>
        )}
      </div>
    </div>
  );
}

// === Type Definitions ===

interface CleaningResult {
  actions?: Array<{ action: string; removed?: number; n_imputed?: number; dropped?: string[] }>;
  duplicates_removed?: number;
  missing_imputed?: number;
  columns_cleaned?: number;
  outliers_treated?: number;
  before_rows?: number;
  after_rows?: number;
  before_cols?: number;
  after_cols?: number;
  shape_before?: { rows: number; columns: number };
  shape_after?: { rows: number; columns: number };
  logs?: any[];
}

interface DescriptiveResult {
  statistics?: Record<string, any>;
  stats?: Record<string, any>;
  distributions?: Record<string, any>;
}

interface CorrelationResult {
  matrix?: Record<string, Record<string, number>>;
  correlations?: Record<string, Record<string, number>>;
  significant_pairs?: Array<{ var1: string; var2: string; coefficient: number; strength: string }>;
}

interface ModelResult {
  ranking: Array<{
    rank: number;
    model_key: string;
    model_name: string;
    metrics: Record<string, number>;
    cv_scores?: { mean: number; std?: number };
    feature_importance?: Array<{ feature: string; importance: number }>;
  }>;
  best_model_key?: string;
  failed?: Array<{ model_key: string; model_name: string; error: string }>;
  data_split?: {
    train_size: number;
    test_size: number;
    features?: string[];
  };
}

interface ShapResult {
  global_importance?: Array<{ feature: string; mean_shap: number }>;
  waterfall_example?: Array<{ feature: string; shap_value: number }>;
  note?: string;
  source?: string;
  model_name?: string;
  n_features?: number;
}

interface InsightsResult {
  insights: Array<{
    title: string;
    message: string;
    severity: string;
    suggestion?: string;
  }>;
  summary?: Record<string, number>;
}

interface TransformRecommendation {
  column: string;
  recommended_transform: string;
  rationale: string;
}

interface TransformAppliedResult {
  transformations?: Array<{ column: string; transform: string }>;
}
