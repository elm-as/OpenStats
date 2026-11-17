import React from 'react';
import { ArrowLeft, Lock, ChevronRight, BarChart3 } from 'lucide-react';
import type { AnalysisCapability } from '../../types';
import { CATEGORY_META, ICON_MAP } from './WizardTypes';

interface WizardSelectStepProps {
  selectedCategory: string | null;
  grouped: Record<string, AnalysisCapability[]>;
  onSelectAnalysis: (analysis: AnalysisCapability) => void;
  onBack: () => void;
}

export function WizardSelectStep(props: WizardSelectStepProps) {
  return (
    <div className="space-y-3">
      <div className="ui-panel px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
          Sélection d&apos;une analyse
        </span>
        <button onClick={props.onBack} className="ui-btn ui-focusable text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
        const analyses = props.grouped[catKey];
        if (!analyses || analyses.length === 0) return null;
        if (props.selectedCategory && catKey !== props.selectedCategory) return null;
        const Icon = meta.icon;

        return (
          <section key={catKey} className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
              <h3 className="text-xs font-bold uppercase tracking-wider ui-t-muted">{meta.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {analyses.map(analysis => {
                const AIcon = ICON_MAP[analysis.icon] || BarChart3;
                return (
                  <button
                    key={analysis.key}
                    onClick={() => props.onSelectAnalysis(analysis)}
                    disabled={!analysis.available}
                    className={`ui-panel text-left p-2.5 transition-colors flex items-start gap-2.5 ${
                      analysis.available
                        ? 'hover:border-[var(--ui-accent)] cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {analysis.available ? (
                        <AIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                      ) : (
                        <Lock className="w-3.5 h-3.5 ui-t-faint" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4
                        className="font-semibold text-xs truncate"
                        style={{ color: analysis.available ? 'var(--ui-text)' : 'var(--ui-text-faint)' }}
                        title={analysis.label}
                      >
                        {analysis.label}
                      </h4>
                      <p className="text-[11px] ui-t-muted mt-0.5 line-clamp-2">
                        {analysis.description}
                      </p>
                      {!analysis.available && (
                        <p className="text-[10px] ui-t-danger mt-1 truncate" title={analysis.reason || analysis.requires}>
                          {analysis.reason || `Requis : ${analysis.requires}`}
                        </p>
                      )}
                    </div>
                    {analysis.available && (
                      <ChevronRight className="w-3.5 h-3.5 ui-t-faint mt-0.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
