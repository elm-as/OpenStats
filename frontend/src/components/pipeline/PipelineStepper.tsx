import React from 'react';
import { ChevronRight } from 'lucide-react';
import { PROBLEM_LABEL } from './PipelineTypes';

interface PipelineStepperProps {
  detectedProblem: string;
  workflowStage: 'configure' | 'pipeline' | 'results';
  setWorkflowStage: (stage: 'configure' | 'pipeline' | 'results') => void;
  activeStepsCount: number;
  executed: boolean;
  onGenerateIfNeeded: () => void;
}

export function PipelineStepper({
  detectedProblem,
  workflowStage,
  setWorkflowStage,
  activeStepsCount,
  executed,
  onGenerateIfNeeded,
}: PipelineStepperProps) {
  const problemMeta = PROBLEM_LABEL[detectedProblem] ?? PROBLEM_LABEL.exploration;
  const ProblemIcon = problemMeta.icon;

  return (
    <div className="ui-panel flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-lg bg-accent-500/10 border border-accent-500/30 flex items-center justify-center">
          <ProblemIcon className="w-5 h-5 text-accent-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-surface-100 tracking-tight">
              Pipeline Automatique & Économétrique
            </h2>
            <span className="ui-tag ui-tag-accent text-[10px] font-bold uppercase tracking-wider">
              Interactif
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Configuration dynamique selon vos variables • Édition complète de chaque étape • Exécution & Canvas
          </p>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="flex items-center bg-surface-800/50 p-1 rounded-lg border border-white/10">
        <button
          onClick={() => setWorkflowStage('configure')}
          className={`ui-btn text-xs font-semibold ${
            workflowStage === 'configure' ? 'ui-btn-primary' : 'ui-btn-ghost'
          }`}
        >
          <span>1. Configuration</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-surface-500 mx-0.5" />
        <button
          onClick={onGenerateIfNeeded}
          className={`ui-btn text-xs font-semibold ui-num ${
            workflowStage === 'pipeline' ? 'ui-btn-primary' : 'ui-btn-ghost'
          }`}
        >
          <span>2. Éditeur ({activeStepsCount})</span>
        </button>
        {executed && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-surface-500 mx-0.5" />
            <button
              onClick={() => setWorkflowStage('results')}
              className={`ui-btn text-xs font-semibold ${
                workflowStage === 'results' ? 'ui-btn-primary' : 'ui-btn-ghost'
              }`}
            >
              <span>3. Résultats</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
