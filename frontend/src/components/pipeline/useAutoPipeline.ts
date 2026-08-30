import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useDetectPipelineQuery,
  useExecuteAutoPipelineMutation,
  useGenerateCanvasFromRecipeMutation,
} from '../../store/api';
import { usePipelineSelection } from './usePipelineSelection';
import { usePipelineRecipe } from './usePipelineRecipe';

export function useAutoPipeline(datasetId: string, onComplete?: (execution?: any) => void) {
  const navigate = useNavigate();
  const [generateCanvas, { isLoading: isGeneratingCanvas }] =
    useGenerateCanvasFromRecipeMutation();

  const [workflowStage, setWorkflowStage] = useState<'configure' | 'pipeline' | 'results'>('configure');
  const [executed, setExecuted] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  const { data: detection, isLoading: isDetecting } = useDetectPipelineQuery({ id: datasetId });
  const [execute, { data: execResult, isLoading: isExecuting }] = useExecuteAutoPipelineMutation();

  const profile = detection?.profile;
  const execution = execResult?.execution;

  const selection = usePipelineSelection(profile);

  const recipe = usePipelineRecipe(
    datasetId,
    selection.selectedTarget,
    selection.selectedTaskType,
    selection.selectedAnalyses,
    selection.availableAnalyses,
    profile,
    setWorkflowStage
  );

  const handleExecute = async () => {
    setExecError(null);
    setExecuted(false);
    try {
      const customRecipePayload = {
        title: recipe.pipelineTitle,
        description: recipe.pipelineDesc,
        problem_type: selection.detectedProblem,
        target: selection.selectedTarget,
        steps: recipe.activeSteps.map(s => ({
          key: s.key,
          operation: s.operation,
          label: s.label,
          rationale: s.rationale,
          params: s.params,
          optional: s.optional,
        })),
      };

      const result = await execute({
        id: datasetId,
        target: selection.selectedTarget ?? undefined,
        recipe: customRecipePayload,
        exclude_columns: selection.excludedColumns,
      }).unwrap();

      setExecuted(true);
      setWorkflowStage('results');
      onComplete?.(result.execution);
    } catch (err: any) {
      setExecError(err?.data?.error ?? err?.message ?? "Erreur lors de l'exécution du pipeline");
      setExecuted(true);
    }
  };

  const handleOpenCanvas = async () => {
    try {
      const customRecipePayload = {
        title: recipe.pipelineTitle,
        description: recipe.pipelineDesc,
        problem_type: selection.detectedProblem,
        target: selection.selectedTarget,
        steps: recipe.activeSteps.map(s => ({
          key: s.key,
          operation: s.operation,
          label: s.label,
          rationale: s.rationale,
          params: s.params,
          optional: s.optional,
        })),
      };

      const res = await generateCanvas({
        dataset_id: datasetId,
        target: selection.selectedTarget ?? undefined,
        task_type: selection.selectedTaskType,
        selected_analyses: Array.from(selection.selectedAnalyses),
        recipe: customRecipePayload,
      }).unwrap();

      if (res.nodes) {
        const encoded = encodeURIComponent(JSON.stringify({ nodes: res.nodes, edges: res.edges }));
        navigate(`/canvas?template=${encoded}`);
      }
    } catch (err) {
      console.error('Failed to generate canvas graph:', err);
    }
  };

  return {
    profile,
    execution,
    isDetecting,
    isBuilding: recipe.isBuilding,
    isExecuting,
    isGeneratingCanvas,
    workflowStage,
    setWorkflowStage,
    allColumns: selection.allColumns,
    selectedTarget: selection.selectedTarget,
    handleSelectTarget: selection.handleSelectTarget,
    selectedTaskType: selection.selectedTaskType,
    handleSelectTaskType: selection.handleSelectTaskType,
    smartFeedback: selection.smartFeedback,
    detectedProblem: selection.detectedProblem,
    availableAnalyses: selection.availableAnalyses,
    selectedAnalyses: selection.selectedAnalyses,
    toggleAnalysis: selection.toggleAnalysis,
    applyPreset: selection.applyPreset,
    handleGenerateCustomPipeline: recipe.handleGenerateCustomPipeline,
    pipelineTitle: recipe.pipelineTitle,
    pipelineDesc: recipe.pipelineDesc,
    editableSteps: recipe.editableSteps,
    activeSteps: recipe.activeSteps,
    showAddStepModal: recipe.showAddStepModal,
    setShowAddStepModal: recipe.setShowAddStepModal,
    addStepFromCatalog: recipe.addStepFromCatalog,
    toggleStepEnabled: recipe.toggleStepEnabled,
    toggleStepExpanded: recipe.toggleStepExpanded,
    removeStep: recipe.removeStep,
    updateStepParam: recipe.updateStepParam,
    moveStep: recipe.moveStep,
    handleExecute,
    handleOpenCanvas,
    executed,
    setExecuted,
    canvasMode,
    setCanvasMode,
    execError,
  };
}
