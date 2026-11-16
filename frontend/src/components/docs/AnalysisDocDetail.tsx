import React from 'react';
import { AnalysisDoc } from '../../docs/analysesData';
import { FormulaCard } from './MathVisualizer';
import {
  Target,
  CheckCircle2,
  FileCheck,
  Zap,
  ArrowLeft,
  ChevronRight,
  BookOpen
} from 'lucide-react';

interface AnalysisDocDetailProps {
  analysis: AnalysisDoc;
  onBack?: () => void;
}

export const AnalysisDocDetail: React.FC<AnalysisDocDetailProps> = ({ analysis, onBack }) => {
  return (
    <div className="ui-panel p-6 md:p-8 md:px-10 space-y-10 relative overflow-y-auto max-h-[85vh] ui-scroll scroll-smooth">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 pb-5 border-b border-white/10">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="ui-btn ui-btn-ghost p-2"
                title="Retour à la liste"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="ui-tag ui-tag-accent text-[11px] font-bold uppercase tracking-wider">
              {analysis.categoryLabel}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-surface-100 tracking-tight">
            {analysis.title}
          </h2>
          <p className="text-sm text-surface-300 leading-relaxed max-w-3xl">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: PRESENTATION & ASSUMPTIONS ─── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
          <Target className="w-4 h-4 text-accent-400" />
          <h3 className="text-base font-bold text-surface-100">Objectif Métier & Quand l'utiliser</h3>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed max-w-4xl">
          {analysis.useCase}
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-surface-100">Conditions & Hypothèses Préalables</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.assumptions.map((ass, i) => (
              <div key={i} className="flex items-start gap-3 bg-surface-800/40 p-3.5 rounded-lg border border-white/10 text-sm text-surface-200">
                <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 ui-num">
                  {i + 1}
                </div>
                <span className="leading-relaxed">{ass}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: MATHEMATICAL FORMULA ─── */}
      <section className="space-y-5 pt-2">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-bold text-surface-100">Fondements Mathématiques</h3>
        </div>
        
        <FormulaCard
          title={analysis.formulaTitle}
          formulaTex={analysis.formulaTex}
          variables={analysis.variables}
          note={analysis.formulaNote}
        />
      </section>

      {/* ─── SECTION 3: INTERPRETATION GUIDE ─── */}
      <section className="space-y-5 pt-2">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
          <FileCheck className="w-4 h-4 text-accent-400" />
          <h3 className="text-base font-bold text-surface-100">Guide d'Interprétation des Résultats</h3>
        </div>

        <div className="space-y-3">
          {analysis.interpretationGuide.map((item, idx) => (
            <div key={idx} className="bg-surface-800/40 border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/10 pb-2.5">
                <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/25">
                  {item.metric}
                </span>
                {item.thresholds && (
                  <span className="text-xs font-mono ui-num font-semibold text-surface-200 bg-surface-800/60 px-2.5 py-1 rounded border border-white/10">
                    Seuil : {item.thresholds}
                  </span>
                )}
              </div>

              <p className="text-sm text-surface-300 leading-relaxed">
                {item.description}
              </p>

              <div className="mt-2 flex items-start gap-2 text-sm font-semibold text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                <ChevronRight className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <span className="leading-relaxed">Règle de Décision : {item.decisionRule}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECTION 4: PRACTICAL EXAMPLE ─── */}
      <section className="space-y-5 pt-2 pb-4">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-base font-bold text-surface-100">Mise en Situation Réelle</h3>
        </div>

        <div className="bg-surface-800/40 border border-white/10 rounded-xl p-5 md:p-6 space-y-5">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-surface-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
              Scénario d'étude
            </span>
            <p className="text-sm text-surface-200 leading-relaxed bg-surface-900/40 p-4 rounded-lg border border-white/10">
              {analysis.practicalExample.context}
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/50" />
              Résultats Numériques Obtenus
            </span>
            <div className="font-mono text-sm text-amber-300 bg-slate-950 p-4 rounded-xl border border-amber-500/20 shadow-inner">
              {analysis.practicalExample.sampleResult}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Conclusion & Décision Métier
            </span>
            <div className="text-sm text-emerald-300 bg-emerald-500/10 p-5 rounded-xl border border-emerald-500/20 font-bold leading-relaxed shadow-sm">
                Conclusion : {analysis.practicalExample.conclusion}
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer padding for scroll spacing */}
      <div className="h-8" />
    </div>
  );
};
