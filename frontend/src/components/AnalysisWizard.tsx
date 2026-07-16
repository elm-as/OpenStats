import { useState, useMemo, useRef } from 'react';
import {
  useGetCapabilitiesQuery,
  useSetExcludedColumnsMutation,
  useRunAnalysisMutation,
  useRunTestMutation,
  useTrainModelsMutation,
  api,
  type StationarityResult,
} from '../store/api';
import type {
  AnalysisCapability,
  DescriptiveStats,
  CorrelationResult,
  TestResult,
  ModelResults,
} from '../types';
import { FeatureImportance } from './viz';
import ReactPlotly from 'react-plotly.js';
const Plot = (ReactPlotly as any).default || ReactPlotly;
import { DARK_TEMPLATE, DEFAULT_CONFIG } from './viz/PlotlyBase';
import {
  BarChart3, TrendingUp, AlertTriangle, GitCompare, Layers, PieChart,
  Link2, Grid3X3, Brain, ChevronRight, ChevronLeft, CheckCircle2,
  Lock, Hash, Tag, ToggleLeft, Clock, Sparkles, Info, ArrowLeft,
  Trophy, Target, Zap, Activity, EyeOff, Eye, Settings2, ListFilter,
  LineChart as LineChartIcon,
} from 'lucide-react';
import ChartBuilder from './ChartBuilder';
import TimeSeriesPanel from './TimeSeriesPanel';
import MultivariateTimeSeriesPanel from './MultivariateTimeSeriesPanel';
import TransformPanel from './TransformPanel';
import FactorAnalysisPanel from './FactorAnalysisPanel';
import SimulationPanel from './SimulationPanel';
import ScenarioBuilder from './ScenarioBuilder';
import ExtensionPanel from './ExtensionPanel';

interface Props {
  datasetId: string;
}

type WizardStep = 'overview' | 'select' | 'configure' | 'results';

