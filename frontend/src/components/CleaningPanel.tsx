import { useState } from 'react';
import { useAutoCleanMutation, useCleanDatasetMutation } from '../store/api';
import type { CleaningResult, CleaningStepConfig } from '../types';
import { Sparkles, Settings, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  datasetId: string;
  onCleaned: () => void;
}

const DEFAULT_PIPELINE: CleaningStepConfig[] = [
  { step: 'deduplication', config: {} },
  { step: 'missing_values', config: { default_strategy: 'median' } },
  { step: 'outliers', config: { method: 'iqr', treatment: 'cap', threshold: 1.5 } },
];

export default function CleaningPanel({ datasetId, onCleaned }: Props) {
  const [autoClean, { isLoading: autoLoading }] = useAutoCleanMutation();
  const [cleanDataset, { isLoading: cleanLoading }] = useCleanDatasetMutation();
  const [result, setResult] = useState<CleaningResult | null>(null);
  const [missingStrategy, setMissingStrategy] = useState('median');
  const [outlierMethod, setOutlierMethod] = useState('iqr');
  const [outlierTreatment, setOutlierTreatment] = useState('cap');

  const handleAutoClean = async () => {
    try {
      const res = await autoClean(datasetId).unwrap();
      setResult(res);
      onCleaned();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomClean = async () => {
    const pipeline: CleaningStepConfig[] = [
      { step: 'deduplication', config: {} },
      { step: 'missing_values', config: { default_strategy: missingStrategy } },
      { step: 'outliers', config: { method: outlierMethod, treatment: outlierTreatment, threshold: 1.5 } },
    ];
    try {
      const res = await cleanDataset({ id: datasetId, pipeline }).unwrap();
      setResult(res);
      onCleaned();
    } catch (err) {
      console.error(err);
    }
  };

  const isLoading = autoLoading || cleanLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Nettoyage des données</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configurez le pipeline ou utilisez le nettoyage automatique
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nettoyage automatique */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold text-gray-900">Nettoyage automatique</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Déduplication, imputation par la médiane, et plafonnement des outliers (IQR).
          </p>
          <button onClick={handleAutoClean} disabled={isLoading} className="btn-primary w-full">
            {autoLoading ? 'Nettoyage en cours...' : 'Lancer le nettoyage auto'}
          </button>
        </div>

        {/* Configuration manuelle */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Configuration manuelle</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valeurs manquantes</label>
              <select
                value={missingStrategy}
                onChange={(e) => setMissingStrategy(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                title="Valeurs manquantes"
              >
                <option value="mean">Moyenne</option>
                <option value="median">Médiane</option>
                <option value="mode">Mode</option>
                <option value="knn">KNN (K=5)</option>
                <option value="drop">Suppression</option>
                <option value="forward_fill">Forward Fill</option>
                <option value="interpolate">Interpolation linéaire</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Détection outliers</label>
              <select
                value={outlierMethod}
                onChange={(e) => setOutlierMethod(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                title="Détection outliers"
              >
                <option value="iqr">IQR (Interquartile Range)</option>
                <option value="zscore">Z-Score</option>
                <option value="isolation_forest">Isolation Forest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Traitement outliers</label>
              <select
                value={outlierTreatment}
                onChange={(e) => setOutlierTreatment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                title="Traitement outliers"
              >
                <option value="cap">Plafonnement (winsorisation)</option>
                <option value="remove">Suppression</option>
                <option value="log">Transformation log</option>
                <option value="flag">Marquage (indicatrice)</option>
              </select>
            </div>
          </div>

          <button onClick={handleCustomClean} disabled={isLoading} className="btn-primary w-full mt-4">
            {cleanLoading ? 'Nettoyage en cours...' : 'Appliquer la configuration'}
          </button>
        </div>
      </div>

      {/* Résultats */}
      {result && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Nettoyage terminé</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <span className="text-gray-600">Avant :</span>{' '}
              <span className="font-mono">{result.shape_before.rows} × {result.shape_before.columns}</span>
            </div>
            <div>
              <span className="text-gray-600">Après :</span>{' '}
              <span className="font-mono">{result.shape_after.rows} × {result.shape_after.columns}</span>
            </div>
          </div>
          <div className="space-y-1">
            {result.logs.map((log, i) => (
              <p key={i} className="text-sm text-gray-600">
                <span className="font-medium">{log.step}</span> : {log.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
