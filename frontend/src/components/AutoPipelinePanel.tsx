import React, { useState } from 'react';
import { Loader2, CheckCircle2, ArrowLeft, Layers } from 'lucide-react';
import ResultsWizard from './ResultsWizard';
import CodeViewerModal from './canvas/CodeViewerModal';
import { PipelineStepper } from './pipeline/PipelineStepper';
import { AutoPipelineConfigStage } from './pipeline/AutoPipelineConfigStage';
import { AutoPipelineRecipeStage } from './pipeline/AutoPipelineRecipeStage';
import { useAutoPipeline } from './pipeline/useAutoPipeline';

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
      const pyRes = await fetch('/api/v1/canvas/export_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: activeSteps.map((s, idx) => ({
            id: `node_${idx}`,
            type: s.operation,
            data: s.params,
          })),
          edges: [],
          dataset_name: datasetName || 'dataset.csv',
          language: 'python',
        }),
      });
      const pyData = await pyRes.json();
      if (pyData.code) setPyCode(pyData.code);

      const rRes = await fetch('/api/v1/canvas/export_code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: activeSteps.map((s, idx) => ({
            id: `node_${idx}`,
            type: s.operation,
            data: s.params,
          })),
          edges: [],
          dataset_name: datasetName || 'dataset.csv',
          language: 'r',
        }),
      });
      const rData = await rRes.json();
      if (rData.code) setRCode(rData.code);
    } catch (err) {
      console.error(err);
    }
  };

  if (isDetecting) {
    return (
      <div className="card backdrop-blur-xl bg-surface-900/60 border border-white/10 rounded-2xl flex flex-col items-center justify-center py-16 gap-5 animate-fade-in shadow-2xl">
        <div className="relative">
          <div className="absolute inset-0 bg-accent-500/30 blur-2xl rounded-full animate-pulse" />
          <div className="w-14 h-14 rounded-2xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center relative z-10">
            <Loader2 className="w-7 h-7 text-accent-400 animate-spin" />
          </div>
        </div>
        <div className="text-center max-w-sm">
          <h4 className="text-base font-bold text-white tracking-tight">
            Analyse sémantique des variables...
          </h4>
          <p className="text-xs text-surface-400 mt-1.5 leading-relaxed">
            Inspection des structures temporelles, distributions et identification des analyses
            recommandées.
          </p>
        </div>
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
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-900/80 border border-white/10 shadow-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Pipeline exécuté avec succès !</h3>
                <p className="text-xs text-surface-400">
                  Toutes les étapes et calculs statistiques ont été réalisés.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setWorkflowStage('pipeline')}
                className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-surface-300 hover:text-white transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Modifier le pipeline</span>
              </button>

              <button
                onClick={handleOpenCanvas}
                className="px-3.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-xs font-semibold text-purple-300 transition-all flex items-center gap-1.5"
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
