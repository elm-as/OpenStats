import React from 'react';
import {
  Zap,
  Target,
  Check,
  SlidersHorizontal,
  Sparkles,
  CheckSquare,
  Square,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { DatasetProfileCards } from './DatasetProfileCards';

interface AutoPipelineConfigStageProps {
  profile: any;
  allColumns: string[];
  smartFeedback: string | null;
  selectedTarget: string | null;
  onSelectTarget: (col: string | null) => void;
  selectedTaskType: 'auto' | 'forecast' | 'regression' | 'classification' | 'exploration';
  onSelectTaskType: (
    mode: 'auto' | 'forecast' | 'regression' | 'classification' | 'exploration'
  ) => void;
  availableAnalyses: Array<{
    key: string;
    category: 'prep' | 'timeseries' | 'model' | 'output';
    label: string;
    description: string;
    icon: any;
    recommended: boolean;
    applicable: boolean;
    badgeText?: string;
  }>;
  selectedAnalyses: Set<string>;
  onToggleAnalysis: (key: string) => void;
  onApplyPreset: (preset: 'all' | 'recommended' | 'minimal') => void;
  isBuilding: boolean;
  onGeneratePipeline: () => void;
}

export function AutoPipelineConfigStage({
  profile,
  allColumns,
  smartFeedback,
  selectedTarget,
  onSelectTarget,
  selectedTaskType,
  onSelectTaskType,
  availableAnalyses,
  selectedAnalyses,
  onToggleAnalysis,
  onApplyPreset,
  isBuilding,
  onGeneratePipeline,
}: AutoPipelineConfigStageProps) {
  return (
    <div className="space-y-6">
      {/* Synthèse du dataset */}
      <DatasetProfileCards profile={profile} allColumnsCount={allColumns.length} />

      {/* Feedback interactif intelligent */}
      {smartFeedback && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-accent-500/10 via-purple-500/10 to-transparent border border-accent-500/30 flex items-start gap-2.5 animate-fade-in">
          <Zap className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
          <p className="text-xs text-surface-200 leading-relaxed">{smartFeedback}</p>
        </div>
      )}

      {/* 1. Sélection de la Variable Cible (Y) */}
      <div className="p-5 rounded-2xl bg-surface-900/60 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-400" />
              1. Sélectionner la Variable Cible (Y)
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              Cliquez sur la variable à expliquer ou à prévoir. Les analyses recommandées s'adaptent
              instantanément.
            </p>
          </div>

          {selectedTarget && (
            <button
              onClick={() => onSelectTarget(null)}
              className="text-xs text-accent-400 hover:underline font-semibold"
            >
              Basculer en mode exploration libre (sans cible)
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {allColumns.map(col => {
            const isSelected = selectedTarget === col;
            const isTemp = profile.temporal_cols?.includes(col);
            const isNum = profile.numeric_cols?.includes(col);
            const isBin = profile.binary_cols?.includes(col);
            const isDisc = profile.discrete_cols?.includes(col);

            const typeBadge = isTemp
              ? 'Temporel'
              : isBin
              ? 'Binaire'
              : isNum
              ? 'Continu'
              : isDisc
              ? 'Discret'
              : 'Catégoriel';

            const badgeColor = isTemp
              ? 'bg-purple-500/20 text-purple-300'
              : isBin
              ? 'bg-emerald-500/20 text-emerald-300'
              : isNum
              ? 'bg-blue-500/20 text-blue-300'
              : isDisc
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'bg-amber-500/20 text-amber-300';

            return (
              <button
                key={col}
                onClick={() => onSelectTarget(isSelected ? null : col)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-accent-500/20 border-accent-500 text-accent-200 ring-2 ring-accent-500/20 shadow-lg shadow-accent-500/15 scale-[1.02]'
                    : 'bg-white/[0.03] border-white/10 text-surface-300 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <span className="font-mono">{col}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${badgeColor}`}>
                  {typeBadge}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-accent-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Mode d'Analyse */}
      <div className="p-5 rounded-2xl bg-surface-900/60 border border-white/10 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-accent-400" />
            2. Mode d'Analyse
          </h3>
          <p className="text-xs text-surface-400 mt-0.5">
            Choisissez l'approche méthodologique qui structurera vos algorithmes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {[
            { id: 'auto', label: '🤖 Auto-Adapté', desc: 'Détection optimale automatique' },
            { id: 'forecast', label: '⏱️ Séries Temporelles', desc: 'Stationnarité, ARIMA, VAR, Cointégration' },
            { id: 'regression', label: '📈 Régression ML', desc: 'Modèles prédictifs & VIF' },
            { id: 'classification', label: '🎯 Classification', desc: 'Arbres, LogReg, ROC & Confusion' },
            { id: 'exploration', label: '🔍 Exploration Pure', desc: 'Statistiques, ACP & Clustering' },
          ].map(mode => {
            const isActive = selectedTaskType === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectTaskType(mode.id as any)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'bg-accent-500/15 border-accent-500 text-white ring-2 ring-accent-500/20 shadow-md'
                    : 'bg-white/[0.02] border-white/10 text-surface-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <p className="text-xs font-bold">{mode.label}</p>
                <p className="text-[10px] text-surface-500 mt-1">{mode.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Modules d'Analyses Activables */}
      <div className="p-5 rounded-2xl bg-surface-900/60 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-400" />
              3. Modules d'Analyses Activables
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              Cochez ou décochez les analyses à intégrer. Les dépendances sont gérées automatiquement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onApplyPreset('recommended')}
              className="px-3 py-1 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/30 text-xs font-semibold text-accent-300 transition-all"
            >
              ★ Recommandé
            </button>
            <button
              onClick={() => onApplyPreset('all')}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-surface-300 transition-all"
            >
              Tout Cocher
            </button>
            <button
              onClick={() => onApplyPreset('minimal')}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-surface-300 transition-all"
            >
              Minimal
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {availableAnalyses.map(analysis => {
            const isChecked = selectedAnalyses.has(analysis.key);
            const Icon = analysis.icon;
            const isTemporalModule = analysis.category === 'timeseries';

            return (
              <div
                key={analysis.key}
                onClick={() => onToggleAnalysis(analysis.key)}
                className={`p-4 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3.5 ${
                  isChecked
                    ? isTemporalModule
                      ? 'bg-purple-500/10 border-purple-500/40 text-white ring-1 ring-purple-500/20 shadow-lg shadow-purple-500/5'
                      : 'bg-white/[0.04] border-accent-500/40 text-white ring-1 ring-accent-500/20 shadow-lg shadow-accent-500/5'
                    : 'bg-white/[0.01] border-white/10 text-surface-400 hover:border-white/20 hover:bg-white/[0.03]'
                }`}
              >
                <div className="mt-0.5">
                  {isChecked ? (
                    <CheckSquare
                      className={`w-4 h-4 ${
                        isTemporalModule ? 'text-purple-400' : 'text-accent-400'
                      }`}
                    />
                  ) : (
                    <Square className="w-4 h-4 text-surface-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={`w-4 h-4 ${
                        isTemporalModule ? 'text-purple-400' : 'text-accent-400'
                      }`}
                    />
                    <span className="text-xs font-bold text-white tracking-tight">
                      {analysis.label}
                    </span>
                    {analysis.badgeText && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-300 font-bold">
                        {analysis.badgeText}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-surface-400 mt-1 leading-relaxed">
                    {analysis.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barre d'action et Synthèse dynamique */}
      <div className="p-4 rounded-2xl bg-surface-900/90 border border-white/10 shadow-2xl backdrop-blur-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-surface-300">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Target className="w-3.5 h-3.5 text-accent-400" />
            <span>Cible :</span>
            <span className="font-mono text-accent-300">{selectedTarget || 'Aucune (Exploration)'}</span>
          </div>
          <span className="text-surface-600">•</span>
          <div className="text-surface-400">
            <span className="font-bold text-white">{selectedAnalyses.size}</span> modules sélectionnés
          </div>
          <span className="text-surface-600">•</span>
          <div className="text-surface-400">~{selectedAnalyses.size * 2 + 5}s estimées</div>
        </div>

        <button
          onClick={onGeneratePipeline}
          disabled={isBuilding || selectedAnalyses.size === 0}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-500 to-indigo-600 hover:from-accent-400 hover:to-indigo-500 text-surface-950 font-bold text-xs shadow-xl shadow-accent-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {isBuilding ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Construction du pipeline...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 fill-surface-950" />
              <span>Générer le Pipeline Personnalisé</span>
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
