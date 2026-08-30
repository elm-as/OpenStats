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
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-surface-900 via-surface-900/90 to-surface-950 border border-white/10 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center shadow-inner">
          <ProblemIcon className="w-6 h-6 text-accent-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Pipeline Automatique & Économétrique
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-accent-500/20 text-accent-300 border border-accent-500/30">
              Interactif
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">
            Configuration dynamique selon vos variables • Édition complète de chaque étape • Exécution & Canvas
          </p>
        </div>
      </div>

      {/* Stepper Tabs */}
      <div className="flex items-center bg-black/40 p-1.5 rounded-xl border border-white/10">
        <button
          onClick={() => setWorkflowStage('configure')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            workflowStage === 'configure'
              ? 'bg-accent-500 text-surface-950 shadow-md shadow-accent-500/20'
              : 'text-surface-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>1. Configuration</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-surface-600 mx-0.5" />
        <button
          onClick={onGenerateIfNeeded}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            workflowStage === 'pipeline'
              ? 'bg-accent-500 text-surface-950 shadow-md shadow-accent-500/20'
              : 'text-surface-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>2. Éditeur ({activeStepsCount})</span>
        </button>
        {executed && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-surface-600 mx-0.5" />
            <button
              onClick={() => setWorkflowStage('results')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                workflowStage === 'results'
                  ? 'bg-accent-500 text-surface-950 shadow-md shadow-accent-500/20'
                  : 'text-surface-400 hover:text-white hover:bg-white/5'
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
