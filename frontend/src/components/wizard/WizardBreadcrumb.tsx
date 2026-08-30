import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { AnalysisCapability } from '../../types';
import { CATEGORY_META, type WizardStep } from './WizardTypes';

interface WizardBreadcrumbProps {
  wizardStep: WizardStep;
  selectedCategory: string | null;
  selectedAnalysis: AnalysisCapability | null;
  onReset: () => void;
  onGoToSelect: (cat?: string) => void;
}

export function WizardBreadcrumb({
  wizardStep,
  selectedCategory,
  selectedAnalysis,
  onReset,
  onGoToSelect,
}: WizardBreadcrumbProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={onReset} className="text-primary-600 hover:underline font-medium">
        Analyses
      </button>
      {wizardStep === 'select' && (
        <>
          <ChevronRight className="w-3 h-3 text-surface-500" />
          <span className="text-surface-50 font-medium">
            {selectedCategory ? (CATEGORY_META[selectedCategory]?.label ?? 'Sélection') : 'Sélection'}
          </span>
        </>
      )}
      {(wizardStep === 'configure' || wizardStep === 'results') && !selectedCategory && (
        <>
          <ChevronRight className="w-3 h-3 text-surface-500" />
          <button onClick={() => onGoToSelect()} className="text-primary-600 hover:underline">
            Sélection
          </button>
        </>
      )}
      {(wizardStep === 'configure' || wizardStep === 'results') && selectedAnalysis && (
        <>
          <ChevronRight className="w-3 h-3 text-surface-500" />
          <span
            className={`${
              wizardStep === 'configure'
                ? 'text-gray-900 font-medium'
                : 'text-primary-600 hover:underline cursor-pointer'
            }`}
          >
            {selectedAnalysis.label}
          </span>
        </>
      )}
      {wizardStep === 'results' && (
        <>
          <ChevronRight className="w-3 h-3 text-surface-500" />
          <span className="text-gray-900 font-medium">Résultats</span>
        </>
      )}
    </div>
  );
}
