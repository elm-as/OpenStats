import React from 'react';
import {
  ListFilter,
  Settings2,
  EyeOff,
  ChevronRight,
} from 'lucide-react';
import { CATEGORY_META } from './WizardTypes';

interface WizardOverviewStepProps {
  capabilities: any;
  availableCount: number;
  totalCount: number;
  showColumnFilter: boolean;
  setShowColumnFilter: (show: boolean) => void;
  allColumns: string[];
  excludedSet: Set<string>;
  onToggleColumn: (col: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  grouped: Record<string, any[]>;
  onGoToCategory: (catKey: string) => void;
  onViewAllAnalyses: () => void;
}

export function WizardOverviewStep(props: WizardOverviewStepProps) {
  const { summary } = props.capabilities;
  const excludedCount: number = summary.excluded_count ?? 0;

  return (
    <>
      <div
        className="ui-panel px-3 py-1.5 flex flex-wrap items-center justify-between gap-2"
        style={{ minHeight: 38 }}
      >
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span className="font-semibold" style={{ color: 'var(--ui-text)' }}>
            Catalogue d&apos;analyses
          </span>
          <span className="ui-sep" aria-hidden />
          <span className="ui-num font-semibold" style={{ color: 'var(--ui-accent-text)' }}>
            {props.availableCount}/{props.totalCount} disponibles
          </span>
          <span className="ui-num ui-t-muted">
            · {summary.numeric_count} num. · {summary.discrete_count ?? 0} discr. · {summary.categorical_count} catég. · {summary.binary_count} bin. · {summary.temporal_count} temp.
          </span>
          {excludedCount > 0 && (
            <span className="ui-tag ui-tag-warning ui-num">
              {excludedCount} exclue(s)
            </span>
          )}
        </div>

        <button
          onClick={() => props.setShowColumnFilter(!props.showColumnFilter)}
          className={`ui-btn ui-focusable text-xs ${props.showColumnFilter ? 'ui-btn-primary' : ''}`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          Filtrer les colonnes
          {excludedCount > 0 && <span className="ui-num">({excludedCount})</span>}
        </button>
      </div>

      {props.showColumnFilter && (
        <div className="ui-panel p-3" style={{ borderColor: 'var(--ui-border-strong)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-xs flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
              <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent-text)' }} />
              Sélection des colonnes
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={props.onIncludeAll} className="text-xs ui-t-accent hover:underline">
                Tout inclure
              </button>
              <span className="ui-t-faint">|</span>
              <button onClick={props.onExcludeAll} className="text-xs ui-t-danger hover:underline">
                Tout exclure
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-1.5 max-h-56 overflow-y-auto ui-scroll">
            {props.allColumns.map(col => {
              const isExcluded = props.excludedSet.has(col);
              return (
                <label
                  key={col}
                  className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-[var(--ui-radius-sm)] cursor-pointer transition-colors"
                  style={{
                    background: isExcluded ? 'var(--ui-bg-sunken)' : 'var(--ui-bg-raised)',
                    color: isExcluded ? 'var(--ui-text-faint)' : 'var(--ui-text)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => props.onToggleColumn(col)}
                  />
                  <span className="truncate">{col}</span>
                  {isExcluded && <EyeOff className="w-3 h-3 shrink-0 ui-t-faint" />}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
          const analyses = props.grouped[catKey] || [];
          const availableInCat = analyses.filter(a => a.available).length;
          const Icon = meta.icon;

          return (
            <button
              key={catKey}
              onClick={() => props.onGoToCategory(catKey)}
              disabled={availableInCat === 0}
              className={`ui-panel text-left overflow-hidden flex flex-col transition-colors ${
                availableInCat > 0
                  ? 'cursor-pointer hover:border-[var(--ui-accent)]'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="ui-panel-header w-full">
                <span className="flex items-center gap-1.5 min-w-0 truncate" style={{ color: 'var(--ui-text)' }}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="flex items-center gap-1 shrink-0 ui-num">
                  {availableInCat}/{analyses.length}
                  {availableInCat > 0 && <ChevronRight className="w-3.5 h-3.5 ui-t-faint" />}
                </span>
              </div>

              <div className="p-2.5 flex flex-wrap gap-1.5">
                {analyses.map(a => (
                  <span
                    key={a.key}
                    className={
                      a.available
                        ? 'ui-tag ui-tag-ok text-[11px]'
                        : 'ui-tag text-[11px] line-through opacity-55'
                    }
                  >
                    {a.label.split('(')[0].split('—')[0].trim()}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          onClick={props.onViewAllAnalyses}
          className="ui-btn ui-btn-primary ui-focusable text-xs"
        >
          Voir toutes les analyses ({props.availableCount}) <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}
