import React, { useState } from 'react';
import { Loader2, CheckCircle2, ArrowLeft, Layers } from 'lucide-react';
import ResultsWizard from '../wizard/ResultsWizard';
import CodeViewerModal from '../canvas/CodeViewerModal';
import { fetchPythonAndRCode } from '../canvas/canvasCodeExport';
import { PipelineStepper } from './PipelineStepper';
import { AutoPipelineConfigStage } from './AutoPipelineConfigStage';
import { AutoPipelineRecipeStage } from './AutoPipelineRecipeStage';
import { useAutoPipeline } from './useAutoPipeline';

interface Props {
  datasetId: string;
  datasetName?: string;
  onComplete?: (execution?: any) => void;
}

export default function AutoPipelinePanel({ datasetId, datasetName, onComplete }: Props) {
  const [showAutoCodeModal, setShowAutoCodeModal] = useState(false);
  const [pyCode, setPyCode] = useState('');
  const [rCode, setRCode] = useState('');

  const {
    profile,
    execution,
    isDetecting,
    isBuilding,
    isExecuting,
    isGeneratingCanvas,
    workflowStage,
    setWorkflowStage,
    allColumns,
    selectedTarget,
    handleSelectTarget,
    selectedTaskType,
    handleSelectTaskType,
    smartFeedback,
    detectedProblem,
    availableAnalyses,
    selectedAnalyses,
    toggleAnalysis,
    applyPreset,
    handleGenerateCustomPipeline,
    pipelineTitle,
    pipelineDesc,
    pipelineWarnings,
    editableSteps,
    activeSteps,
    showAddStepModal,
    setShowAddStepModal,
    addStepFromCatalog,
    toggleStepEnabled,
    toggleStepExpanded,
    removeStep,
    updateStepParam,
    moveStep,
    handleExecute,
    handleOpenCanvas,
    executed,
    setExecuted,
    setCanvasMode,
    execError,
  } = useAutoPipeline(datasetId, onComplete);

  const handleOpenCodeModal = async () => {
    setShowAutoCodeModal(true);
    try {
      const { pythonCode, rCode: generatedR } = await fetchPythonAndRCode({
        nodes: activeSteps.map((s, idx) => ({
          id: `node_${idx}`,
          type: s.operation,
          data: s.params,
        })),
        edges: [],
        dataset_name: datasetName || 'dataset.csv',
      });
      if (pythonCode) setPyCode(pythonCode);
      if (generatedR) setRCode(generatedR);
    } catch (err) {
      console.error(err);
    }
  };

  if (isDetecting) {
    return (
      <div className="ui-panel flex items-center justify-center py-8 gap-3 text-xs text-surface-300">
        <Loader2 className="w-4 h-4 text-accent-400 animate-spin shrink-0" />
        <span>Analyse des variables et détection de la structure...</span>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      <PipelineStepper
        detectedProblem={detectedProblem}
        workflowStage={workflowStage}
        setWorkflowStage={setWorkflowStage}
        activeStepsCount={activeSteps.length || selectedAnalyses.size}
        executed={executed}
        onGenerateIfNeeded={() => {
          if (editableSteps.length === 0) handleGenerateCustomPipeline();
          else setWorkflowStage('pipeline');
        }}
      />

      {workflowStage === 'configure' && (
        <AutoPipelineConfigStage
          profile={profile}
          allColumns={allColumns}
          smartFeedback={smartFeedback}
          selectedTarget={selectedTarget}
          onSelectTarget={handleSelectTarget}
          selectedTaskType={selectedTaskType}
          onSelectTaskType={handleSelectTaskType}
          availableAnalyses={availableAnalyses}
          selectedAnalyses={selectedAnalyses}
          onToggleAnalysis={toggleAnalysis}
          onApplyPreset={applyPreset}
          isBuilding={isBuilding}
          onGeneratePipeline={handleGenerateCustomPipeline}
        />
      )}

      {workflowStage === 'pipeline' && (
        <AutoPipelineRecipeStage
          pipelineTitle={pipelineTitle}
          pipelineDesc={pipelineDesc}
          pipelineWarnings={pipelineWarnings}
          editableSteps={editableSteps}
          activeSteps={activeSteps}
          isExecuting={isExecuting}
          isGeneratingCanvas={isGeneratingCanvas}
          showAddStepModal={showAddStepModal}
          setShowAddStepModal={setShowAddStepModal}
          availableAnalyses={availableAnalyses}
          onBack={() => setWorkflowStage('configure')}
          onAddStepFromCatalog={addStepFromCatalog}
          onShowCodeModal={handleOpenCodeModal}
          onOpenCanvas={handleOpenCanvas}
          onExecute={handleExecute}
          onToggleStepEnabled={toggleStepEnabled}
          onToggleStepExpanded={toggleStepExpanded}
          onMoveStep={moveStep}
          onRemoveStep={removeStep}
          onUpdateStepParam={updateStepParam}
        />
      )}

      {workflowStage === 'results' && executed && execution && (
        <div className="space-y-4">
          <div className="ui-panel flex items-center justify-between px-3.5 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-surface-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Exécution terminée</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWorkflowStage('pipeline')}
                className="ui-btn text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Modifier le pipeline</span>
              </button>

              <button
                onClick={handleOpenCanvas}
                className="ui-btn ui-btn-primary text-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Explorer dans Canvas</span>
              </button>
            </div>
          </div>

          <ResultsWizard
            datasetId={datasetId}
            execution={execution}
            execError={execError}
            onReset={() => {
              setExecuted(false);
              setWorkflowStage('configure');
            }}
            onLowCode={() => setCanvasMode(true)}
          />
        </div>
      )}

      <CodeViewerModal
        isOpen={showAutoCodeModal}
        onClose={() => setShowAutoCodeModal(false)}
        title={`Code Source du Pipeline — ${pipelineTitle}`}
        pythonCode={pyCode}
        rCode={rCode}
      />
    </div>
  );
}
