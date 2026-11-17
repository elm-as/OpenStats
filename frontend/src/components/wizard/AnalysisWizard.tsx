import { useState, useMemo, useRef } from 'react';
import {
  useGetCapabilitiesQuery,
  useSetExcludedColumnsMutation,
  useDetectPipelineQuery,
} from '../../store/api';
import type { AnalysisCapability } from '../../types';
import { WizardBreadcrumb } from './WizardBreadcrumb';
import { WizardOverviewStep } from './WizardOverviewStep';
import { WizardSelectStep } from './WizardSelectStep';
import { WizardConfigureStep } from './WizardConfigureStep';
import { WizardResultsStep } from './WizardResultsStep';
import { useAnalysisExecutor } from './useAnalysisExecutor';
import type { WizardStep } from './WizardTypes';

interface Props {
  datasetId: string;
}

function validateAnalysisConfig(
  analysis: AnalysisCapability,
  configValues: Record<string, string>,
): string | null {
  for (const field of analysis.config_fields || []) {
    if (!field.optional && !configValues[field.key]) {
      return `Veuillez sélectionner : ${field.label}`;
    }
    if (field.type === 'multiselect' && configValues[field.key].split(',').filter(Boolean).length < 2) {
      return `Veuillez sélectionner au moins 2 options pour : ${field.label}`;
    }
  }
  const twoVarTest = analysis.key === 'test_correlation' || analysis.key === 'test_independence';
  if (twoVarTest && configValues.col1 === configValues.col2) {
    return 'Les deux variables doivent être différentes';
  }
  if (analysis.key.startsWith('modeling_') && !configValues.target_column) {
    return 'Veuillez sélectionner la variable cible';
  }
  return null;
}

