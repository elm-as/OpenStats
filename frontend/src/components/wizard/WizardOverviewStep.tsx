import React from 'react';
import {
  Sparkles,
  ListFilter,
  Settings2,
  EyeOff,
  Hash,
  Tag,
  ToggleLeft,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { CATEGORY_META } from './WizardTypes';

export function TypeSummaryCard({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: typeof Hash;
  label: string;
  count: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <Icon className="w-5 h-5 mx-auto mb-1" />
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

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

export function WizardOverviewStep({
  capabilities,
  availableCount,
  totalCount,
  showColumnFilter,
  setShowColumnFilter,
  allColumns,
  excludedSet,
  onToggleColumn,
  onIncludeAll,
  onExcludeAll,
  grouped,
  onGoToCategory,
  onViewAllAnalyses,
}: WizardOverviewStepProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-600" />
            Assistant d'Analyse
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            {availableCount} analyse(s) disponible(s) sur {totalCount} — basé sur vos types de données
            {(capabilities.summary.excluded_count ?? 0) > 0 && (
              <span className="text-amber-600 ml-1">
                ({capabilities.summary.excluded_count} colonne(s) exclue(s))
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowColumnFilter(!showColumnFilter)}
          className={`btn-secondary flex items-center gap-2 text-sm ${
            showColumnFilter ? 'bg-primary-50 border-primary-300' : ''
          }`}
        >
          <ListFilter className="w-4 h-4" />
          Filtrer les colonnes
          {(capabilities.summary.excluded_count ?? 0) > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {capabilities.summary.excluded_count}
            </span>
          )}
        </button>
      </div>

      {/* Column Filter Panel */}
      {showColumnFilter && (
        <div className="card border-primary-200 bg-primary-50/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary-600" />
              Sélection des colonnes
            </h3>
            <div className="flex gap-2">
              <button onClick={onIncludeAll} className="text-xs text-primary-600 hover:underline">
                Tout inclure
              </button>
              <span className="text-surface-500">|</span>
              <button onClick={onExcludeAll} className="text-xs text-red-500 hover:underline">
                Tout exclure
              </button>
            </div>
          </div>
          <p className="text-xs text-surface-400 mb-3">
            Décochez les colonnes que vous souhaitez exclure des analyses et de la modélisation.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {allColumns.map(col => {
              const isExcluded = excludedSet.has(col);
              return (
                <label
                  key={col}
                  className={`flex items-center gap-2 text-sm p-2 rounded-lg cursor-pointer transition-colors ${
                    isExcluded ? 'bg-surface-800 text-surface-500' : 'hover:bg-white text-surface-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => onToggleColumn(col)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <span className="truncate">{col}</span>
                  {isExcluded && <EyeOff className="w-3 h-3 text-surface-500 flex-shrink-0" />}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Data Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <TypeSummaryCard
          icon={Hash}
          label="Numériques"
          count={capabilities.summary.numeric_count}
          color="blue"
        />
        <TypeSummaryCard
          icon={Hash}
          label="Discrètes"
          count={capabilities.summary.discrete_count ?? 0}
          color="cyan"
        />
        <TypeSummaryCard
          icon={Tag}
          label="Catégorielles"
          count={capabilities.summary.categorical_count}
          color="amber"
        />
        <TypeSummaryCard
          icon={ToggleLeft}
          label="Binaires"
          count={capabilities.summary.binary_count}
          color="green"
        />
        <TypeSummaryCard
          icon={Clock}
          label="Temporelles"
          count={capabilities.summary.temporal_count}
          color="purple"
        />
      </div>

      {/* Categories overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
          const analyses = grouped[catKey] || [];
          const availableInCat = analyses.filter(a => a.available).length;
          const Icon = meta.icon;

          return (
            <button
              key={catKey}
              onClick={() => onGoToCategory(catKey)}
              disabled={availableInCat === 0}
              className={`card text-left transition-all hover:shadow-md ${
                availableInCat > 0
                  ? 'cursor-pointer hover:border-primary-300'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${meta.bg}`}>
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{meta.label}</h3>
                  <p className="text-xs text-surface-400 mt-1">
                    {availableInCat}/{analyses.length} analyse(s) disponible(s)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {analyses.map(a => (
                      <span
                        key={a.key}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          a.available
                            ? 'bg-green-100 text-green-700'
                            : 'bg-surface-800 text-surface-500 line-through'
                        }`}
                      >
                        {a.available ? 'OK' : 'N/A'}{' '}
                        {a.label.split('(')[0].split('—')[0].trim().slice(0, 25)}
                      </span>
                    ))}
                  </div>
                </div>
                {availableInCat > 0 && <ChevronRight className="w-4 h-4 text-surface-500 mt-1" />}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onViewAllAnalyses}
        className="btn-primary flex items-center gap-2 w-full justify-center"
      >
        Voir toutes les analyses disponibles <ChevronRight className="w-4 h-4" />
      </button>
    </>
  );
}
