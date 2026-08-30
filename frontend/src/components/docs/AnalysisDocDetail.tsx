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
    <div className="bg-surface-900 border border-white/10 rounded-2xl p-6 md:p-8 md:px-12 space-y-12 shadow-2xl animate-fade-in relative overflow-y-auto max-h-[85vh] custom-scrollbar scroll-smooth">
      {/* Background Subtle Gradient */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col gap-4 pb-6 border-b border-white/10 -mx-6 px-6 pt-2 md:-mx-12 md:px-12">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted hover:text-white transition-colors"
                title="Retour à la liste"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20 shadow-sm shadow-accent-500/10">
              {analysis.categoryLabel}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {analysis.title}
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-3xl">
            {analysis.summary}
          </p>
        </div>
      </div>

      {/* ─── SECTION 1: PRESENTATION & ASSUMPTIONS ─── */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
          <Target className="w-5 h-5 text-accent-400" />
          <h3 className="text-lg font-black text-white">Objectif Métier & Quand l'utiliser</h3>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed max-w-4xl text-justify">
          {analysis.useCase}
        </p>

        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3 border-b border-white/5 pb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-black text-white">Conditions & Hypothèses Préalables</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.assumptions.map((ass, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/[0.02] p-4 rounded-xl border border-white/5 text-sm text-surface-300 shadow-sm">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <span className="leading-relaxed">{ass}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECTION 2: MATHEMATICAL FORMULA ─── */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-black text-white">Fondements Mathématiques</h3>
        </div>
        
        <FormulaCard
          title={analysis.formulaTitle}
          formulaTex={analysis.formulaTex}
          variables={analysis.variables}
          note={analysis.formulaNote}
        />
      </section>

      {/* ─── SECTION 3: INTERPRETATION GUIDE ─── */}
      <section className="space-y-6 pt-4">
        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
          <FileCheck className="w-5 h-5 text-accent-400" />
          <h3 className="text-lg font-black text-white">Guide d'Interprétation des Résultats</h3>
        </div>

        <div className="space-y-4">
          {analysis.interpretationGuide.map((item, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-5 space-y-3 shadow-sm hover:border-white/10 transition-colors">
              <div className="flex items-center justify-between gap-3 flex-wrap border-b border-white/5 pb-3">
                <span className="text-sm font-black text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                  {item.metric}
                </span>
                {item.thresholds && (
                  <span className="text-xs font-mono font-bold text-slate-300 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    Seuil : {item.thresholds}
                  </span>
                )}
              </div>

              <p className="text-sm text-surface-300 leading-relaxed">
                {item.description}
              </p>

              <div className="mt-3 pt-3 flex items-start gap-2 text-sm font-bold text-emerald-400 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                <ChevronRight className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
                <span className="leading-relaxed">Règle de Décision : {item.decisionRule}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SECTION 4: PRACTICAL EXAMPLE ─── */}
      <section className="space-y-6 pt-4 pb-8">
        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
          <Zap className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-black text-white">Mise en Situation Réelle</h3>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 md:p-8 space-y-6 shadow-inner">
          <div className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-muted" />
              Scénario d'étude
            </span>
            <p className="text-sm text-surface-300 leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/5 text-justify">
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