export default function AnalysisWizard({ datasetId }: Props) {
  const {
    data: capabilities,
    isLoading: loadingCaps,
    refetch: refetchCapabilities,
  } = useGetCapabilitiesQuery(datasetId);
  const [setExcludedColumns] = useSetExcludedColumnsMutation();

  const [wizardStep, setWizardStep] = useState<WizardStep>('overview');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisCapability | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const wizardRef = useRef<HTMLDivElement>(null);

  const { data: pipelineDetection } = useDetectPipelineQuery({ id: datasetId });
  const suggestedTarget = pipelineDetection?.profile?.suggested_target ?? null;
  const candidateTargets = pipelineDetection?.profile?.candidate_targets ?? [];

  const {
    descriptiveStats,
    correlations,
    vif,
    testResult,
    stationarityResult,
    modelResults,
    advancedResult,
    error,
    setError,
    resetResults,
    executeAnalysis,
    isLoading,
  } = useAnalysisExecutor(datasetId);

  const grouped = useMemo(() => {
    if (!capabilities) return {};
    const groups: Record<string, AnalysisCapability[]> = {};
    for (const a of capabilities.analyses) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    }
    return groups;
  }, [capabilities]);

  const availableCount = capabilities?.analyses.filter(a => a.available).length ?? 0;
  const totalCount = capabilities?.analyses.length ?? 0;

  const allColumns = useMemo(() => {
    if (!capabilities) return [];
    const cols = new Set<string>();
    for (const list of Object.values(capabilities.columns)) {
      for (const c of list) cols.add(c);
    }
    for (const c of capabilities.excluded_columns || []) cols.add(c);
    return Array.from(cols);
  }, [capabilities]);

  const excludedSet = useMemo(
    () => new Set(capabilities?.excluded_columns || []),
    [capabilities]
  );

  const handleToggleColumn = async (col: string) => {
    const currentExcluded = capabilities?.excluded_columns || [];
    const newExcluded = excludedSet.has(col)
      ? currentExcluded.filter(c => c !== col)
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
    const defaults: Record<string, string> = {};
    for (const field of analysis.config_fields || []) {
      if (field.type !== 'select') continue;
      if (field.key === 'forecast_steps' && field.options.includes('10')) {
        defaults[field.key] = '10';
      } else if (field.key === 'method' && field.options.includes('psm')) {
        defaults[field.key] = 'psm';
      } else if (field.options.length === 1 && !field.optional) {
        defaults[field.key] = field.options[0];
      }
    }
    setSelectedAnalysis(analysis);
    setConfigValues(defaults);
    setSelectedModels([]);
    resetResults();
    if (
      analysis.key === 'chart_builder' ||
      analysis.key === 'transforms' ||
      analysis.key === 'pca' ||
      analysis.key === 'ca' ||
      analysis.key === 'mca' ||
      analysis.key === 'simulation' ||
      analysis.key === 'user_extension'
    ) {
      setWizardStep('results');
      return;
    }
    if (
      (analysis.config_fields && analysis.config_fields.length > 0) ||
      analysis.category === 'modeling'
    ) {
      setWizardStep('configure');
    } else {
      executeAnalysis({ analysis, config: {}, selectedModels, setWizardStep });
    }
  };

  const handleConfigure = () => {
    if (!selectedAnalysis) return;
    const validationError = validateAnalysisConfig(selectedAnalysis, configValues);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    executeAnalysis({ analysis: selectedAnalysis, config: configValues, selectedModels, setWizardStep });
  };

  const resetWizard = () => {
    setWizardStep('overview');
    setSelectedAnalysis(null);
    setConfigValues({});
    setSelectedModels([]);
    setSelectedCategory(null);
    resetResults();
  };

  const goToSelect = (category?: string) => {
    setSelectedCategory(category ?? null);
    setWizardStep('select');
    setTimeout(() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const goToCategory = (catKey: string) => {
    const analyses = grouped[catKey];
    if (!analyses || analyses.length === 0) return;
    const firstAvailable = analyses.find(a => a.available);
    if (!firstAvailable) return;
    if (catKey === 'modeling') {
      setSelectedAnalysis(firstAvailable);
      setConfigValues(suggestedTarget ? { target_column: suggestedTarget } : {});
      setSelectedModels([]);
      resetResults();
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
    return (
      <div className="card p-8 text-center text-red-500">
        Impossible de charger les capacités d'analyse
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={wizardRef}>
      <WizardBreadcrumb
        wizardStep={wizardStep}
        selectedCategory={selectedCategory}
        selectedAnalysis={selectedAnalysis}
        onReset={resetWizard}
        onGoToSelect={goToSelect}
      />

      {wizardStep === 'overview' && (
        <WizardOverviewStep
          capabilities={capabilities}
          availableCount={availableCount}
          totalCount={totalCount}
          showColumnFilter={showColumnFilter}
          setShowColumnFilter={setShowColumnFilter}
          allColumns={allColumns}
          excludedSet={excludedSet}
          onToggleColumn={handleToggleColumn}
          onIncludeAll={handleIncludeAll}
          onExcludeAll={handleExcludeAll}
          grouped={grouped}
          onGoToCategory={goToCategory}
          onViewAllAnalyses={() => setWizardStep('select')}
        />
      )}

      {wizardStep === 'select' && (
        <WizardSelectStep
          selectedCategory={selectedCategory}
          grouped={grouped}
          onSelectAnalysis={handleSelectAnalysis}
          onBack={() => {
            setSelectedCategory(null);
            setWizardStep('overview');
          }}
        />
      )}

      {wizardStep === 'configure' && selectedAnalysis && (
        <WizardConfigureStep
          selectedAnalysis={selectedAnalysis}
          selectedCategory={selectedCategory}
          configValues={configValues}
          setConfigValues={setConfigValues}
          selectedModels={selectedModels}
          setSelectedModels={setSelectedModels}
          candidateTargets={candidateTargets}
          capabilities={capabilities}
          allColumns={allColumns}
          excludedSet={excludedSet}
          pipelineDetection={pipelineDetection}
          error={error}
          isLoading={isLoading}
          onBack={() => (selectedCategory ? goToSelect(selectedCategory) : resetWizard())}
          onRun={handleConfigure}
        />
      )}

      {wizardStep === 'results' && selectedAnalysis && (
        <WizardResultsStep
          datasetId={datasetId}
          selectedAnalysis={selectedAnalysis}
          capabilities={capabilities}
          configValues={configValues}
          descriptiveStats={descriptiveStats}
          correlations={correlations}
          vif={vif}
          testResult={testResult}
          stationarityResult={stationarityResult}
          modelResults={modelResults}
          advancedResult={advancedResult}
          isLoading={isLoading}
          error={error}
          onReset={resetWizard}
          onRefetchCapabilities={refetchCapabilities}
        />
      )}
    </div>
  );
}
