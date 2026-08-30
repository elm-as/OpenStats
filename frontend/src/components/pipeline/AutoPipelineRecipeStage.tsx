import React from 'react';
import {
  ArrowLeft,
  Plus,
  FileCode,
  Layers,
  Loader2,
  Play,
  Settings2,
  ChevronUp,
  ChevronDown,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { EditableStep } from './PipelineTypes';
import { PipelineStepOptions } from './PipelineStepOptions';

interface AutoPipelineRecipeStageProps {
  pipelineTitle: string;
  pipelineDesc: string;
  editableSteps: EditableStep[];
  activeSteps: EditableStep[];
  isExecuting: boolean;
  isGeneratingCanvas: boolean;
  showAddStepModal: boolean;
  setShowAddStepModal: (show: boolean) => void;
  availableAnalyses: Array<{ key: string; label: string; description: string }>;
  onBack: () => void;
  onAddStepFromCatalog: (key: string) => void;
  onShowCodeModal: () => void;
  onOpenCanvas: () => void;
  onExecute: () => void;
  onToggleStepEnabled: (idx: number) => void;
  onToggleStepExpanded: (idx: number) => void;
  onMoveStep: (idx: number, direction: 'up' | 'down') => void;
  onRemoveStep: (idx: number) => void;
  onUpdateStepParam: (idx: number, key: string, value: any) => void;
}

export function AutoPipelineRecipeStage({
  pipelineTitle,
  pipelineDesc,
  editableSteps,
  activeSteps,
  isExecuting,
  isGeneratingCanvas,
  showAddStepModal,
  setShowAddStepModal,
  availableAnalyses,
  onBack,
  onAddStepFromCatalog,
  onShowCodeModal,
  onOpenCanvas,
  onExecute,
  onToggleStepEnabled,
  onToggleStepExpanded,
  onMoveStep,
  onRemoveStep,
  onUpdateStepParam,
}: AutoPipelineRecipeStageProps) {
  return (
    <div className="space-y-6">
      {/* Header de l'éditeur */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-900/80 border border-white/10 shadow-xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-surface-400 hover:text-white transition-all mr-1"
              title="Revenir à la configuration"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-white tracking-tight">{pipelineTitle}</h3>
          </div>
          <p className="text-xs text-surface-400 mt-1 leading-relaxed">
            {pipelineDesc} •{' '}
            <span className="text-accent-300 font-semibold">{activeSteps.length} étapes actives</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddStepModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-surface-200 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-accent-400" />
            <span>Ajouter une étape</span>
          </button>

          <button
            onClick={onShowCodeModal}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-surface-200 hover:text-white transition-all flex items-center gap-1.5"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>Code Source</span>
          </button>

          <button
            onClick={onOpenCanvas}
            disabled={isGeneratingCanvas}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-surface-200 hover:text-white transition-all flex items-center gap-1.5"
          >
            {isGeneratingCanvas ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>Ouvrir en Canvas</span>
          </button>

          <button
            onClick={onExecute}
            disabled={isExecuting || activeSteps.length === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-accent-500 to-indigo-600 hover:from-accent-400 hover:to-indigo-500 text-surface-950 font-bold text-xs shadow-lg shadow-accent-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exécution en cours...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-surface-950" />
                <span>Lancer l'Exécution</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Liste des Étapes */}
      <div className="space-y-3">
        {editableSteps.map((step, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === editableSteps.length - 1;

          return (
            <div
              key={step.key}
              className={`p-4 rounded-2xl border transition-all ${
                step.enabled
                  ? 'bg-surface-900/70 border-white/10 hover:border-white/20'
                  : 'bg-white/[0.01] border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onToggleStepEnabled(idx)}
                    className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                      step.enabled ? 'bg-accent-500' : 'bg-surface-700'
                    }`}
                    title={step.enabled ? 'Désactiver cette étape' : 'Activer cette étape'}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-surface-950 shadow-md transition-transform ${
                        step.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-surface-300 flex items-center justify-center font-mono">
                    {idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white tracking-tight">{step.label}</h4>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-surface-400 font-mono">
                        {step.operation}
                      </span>
                    </div>
                    <p className="text-[11px] text-surface-400 mt-0.5 leading-relaxed">{step.rationale}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onToggleStepExpanded(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                      step.isExpanded
                        ? 'bg-accent-500/20 text-accent-300 border border-accent-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-surface-300 hover:text-white'
                    }`}
                  >
                    <Settings2 className="w-3 h-3 text-accent-400" />
                    <span>{step.isExpanded ? 'Fermer' : 'Options'}</span>
                  </button>

                  <button
                    onClick={() => onMoveStep(idx, 'up')}
                    disabled={isFirst}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-surface-400 hover:text-white transition-all"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onMoveStep(idx, 'down')}
                    disabled={isLast}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 text-surface-400 hover:text-white transition-all"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onRemoveStep(idx)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                    title="Supprimer cette étape"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {step.isExpanded && (
                <PipelineStepOptions
                  step={step}
                  stepIdx={idx}
                  onUpdateStepParam={onUpdateStepParam}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Modal d'ajout d'étape */}
      {showAddStepModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-surface-900 border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent-400" />
                Ajouter une étape au Pipeline
              </h3>
              <button
                onClick={() => setShowAddStepModal(false)}
                className="text-surface-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {availableAnalyses.map(a => (
                <div
                  key={a.key}
                  onClick={() => onAddStepFromCatalog(a.key)}
                  className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/5 border border-white/10 hover:border-accent-500/40 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-white">{a.label}</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">{a.description}</p>
                  </div>
                  <Plus className="w-4 h-4 text-accent-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
