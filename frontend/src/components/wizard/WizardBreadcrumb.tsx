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

export function WizardBreadcrumb(props: WizardBreadcrumbProps) {
  if (props.wizardStep === 'overview') return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      <button onClick={props.onReset} className="ui-t-accent hover:underline font-semibold">
        Catalogue d&apos;analyses
      </button>
      {props.wizardStep === 'select' && (
        <>
          <ChevronRight className="w-3 h-3 ui-t-faint" />
          <span className="font-medium" style={{ color: 'var(--ui-text)' }}>
            {props.selectedCategory
              ? (CATEGORY_META[props.selectedCategory]?.label ?? 'Sélection')
              : 'Sélection'}
          </span>
        </>
      )}
      {(props.wizardStep === 'configure' || props.wizardStep === 'results') && !props.selectedCategory && (
        <>
          <ChevronRight className="w-3 h-3 ui-t-faint" />
          <button onClick={() => props.onGoToSelect()} className="ui-t-accent hover:underline">
            Sélection
          </button>
        </>
      )}
      {(props.wizardStep === 'configure' || props.wizardStep === 'results') && props.selectedAnalysis && (
        <>
          <ChevronRight className="w-3 h-3 ui-t-faint" />
          <span
            className="font-medium"
            style={{
              color: props.wizardStep === 'configure' ? 'var(--ui-text)' : 'var(--ui-accent-text)',
            }}
          >
            {props.selectedAnalysis.label}
          </span>
        </>
      )}
      {props.wizardStep === 'results' && (
        <>
          <ChevronRight className="w-3 h-3 ui-t-faint" />
          <span className="font-medium" style={{ color: 'var(--ui-text)' }}>Résultats</span>
        </>
      )}
    </div>
  );
}
