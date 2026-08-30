import React from 'react';
import { ArrowLeft, Lock, Info, ChevronRight, BarChart3 } from 'lucide-react';
import type { AnalysisCapability } from '../../types';
import { CATEGORY_META, ICON_MAP } from './WizardTypes';

interface WizardSelectStepProps {
  selectedCategory: string | null;
  grouped: Record<string, AnalysisCapability[]>;
  onSelectAnalysis: (analysis: AnalysisCapability) => void;
  onBack: () => void;
}

export function WizardSelectStep({
  selectedCategory,
  grouped,
  onSelectAnalysis,
  onBack,
}: WizardSelectStepProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Choisir une analyse</h2>
          <p className="text-sm text-surface-400 mt-1">
            Les analyses grisées ne sont pas applicables à vos données
          </p>
        </div>
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>

      {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
        const analyses = grouped[catKey];
        if (!analyses || analyses.length === 0) return null;
        if (selectedCategory && catKey !== selectedCategory) return null;
        const Icon = meta.icon;

        return (
          <div key={catKey}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${meta.color}`} />
              <h3 className="font-semibold text-surface-100">{meta.label}</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {analyses.map(analysis => {
                const AIcon = ICON_MAP[analysis.icon] || BarChart3;
                return (
                  <button
                    key={analysis.key}
                    onClick={() => onSelectAnalysis(analysis)}
                    disabled={!analysis.available}
                    className={`card text-left transition-all p-4 ${
                      analysis.available
                        ? 'hover:shadow-md hover:border-primary-300 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed bg-surface-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-1.5 rounded-lg ${
                          analysis.available ? meta.bg : 'bg-surface-800 border-gray-200'
                        }`}
                      >
                        {analysis.available ? (
                          <AIcon className={`w-4 h-4 ${meta.color}`} />
                        ) : (
                          <Lock className="w-4 h-4 text-surface-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`font-medium text-sm ${
                            analysis.available ? 'text-gray-900' : 'text-surface-500'
                          }`}
                        >
                          {analysis.label}
                        </h4>
                        <p className="text-xs text-surface-400 mt-1 line-clamp-2">
                          {analysis.description}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Info className="w-3 h-3 text-surface-500 flex-shrink-0" />
                          <span
                            className={`text-xs ${
                              analysis.available ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {analysis.available
                              ? `Prérequis remplis : ${analysis.requires}`
                              : analysis.reason || `Prérequis non remplis : ${analysis.requires}`}
                          </span>
                        </div>
                      </div>
                      {analysis.available && (
                        <ChevronRight className="w-4 h-4 text-surface-500 mt-0.5 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
