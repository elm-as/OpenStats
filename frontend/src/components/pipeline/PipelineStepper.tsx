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

export function PipelineStepper(props: PipelineStepperProps) {
  const {
    detectedProblem,
    workflowStage,
    setWorkflowStage,
    activeStepsCount,
    executed,
    onGenerateIfNeeded,
  } = props;
  const problemMeta = PROBLEM_LABEL[detectedProblem] ?? PROBLEM_LABEL.exploration;
  const ProblemIcon = problemMeta.icon;

  return (
    <div className="ui-panel flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <ProblemIcon className="w-4 h-4 text-accent-400 shrink-0" />
        <h2 className="text-sm font-bold text-surface-100 tracking-tight">
          Pipeline Automatique &amp; Économétrique
        </h2>
        <span className="text-[11px] text-surface-400 hidden md:inline">
          • {problemMeta.label}
        </span>
      </div>

      {/* Stepper Tabs */}
      <div
        className="flex items-center p-1 rounded border"
        style={{ background: 'var(--ui-bg-sunken)', borderColor: 'var(--ui-border)' }}
      >
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
