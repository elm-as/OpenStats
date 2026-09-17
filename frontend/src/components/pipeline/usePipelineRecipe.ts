import { useState, useMemo } from 'react';
import { useBuildPipelineRecipeMutation } from '../../store/api';
import type { EditableStep } from './PipelineTypes';

export function usePipelineRecipe(
  datasetId: string,
  selectedTarget: string | null,
  selectedTaskType: string,
  selectedAnalyses: Set<string>,
  availableAnalyses: Array<{ key: string; label: string; description: string }>,
  profile: any,
  setWorkflowStage: (stage: 'configure' | 'pipeline' | 'results') => void
) {
  const [buildRecipe, { isLoading: isBuilding }] = useBuildPipelineRecipeMutation();
  const [editableSteps, setEditableSteps] = useState<EditableStep[]>([]);
  const [pipelineTitle, setPipelineTitle] = useState<string>('Pipeline Personnalisé');
  const [pipelineDesc, setPipelineDesc] = useState<string>('');
  const [pipelineWarnings, setPipelineWarnings] = useState<string[]>([]);
  const [showAddStepModal, setShowAddStepModal] = useState(false);

  const activeSteps = useMemo(() => editableSteps.filter(s => s.enabled), [editableSteps]);

  const handleGenerateCustomPipeline = async () => {
    try {
      const res = await buildRecipe({
        id: datasetId,
        target: selectedTarget ?? undefined,
        task_type: selectedTaskType,
        selected_analyses: Array.from(selectedAnalyses),
      }).unwrap();

      if (res.recipe) {
        setPipelineTitle(res.recipe.title);
        setPipelineDesc(res.recipe.description);
        setPipelineWarnings(res.recipe.warnings ?? []);
        const steps: EditableStep[] = res.recipe.steps.map((s: any) => ({
          ...s,
          enabled: true,
          isExpanded: false,
        }));
        setEditableSteps(steps);
        setWorkflowStage('pipeline');
      }
    } catch (err) {
      console.error('Erreur lors de la construction du pipeline:', err);
    }
  };

  const toggleStepEnabled = (index: number) => {
    setEditableSteps(prev => prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s)));
  };

  const toggleStepExpanded = (index: number) => {
    setEditableSteps(prev =>
      prev.map((s, i) => (i === index ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  };

  const removeStep = (index: number) => {
    setEditableSteps(prev => prev.filter((_, i) => i !== index));
  };

  const updateStepParam = (index: number, key: string, value: any) => {
    setEditableSteps(prev =>
      prev.map((s, i) => {
        if (i !== index) return s;
        return { ...s, params: { ...s.params, [key]: value } };
      })
    );
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setEditableSteps(prev => {
      const next = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const addStepFromCatalog = (analysisKey: string) => {
    const analysis = availableAnalyses.find(a => a.key === analysisKey);
    if (!analysis) return;

    let op = analysisKey;
    if (analysisKey === 'timeseries_forecast') op = 'timeseries';
    if (analysisKey === 'timeseries_multivariate') op = 'timeseries_multivariate';
    if (analysisKey === 'stationarity') op = 'timeseries_stationarity';
    if (analysisKey === 'cointegration') op = 'timeseries_cointegration';

    const newStep: EditableStep = {
      key: `${op}_${Date.now().toString().slice(-4)}`,
      operation: op,
      label: analysis.label,
      rationale: analysis.description,
      params: {
        target_col: selectedTarget,
        date_col: profile?.temporal_cols?.[0] || 'date',
        columns: profile?.numeric_cols || [],
        forecast_steps: 10,
        model_keys: ['linear_regression', 'ridge', 'random_forest', 'gradient_boosting'],
      },
      optional: false,
      enabled: true,
      isExpanded: true,
    };

    setEditableSteps(prev => [...prev, newStep]);
    setShowAddStepModal(false);
  };

  return {
    editableSteps,
    activeSteps,
    pipelineTitle,
    pipelineDesc,
    pipelineWarnings,
    showAddStepModal,
    setShowAddStepModal,
    isBuilding,
    handleGenerateCustomPipeline,
    toggleStepEnabled,
    toggleStepExpanded,
    removeStep,
    updateStepParam,
    moveStep,
    addStepFromCatalog,
  };
}