const CATEGORY_META: Record<string, { label: string; icon: typeof BarChart3; color: string; bg: string }> = {
  descriptive: { label: 'Statistiques descriptives', icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
  correlation: { label: 'Corrélations', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  diagnostic: { label: 'Diagnostics', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  hypothesis: { label: 'Tests d\'hypothèses', icon: GitCompare, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  transformation: { label: 'Transformations', icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  factorielle: { label: 'Analyse factorielle', icon: Layers, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200' },
  modeling: { label: 'Modélisation', icon: Brain, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  simulation: { label: 'Simulation', icon: Target, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
  timeseries: { label: 'Séries temporelles', icon: TrendingUp, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
  visualization: { label: 'Visualisation', icon: LineChartIcon, color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
  extension: { label: 'Extensions IA', icon: Sparkles, color: 'text-accent-500', bg: 'bg-accent-500/10 border-accent-500/20' },
};

const ICON_MAP: Record<string, typeof BarChart3> = {
  bar_chart: BarChart3,
  pie_chart: PieChart,
  trending_up: TrendingUp,
  alert_triangle: AlertTriangle,
  git_compare: GitCompare,
  link: Link2,
  grid: Grid3X3,
  layers: Layers,
};

export default function AnalysisWizard({ datasetId }: Props) {
  const { data: capabilities, isLoading: loadingCaps, refetch: refetchCapabilities } = useGetCapabilitiesQuery(datasetId);
  const [setExcludedColumns] = useSetExcludedColumnsMutation();
  const [runAnalysis, { isLoading: analyzing }] = useRunAnalysisMutation();
  const [runTest, { isLoading: testing }] = useRunTestMutation();
  const [runStationarity, { isLoading: testingStationarity }] = api.useRunStationarityMutation();
  const [trainModels, { isLoading: training }] = useTrainModelsMutation();

  const [wizardStep, setWizardStep] = useState<WizardStep>('overview');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisCapability | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const wizardRef = useRef<HTMLDivElement>(null);

  const { data: pipelineDetection } = api.useDetectPipelineQuery({ id: datasetId });
  const suggestedTarget = pipelineDetection?.profile?.suggested_target ?? null;
  const candidateTargets = pipelineDetection?.profile?.candidate_targets ?? [];

  // Results states
  const [descriptiveStats, setDescriptiveStats] = useState<DescriptiveStats | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult | null>(null);
  const [vif, setVif] = useState<{ variable: string; vif: number; multicollinearity: string }[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [stationarityResult, setStationarityResult] = useState<StationarityResult | null>(null);
  const [modelResults, setModelResults] = useState<ModelResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group analyses by category
  const grouped = useMemo(() => {
    if (!capabilities) return {};
    const groups: Record<string, AnalysisCapability[]> = {};
    for (const a of capabilities.analyses) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    }
    return groups;
  }, [capabilities]);

  const availableCount = capabilities?.analyses.filter((a) => a.available).length ?? 0;
  const totalCount = capabilities?.analyses.length ?? 0;

  // All columns from capabilities (both active and excluded)
  const allColumns = useMemo(() => {
    if (!capabilities) return [];
    const cols = new Set<string>();
    for (const list of Object.values(capabilities.columns)) {
      for (const c of list) cols.add(c);
    }
    // Also add excluded columns so they appear in the filter
    for (const c of capabilities.excluded_columns || []) cols.add(c);
    return Array.from(cols);
  }, [capabilities]);

  const excludedSet = useMemo(
    () => new Set(capabilities?.excluded_columns || []),
    [capabilities],
  );

  const handleToggleColumn = async (col: string) => {
    const currentExcluded = capabilities?.excluded_columns || [];
    const newExcluded = excludedSet.has(col)
      ? currentExcluded.filter((c) => c !== col)
      : [...currentExcluded, col];
    await setExcludedColumns({ id: datasetId, excluded_columns: newExcluded });
    refetchCapabilities();
  };

  const handleExcludeAll = async () => {
    await setExcludedColumns({ id: datasetId, excluded_columns: allColumns });
    refetchCapabilities();
  };

  const handleIncludeAll = async () => {
    await setExcludedColumns({ id: datasetId, excluded_columns: [] });
    refetchCapabilities();
  };

  const handleSelectAnalysis = (analysis: AnalysisCapability) => {
    if (!analysis.available) return;
    setSelectedAnalysis(analysis);
    setConfigValues({});
    setSelectedModels([]);
    setError(null);
    setTestResult(null);
    // Chart builder and other self-contained panels skip to results directly
    if (analysis.key === 'chart_builder' || analysis.key === 'transforms'
        || analysis.key === 'pca' || analysis.key === 'ca' || analysis.key === 'mca'
        || analysis.key === 'simulation' || analysis.key === 'user_extension') {
      setWizardStep('results');
      return;
    }
    // Skip configure step if no config needed
    if (analysis.config_fields && analysis.config_fields.length > 0) {
      setWizardStep('configure');
    } else if (analysis.category === 'modeling') {
      setWizardStep('configure');
    } else {
      // Auto-execute
      executeAnalysis(analysis, {});
    }
  };

  const executeAnalysis = async (analysis: AnalysisCapability, config: Record<string, string>) => {
    setError(null);
    setWizardStep('results');

    try {
      if (analysis.key === 'descriptive_numeric' || analysis.key === 'descriptive_categorical') {
        const result = await runAnalysis(datasetId).unwrap();
        setDescriptiveStats(result.descriptive_stats as DescriptiveStats);
        setCorrelations(null);
        setVif([]);
      } else if (analysis.key === 'correlation_pearson' || analysis.key === 'correlation_spearman') {
        const result = await runAnalysis(datasetId).unwrap();
        const method = analysis.key === 'correlation_pearson' ? 'pearson' : 'spearman';
        setCorrelations((result.correlations as Record<string, CorrelationResult>)?.[method] || null);
        setDescriptiveStats(null);
        setVif([]);
      } else if (analysis.key === 'vif') {
        const result = await runAnalysis(datasetId).unwrap();
        setVif(result.vif as typeof vif);
        setDescriptiveStats(null);
        setCorrelations(null);
      } else if (analysis.key === 'test_compare_means') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'compare_means', group_col: config.group_col, value_col: config.value_col },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_correlation') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'correlation', col1: config.col1, col2: config.col2 },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_independence') {
        const result = await runTest({
          id: datasetId,
          config: { test_type: 'independence', col1: config.col1, col2: config.col2 },
        }).unwrap();
        setTestResult(result);
      } else if (analysis.key === 'test_stationarity') {
        const result = await runStationarity({ id: datasetId, col: config.col }).unwrap();
        setStationarityResult(result);
        setTestResult(null);
      } else if (analysis.key.startsWith('modeling_')) {
        const targetCol = config.target_column;
        if (!targetCol) { setError('Variable cible requise'); return; }
        const res = await trainModels({
          id: datasetId,
          target_column: targetCol,
          models: selectedModels.length > 0 ? selectedModels : undefined,
        }).unwrap();
        setModelResults(res);
      } else if (analysis.key === 'timeseries' || analysis.key === 'timeseries_multivariate') {
        // Time series panels have their own UI; just go to results
        setWizardStep('results');
        return;
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
      setWizardStep('results');
    }
  };

  const handleConfigure = () => {
    if (!selectedAnalysis) return;

    // Validation
    if (selectedAnalysis.config_fields) {
      for (const field of selectedAnalysis.config_fields) {
        if (!configValues[field.key]) {
          setError(`Veuillez sélectionner : ${field.label}`);
          return;
        }
        // Multiselect: need at least 2 values for value_cols
        if (field.type === 'multiselect') {
          const vals = configValues[field.key].split(',').filter(Boolean);
          if (vals.length < 2) {
            setError(`Veuillez sélectionner au moins 2 options pour : ${field.label}`);
            return;
          }
        }
      }
      // Validate different columns for correlation/independence tests
      if (
        (selectedAnalysis.key === 'test_correlation' || selectedAnalysis.key === 'test_independence') &&
        configValues.col1 === configValues.col2
      ) {
        setError('Les deux variables doivent être différentes');
        return;
      }
    }

    if (selectedAnalysis.category === 'modeling' && !configValues.target_column) {
      setError('Veuillez sélectionner la variable cible');
      return;
    }

    setError(null);
    executeAnalysis(selectedAnalysis, configValues);
  };

  const resetWizard = () => {
    setWizardStep('overview');
    setSelectedAnalysis(null);
    setConfigValues({});
    setSelectedModels([]);
    setError(null);
    setTestResult(null);
    setStationarityResult(null);
    setModelResults(null);
    setSelectedCategory(null);
  };

  const goToSelect = (category?: string) => {
    setSelectedCategory(category ?? null);
    setWizardStep('select');
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const goToCategory = (catKey: string) => {
    const analyses = grouped[catKey];
    if (!analyses || analyses.length === 0) return;
    const firstAvailable = analyses.find((a) => a.available);
    if (!firstAvailable) return;
    // If modeling: go straight to configure step
    if (catKey === 'modeling') {
      setSelectedAnalysis(firstAvailable);
      setConfigValues(
        suggestedTarget ? { target_column: suggestedTarget } : {}
      );
      setSelectedModels([]);
      setError(null);
      setTestResult(null);
      setWizardStep('configure');
    } else {
      goToSelect(catKey);
    }
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  if (loadingCaps) {
    return (
      <div className="card p-12 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
        <p className="text-surface-400 mt-4">Analyse des types de données...</p>
      </div>
    );
  }

  if (!capabilities) {
    return <div className="card p-8 text-center text-red-500">Impossible de charger les capacités d'analyse</div>;
  }

  return (
    <div className="space-y-6" ref={wizardRef}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={resetWizard} className="text-primary-600 hover:underline font-medium">
          Analyses
        </button>
        {wizardStep === 'select' && (
          <>
            <ChevronRight className="w-3 h-3 text-surface-500" />
            <span className="text-surface-50 font-medium">
              {selectedCategory ? (CATEGORY_META[selectedCategory]?.label ?? 'Sélection') : 'Sélection'}
            </span>
          </>
        )}
        {(wizardStep === 'configure' || wizardStep === 'results') && !selectedCategory && (
          <>
            <ChevronRight className="w-3 h-3 text-surface-500" />
            <button
              onClick={() => goToSelect()}
              className="text-primary-600 hover:underline"
            >
              Sélection
            </button>
          </>
        )}
        {(wizardStep === 'configure' || wizardStep === 'results') && selectedAnalysis && (
          <>
            <ChevronRight className="w-3 h-3 text-surface-500" />
            <span className={`${wizardStep === 'configure' ? 'text-gray-900 font-medium' : 'text-primary-600 hover:underline cursor-pointer'}`}>
              {selectedAnalysis.label}
            </span>
          </>
        )}
        {wizardStep === 'results' && (
          <>
            <ChevronRight className="w-3 h-3 text-surface-500" />
            <span className="text-gray-900 font-medium">Résultats</span>
          </>
        )}
      </div>

      {/* ═══════════════ STEP: OVERVIEW ═══════════════ */}
      {wizardStep === 'overview' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-600" />
                Assistant d'Analyse
              </h2>
              <p className="text-sm text-surface-400 mt-1">
                {availableCount} analyse(s) disponible(s) sur {totalCount} — basé sur vos types de données
                {(capabilities.summary.excluded_count ?? 0) > 0 && (
                  <span className="text-amber-600 ml-1">
                    ({capabilities.summary.excluded_count} colonne(s) exclue(s))
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setShowColumnFilter(!showColumnFilter)}
              className={`btn-secondary flex items-center gap-2 text-sm ${showColumnFilter ? 'bg-primary-50 border-primary-300' : ''}`}
            >
              <ListFilter className="w-4 h-4" />
              Filtrer les colonnes
              {(capabilities.summary.excluded_count ?? 0) > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {capabilities.summary.excluded_count}
                </span>
              )}
            </button>
          </div>

          {/* Column Filter Panel */}
          {showColumnFilter && (
            <div className="card border-primary-200 bg-primary-50/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary-600" />
                  Sélection des colonnes
                </h3>
                <div className="flex gap-2">
                  <button onClick={handleIncludeAll} className="text-xs text-primary-600 hover:underline">
                    Tout inclure
                  </button>
                  <span className="text-surface-500">|</span>
                  <button onClick={handleExcludeAll} className="text-xs text-red-500 hover:underline">
                    Tout exclure
                  </button>
                </div>
              </div>
              <p className="text-xs text-surface-400 mb-3">
                Décochez les colonnes que vous souhaitez exclure des analyses et de la modélisation.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {allColumns.map((col) => {
                  const isExcluded = excludedSet.has(col);
                  return (
                    <label
                      key={col}
                      className={`flex items-center gap-2 text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                        isExcluded ? 'bg-surface-800 text-surface-500' : 'hover:bg-white text-surface-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => handleToggleColumn(col)}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <span className="truncate">{col}</span>
                      {isExcluded && <EyeOff className="w-3 h-3 text-surface-500 flex-shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Data Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <TypeSummaryCard icon={Hash} label="Numériques" count={capabilities.summary.numeric_count} color="blue" />
            <TypeSummaryCard icon={Hash} label="Discrètes" count={capabilities.summary.discrete_count ?? 0} color="cyan" />
            <TypeSummaryCard icon={Tag} label="Catégorielles" count={capabilities.summary.categorical_count} color="amber" />
            <TypeSummaryCard icon={ToggleLeft} label="Binaires" count={capabilities.summary.binary_count} color="green" />
            <TypeSummaryCard icon={Clock} label="Temporelles" count={capabilities.summary.temporal_count} color="purple" />
          </div>

          {/* Categories overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
              const analyses = grouped[catKey] || [];
              const availableInCat = analyses.filter((a) => a.available).length;
              const Icon = meta.icon;

              return (
                <button
                  key={catKey}
                  onClick={() => goToCategory(catKey)}
                  disabled={availableInCat === 0}
                  className={`card text-left transition-all hover:shadow-md ${
                    availableInCat > 0
                      ? 'cursor-pointer hover:border-primary-300'
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${meta.bg}`}>
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                      <p className="text-xs text-surface-400 mt-1">
                        {availableInCat}/{analyses.length} analyse(s) disponible(s)
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {analyses.map((a) => (
                          <span
                            key={a.key}
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              a.available
                                ? 'bg-green-100 text-green-700'
                                : 'bg-surface-800 text-surface-500 line-through'
                            }`}
                          >
                            {a.available ? 'OK' : 'N/A'} {a.label.split('(')[0].split('—')[0].trim().slice(0, 25)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {availableInCat > 0 && <ChevronRight className="w-4 h-4 text-surface-500 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={() => setWizardStep('select')} className="btn-primary flex items-center gap-2 w-full justify-center">
            Voir toutes les analyses disponibles <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* ═══════════════ STEP: SELECT ═══════════════ */}
      {wizardStep === 'select' && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Choisir une analyse</h2>
              <p className="text-sm text-surface-400 mt-1">
                Les analyses grisées ne sont pas applicables à vos données
              </p>
            </div>
            <button onClick={() => { setSelectedCategory(null); setWizardStep('overview'); }} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          </div>

          {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
            const analyses = grouped[catKey];
            if (!analyses || analyses.length === 0) return null;
            if (selectedCategory && catKey !== selectedCategory) return null;
            const Icon = meta.icon;

            return (
              <div key={catKey}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <h3 className="font-semibold text-surface-100">{meta.label}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {analyses.map((analysis) => {
                    const AIcon = ICON_MAP[analysis.icon] || BarChart3;
                    return (
                      <button
                        key={analysis.key}
                        onClick={() => handleSelectAnalysis(analysis)}
                        disabled={!analysis.available}
                        className={`card text-left transition-all p-4 ${
                          analysis.available
                            ? 'hover:shadow-md hover:border-primary-300 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed bg-surface-900'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg ${analysis.available ? meta.bg : 'bg-surface-800 border-gray-200'}`}>
                            {analysis.available ? (
                              <AIcon className={`w-4 h-4 ${meta.color}`} />
                            ) : (
                              <Lock className="w-4 h-4 text-surface-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium text-sm ${analysis.available ? 'text-gray-900' : 'text-surface-500'}`}>
                              {analysis.label}
                            </h4>
                            <p className="text-xs text-surface-400 mt-1 line-clamp-2">{analysis.description}</p>
                            <div className="mt-2 flex items-center gap-1.5">
                              <Info className="w-3 h-3 text-surface-500 flex-shrink-0" />
                              <span className={`text-xs ${analysis.available ? 'text-green-600' : 'text-red-500'}`}>
                                {analysis.available
                                  ? `Prérequis remplis : ${analysis.requires}`
                                  : analysis.reason || `Prérequis non remplis : ${analysis.requires}`
                                }
                              </span>
                            </div>
                          </div>
                          {analysis.available && <ChevronRight className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ═══════════════ STEP: CONFIGURE ═══════════════ */}
      {wizardStep === 'configure' && selectedAnalysis && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedAnalysis.label}</h2>
              <p className="text-sm text-surface-400 mt-1">{selectedAnalysis.description}</p>
            </div>
            <button onClick={() => selectedCategory ? goToSelect(selectedCategory) : resetWizard()} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Configuration</h3>

            {/* Hypothesis test config */}
            {selectedAnalysis.config_fields && selectedAnalysis.config_fields.length > 0 && (
              <div className="space-y-4">
                {selectedAnalysis.config_fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                    </label>
                    {field.type === 'multiselect' ? (
                      <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                        {field.options.length === 0 && (
                          <p className="text-xs text-surface-500">Aucune option disponible</p>
                        )}
                        {field.options.map((opt) => {
                          const selected = (configValues[field.key] || '').split(',').filter(Boolean);
                          const isChecked = selected.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-surface-900">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...selected, opt]
                                    : selected.filter((s) => s !== opt);
                                  setConfigValues({ ...configValues, [field.key]: next.join(',') });
                                }}
                                className="rounded border-gray-300 text-primary-600"
                              />
                              {opt}
                            </label>
                          );
                        })}
                        {(configValues[field.key] || '').split(',').filter(Boolean).length > 0 && (
                          <p className="text-xs text-primary-600 mt-1">
                            {(configValues[field.key] || '').split(',').filter(Boolean).length} sélectionnée(s)
                          </p>
                        )}
                      </div>
                    ) : (
                      <select
                        value={configValues[field.key] || ''}
                        onChange={(e) => setConfigValues({ ...configValues, [field.key]: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        title={field.key}
                      >
                        <option value="">Sélectionner...</option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stationarity insight badge for timeseries analyses */}
            {(selectedAnalysis.key === 'timeseries' || selectedAnalysis.key === 'timeseries_multivariate') &&
              pipelineDetection?.profile?.stationarity_summary && pipelineDetection.profile.stationarity_summary !== 'unknown' && (
              <StationarityBadge
                summary={pipelineDetection.profile.stationarity_summary}
                orders={pipelineDetection.profile.integration_orders ?? {}}
                cointegrationLikely={pipelineDetection.profile.cointegration_likely ?? false}
                configCol={configValues.value_col ?? configValues.value_cols?.split(',')[0]}
              />
            )}

            {/* Modeling config */}
            {selectedAnalysis.category === 'modeling' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variable cible (Y)
                  </label>
                  {candidateTargets.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className="text-xs text-surface-400 self-center">Suggestions IA :</span>
                      {candidateTargets.slice(0, 5).map((c) => (
                        <button
                          key={c.column}
                          type="button"
                          onClick={() => setConfigValues({ ...configValues, target_column: c.column })}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            configValues.target_column === c.column
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100'
                          }`}
                        >
                          {c.column}
                          <span className="ml-1 opacity-60">{c.type}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    value={configValues.target_column || ''}
                    onChange={(e) => setConfigValues({ ...configValues, target_column: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    title="Variable cible"
                  >
                    <option value="">Sélectionner la variable à prédire...</option>
                    {(selectedAnalysis.applicable_columns || []).map((col) => (
                      <option key={col} value={col}>
                        {col}
                        {capabilities?.column_groups[col] ? ` (${capabilities.column_groups[col]} classes)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Algorithmes (vide = tous)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {getModelsForType(selectedAnalysis.key).map((m) => (
                      <label key={m.key} className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-surface-900">
                        <input
                          type="checkbox"
                          checked={selectedModels.includes(m.key)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedModels([...selectedModels, m.key]);
                            else setSelectedModels(selectedModels.filter((k) => k !== m.key));
                          }}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={() => selectedCategory ? goToSelect(selectedCategory) : resetWizard()} className="btn-secondary flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              <button
                onClick={handleConfigure}
                disabled={analyzing || testing || training || testingStationarity}
                className="btn-primary flex items-center gap-2"
              >
                {(analyzing || testing || training || testingStationarity) ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Calcul en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Lancer l'analyse
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════ STEP: RESULTS ═══════════════ */}
      {wizardStep === 'results' && selectedAnalysis && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                {selectedAnalysis.label}
              </h2>
              <p className="text-sm text-surface-400 mt-1">Résultats de l'analyse</p>
            </div>
            <button onClick={resetWizard} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowLeft className="w-4 h-4" /> Nouvelle analyse
            </button>
          </div>

          {(analyzing || testing || training || testingStationarity) && (
            <div className="card p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto" />
              <p className="text-surface-400 mt-4">Calcul en cours...</p>
            </div>
          )}

          {error && !analyzing && !testing && !training && !testingStationarity && (
            <div className="card p-6 bg-red-50 border-red-200">
              <p className="text-red-700">{error}</p>
              <button onClick={resetWizard} className="mt-3 text-sm text-red-600 underline">
                Essayer une autre analyse
              </button>
            </div>
          )}

          {/* Descriptive stats results */}
          {descriptiveStats && selectedAnalysis.key.startsWith('descriptive') && (
            <DescriptiveResults stats={descriptiveStats} type={selectedAnalysis.key} />
          )}

          {/* Correlation results */}
          {correlations && selectedAnalysis.key.startsWith('correlation_') && (
            <CorrelationResults correlations={correlations} />
          )}

          {/* VIF results */}
          {vif.length > 0 && selectedAnalysis.key === 'vif' && (
            <VifResults vif={vif} />
          )}

          {/* Stationarity results */}
          {stationarityResult && selectedAnalysis.key === 'test_stationarity' && (
            <StationarityResults result={stationarityResult} />
          )}

          {/* Hypothesis test results */}
          {testResult && selectedAnalysis.key.startsWith('test_') && selectedAnalysis.key !== 'test_stationarity' && (
            <HypothesisTestResults result={testResult} config={configValues} />
          )}

          {/* Model results */}
          {modelResults && selectedAnalysis.key.startsWith('modeling_') && (
            <ModelingResults results={modelResults} />
          )}

          {/* Time series (univarié) */}
          {selectedAnalysis.key === 'timeseries' && capabilities && (
            <TimeSeriesPanel
              datasetId={datasetId}
              capabilities={capabilities}
              configValues={configValues}
              onBack={resetWizard}
            />
          )}

          {/* Time series (multivarié — VAR / VECM) */}
          {selectedAnalysis.key === 'timeseries_multivariate' && capabilities && (
            <MultivariateTimeSeriesPanel
              datasetId={datasetId}
              capabilities={capabilities}
              configValues={configValues}
              onBack={resetWizard}
            />
          )}

          {/* Transformations */}
          {selectedAnalysis.key === 'transforms' && (
            <TransformPanel
              datasetId={datasetId}
              onTransformApplied={() => refetchCapabilities()}
            />
          )}

          {/* Analyse factorielle (ACP / AFC / ACM) */}
          {(selectedAnalysis.key === 'pca' || selectedAnalysis.key === 'ca' || selectedAnalysis.key === 'mca') && capabilities && (
            <FactorAnalysisPanel
              datasetId={datasetId}
              capabilities={capabilities}
              onBack={resetWizard}
              initialMethod={selectedAnalysis.key}
            />
          )}

          {/* Simulation / Prédiction */}
          {selectedAnalysis.key === 'simulation' && (
            <SimulationPanel
              datasetId={datasetId}
              onBack={resetWizard}
            />
          )}

          {/* Scénarios et simulation avancée */}
          {selectedAnalysis.key === 'scenarios' && (
            <ScenarioBuilder
              datasetId={datasetId}
              onBack={resetWizard}
            />
          )}

          {/* Extensions IA */}
          {selectedAnalysis.key === 'user_extension' && (
            <ExtensionPanel datasetId={datasetId} />
          )}

          {/* Chart builder */}
          {selectedAnalysis.key === 'chart_builder' && capabilities && (
            <ChartBuilder
              datasetId={datasetId}
              capabilities={capabilities}
              onBack={resetWizard}
            />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════

function TypeSummaryCard({ icon: Icon, label, count, color }: {
  icon: typeof Hash; label: string; count: number; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <Icon className="w-5 h-5 mx-auto mb-1" />
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function DescriptiveResults({ stats, type }: { stats: DescriptiveStats; type: string }) {
  const isNumeric = type === 'descriptive_numeric';
  const entries = Object.entries(stats).filter(([, s]) =>
    isNumeric ? s.type === 'numeric' : s.type === 'categorical'
  );

  if (entries.length === 0) {
    return <div className="card p-6 text-center text-surface-400">Aucune variable de ce type trouvée</div>;
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-gray-900">
            {isNumeric ? 'Variables numériques' : 'Variables catégorielles'}
          </h3>
          <span className="badge bg-primary-100 text-primary-700">{entries.length} variable(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-900 border-b">
                <th className="text-left py-2 px-3 font-medium text-surface-400">Variable</th>
                {isNumeric ? (
                  <>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Moyenne</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Médiane</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Écart-type</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Asymétrie</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Kurtosis</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Nullité</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Cardinalité</th>
                    <th className="text-left py-2 px-3 font-medium text-surface-400">Mode</th>
                    <th className="text-right py-2 px-3 font-medium text-surface-400">Nullité</th>
                    <th className="text-left py-2 px-3 font-medium text-surface-400">Top valeurs</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map(([col, s]) => (
                <tr key={col} className="hover:bg-surface-900">
                  <td className="py-2 px-3 font-medium">{col}</td>
                  {isNumeric ? (
                    <>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.mean)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.median)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.std)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.skewness)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{fmt(s.kurtosis)}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-3 text-right font-mono text-xs">{s.cardinality ?? '—'}</td>
                      <td className="py-2 px-3 text-xs">{s.top_values ? Object.keys(s.top_values)[0] : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-xs">{(s.null_rate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-xs">
                        {s.top_values && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(s.top_values).slice(0, 5).map(([val, count]) => (
                              <span key={val} className="badge bg-surface-800 text-surface-400">
                                {val} ({count})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Null rate chart Plotly */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Taux de nullité</h3>
        <Plot
          data={[{
            x: entries.map(([, s]) => s.null_rate * 100),
            y: entries.map(([col]) => col.length > 25 ? col.slice(0, 25) + '…' : col),
            type: 'bar',
            orientation: 'h',
            marker: {
              color: entries.map(([, s]) =>
                s.null_rate >= 0.5 ? '#ef4444' : s.null_rate >= 0.2 ? '#f59e0b' : '#06b6d4',
              ),
              line: { color: 'rgba(255,255,255,0.1)', width: 0.5 },
            },
            hovertemplate: '<b>%{y}</b><br>%{x:.1f}%<extra></extra>',
          }]}
          layout={{
            ...DARK_TEMPLATE,
            autosize: true,
            xaxis: { ...DARK_TEMPLATE.xaxis, title: { text: 'Taux (%)', font: { color: '#dfe3ee' } }, range: [0, 100] },
            yaxis: { ...DARK_TEMPLATE.yaxis, automargin: true },
            margin: { l: 160, r: 20, t: 10, b: 50 },
          }}
          config={DEFAULT_CONFIG}
          style={{ width: '100%', height: Math.max(220, entries.length * 28 + 60) }}
          useResizeHandler
        />
      </div>
    </>
  );
}

function CorrelationResults({ correlations }: { correlations: CorrelationResult }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">
          Corrélations significatives ({correlations.method})
        </h3>
        <span className="badge bg-primary-100 text-primary-700">
          {correlations.significant_pairs.length} paire(s)
        </span>
      </div>
      {correlations.significant_pairs.length === 0 ? (
        <p className="text-surface-400 text-sm">Aucune corrélation significative (|r| &gt; 0.3) détectée</p>
      ) : (
        <div className="space-y-2">
          {correlations.significant_pairs.slice(0, 25).map((pair, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 bg-surface-900 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">{pair.var1}</span>
                <span className="text-surface-500 mx-2">↔</span>
                <span className="font-medium">{pair.var2}</span>
              </div>
              <div className="flex items-center gap-3">
                <CorrelationBar value={pair.coefficient} />
                <span className="font-mono text-sm w-16 text-right">{pair.coefficient.toFixed(3)}</span>
                <span className={`badge ${
                  pair.strength === 'fort' ? 'bg-red-100 text-red-800' :
                  pair.strength === 'modéré' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {pair.strength}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VifResults({ vif }: { vif: { variable: string; vif: number; multicollinearity: string }[] }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-gray-900">Facteur d'Inflation de la Variance (VIF)</h3>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
        <strong>Interprétation :</strong> VIF &lt; 5 = OK, 5–10 = multicolinéarité modérée, &gt; 10 = multicolinéarité sévère
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-900 border-b">
            <th className="text-left py-2 px-3">Variable</th>
            <th className="text-right py-2 px-3">VIF</th>
            <th className="text-left py-2 px-3">Diagnostic</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {vif.map((v) => (
            <tr key={v.variable} className="hover:bg-surface-900">
              <td className="py-2 px-3 font-medium">{v.variable}</td>
              <td className="py-2 px-3 text-right font-mono">{v.vif.toFixed(2)}</td>
              <td className="py-2 px-3">
                <span className={`badge ${
                  v.multicollinearity === 'severe' ? 'bg-red-100 text-red-800' :
                  v.multicollinearity === 'moderate' ? 'bg-amber-100 text-amber-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {v.multicollinearity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HypothesisTestResults({ result, config }: { result: TestResult; config: Record<string, string> }) {
  return (
    <div className="space-y-4">
      {/* Test info card */}
      <div className={`card border-l-4 ${result.significant ? 'border-l-green-500' : 'border-l-gray-400'}`}>
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">{result.test}</h3>
          <span className={`badge ${result.significant ? 'bg-green-100 text-green-800' : 'bg-surface-800 text-surface-400'}`}>
            {result.significant ? 'Significatif' : 'Non significatif'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Statistique</p>
            <p className="text-lg font-bold font-mono">{result.statistic.toFixed(4)}</p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">p-value</p>
            <p className={`text-lg font-bold font-mono ${result.p_value < 0.05 ? 'text-green-600' : 'text-surface-400'}`}>
              {result.p_value < 0.001 ? '< 0.001' : result.p_value.toFixed(4)}
            </p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Seuil α</p>
            <p className="text-lg font-bold font-mono">0.05</p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Décision</p>
            <p className={`text-sm font-bold ${result.significant ? 'text-green-600' : 'text-red-500'}`}>
              {result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'}
            </p>
          </div>
        </div>

        {/* Effect size */}
        {result.effect_size && Object.keys(result.effect_size).length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Taille d'effet</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.effect_size).map(([key, val]) => (
                <div key={key} className="text-sm bg-purple-50 px-3 py-1.5 rounded-lg">
                  <span className="text-purple-600 font-medium">{key}:</span>{' '}
                  <span className="font-mono">{typeof val === 'number' ? val.toFixed(4) : String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.interpretation && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>Interprétation :</strong> {result.interpretation}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelingResults({ results }: { results: ModelResults }) {
  return (
    <>
      {/* Ranking */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-gray-900">
            Classement des modèles ({results.task_type})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-900 border-b">
                <th className="text-center py-2 px-3 w-12">#</th>
                <th className="text-left py-2 px-3">Modèle</th>
                {results.task_type === 'regression' ? (
                  <>
                    <th className="text-right py-2 px-3">R²</th>
                    <th className="text-right py-2 px-3">RMSE</th>
                    <th className="text-right py-2 px-3">MAE</th>
                  </>
                ) : (
                  <>
                    <th className="text-right py-2 px-3">Accuracy</th>
                    <th className="text-right py-2 px-3">F1-Score</th>
                    <th className="text-right py-2 px-3">AUC-ROC</th>
                  </>
                )}
                <th className="text-right py-2 px-3">CV Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.ranking.map((r) => (
                <tr key={r.model_key} className={`hover:bg-surface-900 ${r.rank === 1 ? 'bg-amber-50' : ''}`}>
                  <td className="py-2.5 px-3 text-center">
                    {r.rank === 1 ? <Trophy className="w-4 h-4 text-amber-500 mx-auto" /> : r.rank}
                  </td>
                  <td className="py-2.5 px-3 font-medium">{r.model_name}</td>
                  {results.task_type === 'regression' ? (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.r2 as number)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.rmse as number)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.mae as number)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.accuracy as number)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.f1_weighted as number)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-xs">{fmtMetric(r.metrics.auc_roc as number)}</td>
                    </>
                  )}
                  <td className="py-2.5 px-3 text-right font-mono text-xs">{r.cv_scores.mean.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Importance */}
      {results.ranking[0]?.feature_importance?.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">
              Importance des variables — {results.ranking[0].model_name}
            </h3>
          </div>
          <FeatureImportance
            features={results.ranking[0].feature_importance.map(f => ({
              feature: f.feature,
              importance: f.importance,
            }))}
            topN={15}
          />
        </div>
      )}

      {/* SHAP */}
      {results.shap && results.shap.global_importance && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Explicabilité SHAP</h3>
          </div>
          <FeatureImportance
            features={results.shap.global_importance.map(s => ({
              feature: s.feature,
              importance: s.mean_shap,
            }))}
            topN={15}
            showSign
            xLabel="Impact SHAP moyen"
          />
        </div>
      )}

      {/* Failed models */}
      {results.failed.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-800 mb-2">Modèles en échec</h3>
          {results.failed.map((f, i) => (
            <p key={i} className="text-sm text-red-600">
              <span className="font-medium">{f.model_name}</span> : {f.error}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

function CorrelationBar({ value }: { value: number }) {
  const width = Math.abs(value) * 100;
  const color = value >= 0 ? '#3b82f6' : '#ef4444';
  return (
    <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}

function fmt(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(3);
}

function fmtMetric(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(4);
}

function getModelsForType(analysisKey: string) {
  const regression = [
    { key: 'linear_regression', label: 'Régression Linéaire' },
    { key: 'ridge', label: 'Ridge (L2)' },
    { key: 'lasso', label: 'Lasso (L1)' },
    { key: 'elastic_net', label: 'ElasticNet' },
    { key: 'random_forest', label: 'Random Forest' },
    { key: 'gradient_boosting', label: 'Gradient Boosting' },
    { key: 'xgboost', label: 'XGBoost' },
    { key: 'knn', label: 'KNN' },
    { key: 'svr', label: 'SVR' },
    { key: 'decision_tree', label: 'Arbre de Décision' },
  ];
  const classification = [
    { key: 'logistic_regression', label: 'Régression Logistique' },
    { key: 'random_forest', label: 'Random Forest' },
    { key: 'gradient_boosting', label: 'Gradient Boosting' },
    { key: 'xgboost', label: 'XGBoost' },
    { key: 'knn', label: 'KNN' },
    { key: 'svm', label: 'SVM' },
    { key: 'decision_tree', label: 'Arbre de Décision' },
    { key: 'lda', label: 'LDA' },
    { key: 'qda', label: 'QDA' },
    { key: 'adaboost', label: 'AdaBoost' },
  ];
  return analysisKey === 'modeling_regression' ? regression : classification;
}

function StationarityBadge({ summary, orders, cointegrationLikely, configCol }: {
  summary: string;
  orders: Record<string, { order: number; is_stationary: boolean; adf_p: number | null; kpss_p: number | null }>;
  cointegrationLikely: boolean;
  configCol?: string;
}) {
  const entries = Object.entries(orders);

  const META: Record<string, { bg: string; border: string; icon: string; title: string; rec: string }> = {
    all_stationary: {
      bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'OK',
      title: 'Toutes les séries sont stationnaires I(0)',
      rec: 'VAR en niveaux recommandé. ARIMA avec d=0.',
    },
    all_nonstationary: {
      bg: cointegrationLikely ? 'bg-indigo-50' : 'bg-amber-50',
      border: cointegrationLikely ? 'border-indigo-200' : 'border-amber-200',
      icon: cointegrationLikely ? 'COI' : 'WARN',
      title: cointegrationLikely
        ? `${entries.length} séries I(1) — cointégration probable`
        : `Séries non-stationnaires I(1)`,
      rec: cointegrationLikely
        ? 'VECM recommandé (test Johansen inclus). VAR en différences si cointégration rejetée.'
        : 'ARIMA avec d=1. VAR sur premières différences.',
    },
    mixed: {
      bg: 'bg-blue-50', border: 'border-blue-200', icon: '≈',
      title: 'Stationnarité mixte — I(0) et I(1) mélangés',
      rec: 'ARDL recommandé (robuste aux ordres mixtes).',
    },
  };

  const meta = META[summary] ?? META.all_nonstationary;
  const focusCol = configCol && orders[configCol];

  return (
    <div className={`mt-4 rounded-lg border p-3 ${meta.bg} ${meta.border}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{meta.title}</p>
          <p className="text-xs text-surface-400 mt-0.5">{meta.rec}</p>

          {/* Per-column orders */}
          {entries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entries.slice(0, 6).map(([col, info]) => (
                <span
                  key={col}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    info.order === 0
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : info.order === 1
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-red-100 border-red-300 text-red-700'
                  } ${col === configCol ? 'ring-1 ring-offset-1 ring-gray-400' : ''}`}
                >
                  {col} I({info.order})
                  {info.adf_p !== null && (
                    <span className="opacity-60 ml-1">p={info.adf_p?.toFixed(3)}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Focus on selected column */}
          {focusCol && focusCol.order > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              <strong>{configCol}</strong> est non-stationnaire I({focusCol.order}) —{' '}
              {focusCol.order === 1 ? 'ARIMA(d=1) sera utilisé automatiquement.' : `${focusCol.order} différenciations nécessaires.`}
            </p>
          )}
          {focusCol && focusCol.order === 0 && (
            <p className="text-xs text-emerald-700 mt-1.5">
              <strong>{configCol}</strong> est stationnaire — ARIMA(d=0)/SARIMA applicable directement.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StationarityResults({ result }: { result: import('../store/api').StationarityResult }) {
  const fmt = (v: number | undefined) => v !== undefined ? v.toFixed(4) : '—';
  const verdictColor = result.is_stationary ? 'border-l-green-500 bg-green-50' : 'border-l-orange-500 bg-orange-50';
  const verdictText = result.is_stationary ? 'Série stationnaire' : 'Série non-stationnaire';
  const verdictIcon = result.is_stationary ? 'OK' : 'WARN';

  const TestCard = ({ name, data, h0, h1 }: { name: string; data: any; h0: string; h1: string }) => {
    if (!data || data.error) return (
      <div className="card p-4 border border-red-200 bg-red-50">
        <p className="text-sm font-semibold text-red-700">{name}</p>
        <p className="text-xs text-red-500 mt-1">{data?.error ?? 'Erreur inconnue'}</p>
      </div>
    );
    const isSignificant = data.is_stationary;
    return (
      <div className={`card border-l-4 ${isSignificant ? 'border-l-green-500' : 'border-l-amber-400'}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">{name}</h4>
          <span className={`badge ${isSignificant ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
            {data.interpretation}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Statistique</p>
            <p className="font-mono font-bold">{fmt(data.statistic)}</p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">p-value</p>
            <p className={`font-mono font-bold ${isSignificant ? 'text-green-600' : 'text-amber-600'}`}>
              {data.p_value < 0.001 ? '< 0.001' : fmt(data.p_value)}
            </p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Lags utilisés</p>
            <p className="font-mono font-bold">{data.lags_used ?? '—'}</p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Observations</p>
            <p className="font-mono font-bold">{data.n_obs ?? result.n_obs}</p>
          </div>
        </div>
        {data.critical_values && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-surface-400">Valeurs critiques :</span>
            {Object.entries(data.critical_values).map(([k, v]: any) => (
              <span key={k} className="text-xs font-mono bg-surface-800 px-2 py-0.5 rounded">
                {k}: {typeof v === 'number' ? v.toFixed(3) : v}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-surface-400 space-y-0.5">
          <p><span className="font-medium">H₀ :</span> {h0}</p>
          <p><span className="font-medium">H₁ :</span> {h1}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Global verdict */}
      <div className={`card border-l-4 ${verdictColor}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{verdictIcon}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{result.column} — {verdictText}</h3>
            <p className="text-sm text-surface-400 mt-0.5">{result.conclusion}</p>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-2">{result.n_obs} observations analysées</p>
      </div>

      {/* ADF */}
      <TestCard
        name="Test ADF (Augmented Dickey-Fuller)"
        data={result.adf}
        h0="La série a une racine unitaire (non-stationnaire)"
        h1="La série est stationnaire (rejet de H₀ si p < 0.05)"
      />

      {/* KPSS */}
      <TestCard
        name="Test KPSS (Kwiatkowski-Phillips-Schmidt-Shin)"
        data={result.kpss}
        h0="La série est stationnaire"
        h1="La série a une racine unitaire (rejet de H₀ si p < 0.05)"
      />

      {/* Recommendation */}
      {!result.is_stationary && (
        <div className="card bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-1">Recommandation</p>
          <p className="text-sm text-blue-700">
            La série est non-stationnaire. Envisagez une différenciation (1ère ou 2ème ordre),
            une transformation logarithmique, ou utilisez des modèles adaptés (ARIMA avec d &gt; 0, VECM).
          </p>
        </div>
      )}
    </div>
  );
}
