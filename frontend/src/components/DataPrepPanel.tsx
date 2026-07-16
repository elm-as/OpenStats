import React, { useState } from 'react';
import { api } from '../store/api';
import { Loader2, Copy, Trash2, Plus, Settings2, Check, AlertCircle, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  datasetId: string;
}

interface PipelineStep {
  id: string;
  step: string;
  config: Record<string, any>;
}

const DEFAULT_STEPS: PipelineStep[] = [
  { id: '1', step: 'deduplication', config: {} },
  { id: '2', step: 'missing_values', config: { default_strategy: 'median' } },
  { id: '3', step: 'outliers', config: { method: 'iqr', treatment: 'cap' } },
];

const AVAILABLE_STEPS = [
  { value: 'deduplication', label: 'Déduplication' },
  { value: 'missing_values', label: 'Valeurs Manquantes' },
  { value: 'outliers', label: 'Valeurs Aberrantes' },
  { value: 'normalization', label: 'Normalisation' },
  { value: 'encoding', label: 'Encodage (One-Hot)' },
];

export default function DataPrepPanel({ datasetId }: Props) {
  const [pipeline, setPipeline] = useState<PipelineStep[]>(DEFAULT_STEPS);
  const [copyName, setCopyName] = useState('');
  
  const [copyDataset, { isLoading: isCopying, error: copyError }] = api.useCopyDatasetMutation();
  const [cleanDataset, { isLoading: isCleaning, error: cleanError }] = api.useCleanDatasetMutation();
  const { data: datasetDetails } = api.useGetDatasetQuery(datasetId);
  const navigate = useNavigate();

  const handleApply = async () => {
    if (pipeline.length === 0) return;
    try {
      // 1. Copy dataset
      const copyRes = await copyDataset({ 
        id: datasetId, 
        new_name: copyName.trim() || `${datasetDetails?.name || 'Dataset'}-cp` 
      }).unwrap();
      
      const newDatasetId = copyRes.dataset.id;
      
      // 2. Apply cleaning pipeline to the new dataset
      const cleanPayload = pipeline.map(p => ({ step: p.step, config: p.config }));
      await cleanDataset({ id: newDatasetId, pipeline: cleanPayload }).unwrap();
      
      // Navigate to the new dataset
      navigate('/analyzer', { replace: true });
      // We might need to refresh the page or switch the selected dataset.
      // Wait, the router doesn't know what dataset to load just by '/analyzer' if it auto-picks the first one.
      // Let's just navigate to '/workflow' so the user sees the new dataset, or wait, does useListDatasetsQuery auto-update?
      // It auto-updates because we invalidated 'Dataset' tags. The UI will pick the new one if we sort by date, or we can just stay and let the user select it from the sidebar/header.
      window.location.reload(); // Quickest way to ensure everything re-mounts with the newest dataset if the UI picks the first.
    } catch (e) {
      console.error(e);
    }
  };

  const addStep = (stepValue: string) => {
    setPipeline([...pipeline, { id: Math.random().toString(36).substr(2, 9), step: stepValue, config: {} }]);
  };

  const removeStep = (id: string) => {
    setPipeline(pipeline.filter(p => p.id !== id));
  };

  const updateConfig = (id: string, key: string, value: any) => {
    setPipeline(pipeline.map(p => {
      if (p.id === id) {
        return { ...p, config: { ...p.config, [key]: value } };
      }
      return p;
    }));
  };

  const isLoading = isCopying || isCleaning;

  return (
    <div className="bg-surface-800/60 backdrop-blur border border-white/10 rounded-xl overflow-hidden animate-fade-in">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-accent-500/10 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Settings2 className="w-5 h-5 text-accent-400" />
            <div className="absolute inset-0 bg-accent-400 blur-md opacity-30 -z-10" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-surface-100">Préparation des données</h3>
            <p className="text-xs text-surface-400 mt-0.5">Configurez les transformations à appliquer sur une copie du dataset.</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Pipeline Configurator */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Pipeline de nettoyage</h4>
          
          <div className="space-y-2">
            {pipeline.map((step, index) => (
              <div key={step.id} className="flex flex-col sm:flex-row gap-3 p-3 bg-surface-900/50 rounded-lg border border-white/5 relative group">
                <div className="flex items-center gap-3 w-full sm:w-1/3">
                  <span className="text-xs font-mono text-surface-400 bg-black/20 w-5 h-5 flex items-center justify-center rounded">{index + 1}</span>
                  <span className="text-sm font-medium text-surface-300 capitalize">{step.step.replace('_', ' ')}</span>
                </div>
                
                <div className="flex-1 flex flex-wrap items-center gap-3">
                  {step.step === 'missing_values' && (
                    <select 
                      className="bg-black/20 border border-white/10 rounded text-xs text-surface-300 p-1.5 focus:border-accent-500 outline-none"
                      value={step.config.default_strategy || 'median'}
                      onChange={(e) => updateConfig(step.id, 'default_strategy', e.target.value)}
                    >
                      <option value="median">Médiane</option>
                      <option value="mean">Moyenne</option>
                      <option value="mode">Mode</option>
                      <option value="drop">Supprimer</option>
                    </select>
                  )}
                  {step.step === 'outliers' && (
                    <>
                      <select 
                        className="bg-black/20 border border-white/10 rounded text-xs text-surface-300 p-1.5 focus:border-accent-500 outline-none"
                        value={step.config.method || 'iqr'}
                        onChange={(e) => updateConfig(step.id, 'method', e.target.value)}
                      >
                        <option value="iqr">IQR</option>
                        <option value="zscore">Z-Score</option>
                      </select>
                      <select 
                        className="bg-black/20 border border-white/10 rounded text-xs text-surface-300 p-1.5 focus:border-accent-500 outline-none"
                        value={step.config.treatment || 'cap'}
                        onChange={(e) => updateConfig(step.id, 'treatment', e.target.value)}
                      >
                        <option value="cap">Plafonner (Cap)</option>
                        <option value="drop">Supprimer</option>
                      </select>
                    </>
                  )}
                  {step.step === 'normalization' && (
                    <select 
                      className="bg-black/20 border border-white/10 rounded text-xs text-surface-300 p-1.5 focus:border-accent-500 outline-none"
                      value={step.config.method || 'standard'}
                      onChange={(e) => updateConfig(step.id, 'method', e.target.value)}
                    >
                      <option value="standard">Standard (Z-score)</option>
                      <option value="minmax">Min-Max</option>
                      <option value="robust">Robuste</option>
                    </select>
                  )}
                </div>

                <button 
                  onClick={() => removeStep(step.id)}
                  className="absolute right-3 top-3 text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <select 
              id="new-step-select"
              className="bg-white/5 border border-white/10 rounded-lg text-sm text-surface-300 px-3 py-1.5 focus:border-accent-500 outline-none"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  addStep(e.target.value);
                  e.target.value = '';
                }
              }}
            >
              <option value="" disabled>+ Ajouter une étape</option>
              {AVAILABLE_STEPS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Action Area */}
        <div className="bg-gradient-to-br from-surface-900 to-surface-800 p-4 rounded-xl border border-accent-500/20 shadow-glow-sm">
          <h4 className="text-sm font-semibold text-surface-300 mb-3 flex items-center gap-2">
            <Copy className="w-4 h-4 text-accent-400" />
            Finaliser la copie et appliquer
          </h4>
          
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs text-surface-400 mb-1">Nom du nouveau dataset (optionnel)</label>
              <input 
                type="text"
                placeholder={`${datasetDetails?.name || 'Dataset'}-cp`}
                value={copyName}
                onChange={e => setCopyName(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg text-sm text-surface-300 px-3 py-2 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all"
              />
            </div>
            
            <button
              onClick={handleApply}
              disabled={isLoading || pipeline.length === 0}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isCopying ? 'Copie...' : 'Nettoyage...'}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Créer et Appliquer
                </>
              )}
            </button>
          </div>

          {(copyError || cleanError) && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Une erreur est survenue lors de l'opération.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
