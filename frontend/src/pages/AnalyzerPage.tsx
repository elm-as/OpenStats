import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListDatasetsQuery } from '../store/api';
import AutoPipelinePanel from '../components/AutoPipelinePanel';
import InsightsPanel from '../components/InsightsPanel';
import DataPrepPanel from '../components/DataPrepPanel';
import {
  Activity, Sparkles, Settings2, Database, ChevronDown,
  Upload, Search, BarChart3, Layers, Clock,
  Table2, FileSpreadsheet, FileJson, FileCode, Check, X,
} from 'lucide-react';
import type { DatasetSummary } from '../types';

const TABS = [
  { key: 'overview' as const, label: 'Vue d\'ensemble', icon: Activity, desc: 'Pipeline automatique' },
  { key: 'insights' as const, label: 'Insights', icon: Sparkles, desc: 'Interpretation & correlations' },
  { key: 'prep' as const, label: 'Preparation', icon: Settings2, desc: 'Nettoyage & transformations' },
];

export default function AnalyzerPage() {
  const { data: result, isLoading } = useListDatasetsQuery();
  const datasets = result?.datasets ?? [];
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'overview' | 'insights' | 'prep'>('overview');
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [dsSearch, setDsSearch] = useState('');

  const filteredDatasets = useMemo(() => {
    if (!dsSearch.trim()) return datasets;
    const q = dsSearch.toLowerCase();
    return datasets.filter(ds => ds.name.toLowerCase().includes(q));
  }, [datasets, dsSearch]);

  const clearSearch = () => setDsSearch('');

  const datasetIdFromUrl = searchParams.get('dataset');
  const selectedDataset = useMemo(() => {
    if (datasetIdFromUrl) return datasets.find(d => d.id === datasetIdFromUrl) ?? null;
    return datasets[0] ?? null;
  }, [datasets, datasetIdFromUrl]);

  const selectDataset = (id: string) => {
    setSearchParams({ dataset: id });
    setShowDatasetPicker(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin w-8 h-8 border-[3px] border-accent-500 border-t-transparent rounded-full" />
          <p className="text-sm text-muted">Chargement des datasets...</p>
        </div>
      </div>
    );
  }

  if (!datasets.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <Database className="w-16 h-16 text-surface-500 mb-6 opacity-50" />
        <h2 className="text-lg font-bold text-strong mb-2">Aucun dataset disponible</h2>
        <p className="text-sm text-muted mb-6">Importez un fichier CSV, XLSX ou JSON pour commencer.</p>
        <button onClick={() => navigate('/workflow')} className="btn-primary">
          <Upload className="w-4 h-4" />
          Importer un dataset
        </button>
      </div>
    );
  }

  const datasetId = selectedDataset?.id;
  const datasetName = selectedDataset?.name;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <section className="relative rounded-2xl bg-surface-900 border border-white/5 shadow-sm">
        <div className="relative z-10 px-6 py-6 md:px-8 md:py-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">Pipeline automatique</p>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-[1.1] mb-2">
              Analyseur
            </h1>
            <p className="text-surface-400 text-[13px] leading-relaxed max-w-lg">
              Detection automatique du type de probleme, selection du pipeline optimal et execution complete.
            </p>
          </div>

          {/* Dataset Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => { setShowDatasetPicker(p => !p); setDsSearch(''); }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-accent-500/30 transition-all text-left min-w-[240px] group"
            >
              <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center shrink-0 group-hover:bg-accent-500/20 transition-colors">
                <Database className="w-4 h-4 text-accent-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Dataset</p>
                <p className="text-sm font-bold text-strong truncate">
                  {datasetName ?? 'Selectionner...'}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 transition-colors ${showDatasetPicker ? 'text-accent-400' : 'text-muted'}`}>
                {selectedDataset && (
                  <span className="text-[10px] font-semibold tabular-nums">
                    {selectedDataset.shape.rows.toLocaleString()}L
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDatasetPicker ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {showDatasetPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDatasetPicker(false)} />
                <div className="absolute top-full mt-2 right-0 w-80 bg-surface-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-scale-in origin-top-right">
                  <div className="p-2.5 border-b border-white/5">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint" />
                      <input
                        type="text"
                        placeholder="Rechercher un dataset..."
                        value={dsSearch}
                        onChange={(e) => setDsSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full pl-8 pr-8 py-2 text-xs bg-white/5 border border-white/10 rounded-lg focus:border-accent-500/40 focus:outline-none"
                      />
                      {dsSearch && (
                        <button
                          onClick={(e) => { e.stopPropagation(); clearSearch(); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-faint hover:text-default transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-y-auto no-scrollbar py-1">
                    {filteredDatasets.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <Search className="w-6 h-6 text-faint mx-auto mb-2 opacity-40" />
                        <p className="text-xs text-muted">Aucun dataset trouve</p>
                      </div>
                    ) : (
                      filteredDatasets.map(ds => (
                        <DatasetRow
                          key={ds.id}
                          ds={ds}
                          isSelected={ds.id === datasetId}
                          onSelect={() => selectDataset(ds.id)}
                        />
                      ))
                    )}
                  </div>
                  {datasets.length > 0 && (
                    <div className="px-3 py-2 border-t border-white/5 bg-white/[0.02]">
                      <p className="text-[10px] text-faint">
                        {filteredDatasets.length} dataset{filteredDatasets.length > 1 ? 's' : ''}
                        {dsSearch && <span> pour "{dsSearch}"</span>}
                        {!dsSearch && datasets.length !== filteredDatasets.length && <span> sur {datasets.length}</span>}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              activeTab === tab.key
                ? 'bg-surface-800 text-accent-300 shadow-sm border border-white/10'
                : 'text-muted hover:text-default hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="text-[10px] opacity-50 hidden md:inline">{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* Dataset selector hint if none selected */}
      {!datasetId && (
        <div className="empty-state animate-fade-in-up">
          <Layers className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-semibold text-strong mb-1">Selectionnez un dataset</p>
          <p className="text-xs text-muted">Choisissez un dataset dans le selecteur ci-dessus pour demarrer l'analyse.</p>
        </div>
      )}

      {/* Tab Content */}
      {datasetId && (
        <div className="space-y-6" key={activeTab}>
          {activeTab === 'overview' && (
            <div className="animate-fade-in-up">
              <AutoPipelinePanel
                datasetId={datasetId}
                datasetName={datasetName}
                onComplete={(execution) => {
                  if (execution) {
                    navigate('/analyzer/results', {
                      state: { autoPipelineExecution: execution, datasetId },
                    });
                  }
                }}
              />
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="animate-fade-in-up">
              <InsightsPanel datasetId={datasetId} />
            </div>
          )}

          {activeTab === 'prep' && (
            <div className="animate-fade-in-up">
              <DataPrepPanel datasetId={datasetId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv': return FileSpreadsheet;
    case 'xlsx':
    case 'xls': return Table2;
    case 'json': return FileJson;
    case 'parquet': return FileCode;
    default: return BarChart3;
  }
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function DatasetRow({ ds, isSelected, onSelect }: { ds: DatasetSummary; isSelected: boolean; onSelect: () => void }) {
  const Icon = fileIcon(ds.name);
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3.5 py-3 text-left transition-all border-l-2 ${
        isSelected
          ? 'bg-accent-500/10 border-l-accent-400'
          : 'border-l-transparent hover:bg-white/[0.03]'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
        isSelected ? 'bg-accent-500/15' : 'bg-white/5'
      }`}>
        <Icon className={`w-4 h-4 ${isSelected ? 'text-accent-400' : 'text-muted'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-strong truncate">{ds.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-faint tabular-nums">
            {ds.shape.rows.toLocaleString()}L
          </span>
          <span className="text-faint/30">·</span>
          <span className="text-[10px] text-faint tabular-nums">
            {ds.shape.columns}C
          </span>
          {ds.file_size && (
            <>
              <span className="text-faint/30">·</span>
              <span className="text-[10px] text-faint tabular-nums">{formatSize(ds.file_size)}</span>
            </>
          )}
          {ds.versions_count != null && ds.versions_count > 1 && (
            <>
              <span className="text-faint/30">·</span>
              <span className="text-[10px] text-faint">{ds.versions_count} v</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {isSelected && (
          <Check className="w-4 h-4 text-accent-400" />
        )}
        {!isSelected && (
          <Clock className="w-3 h-3 text-faint" />
        )}
        <span className="text-[9px] text-faint whitespace-nowrap">
          {new Date(ds.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
        </span>
      </div>
    </button>
  );
}
