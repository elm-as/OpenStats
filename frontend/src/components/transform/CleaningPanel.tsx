import { useState } from 'react';
import { useAutoCleanMutation, useCleanDatasetMutation } from '../../store/api';
import type { CleaningResult, CleaningStepConfig } from '../../types';
import { Settings, CheckCircle2, Play } from 'lucide-react';

interface Props {
  datasetId: string;
  onCleaned: () => void;
}

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
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="ui-panel overflow-hidden flex flex-col">
          <header className="ui-panel-header">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
              <Play className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
              Nettoyage automatique
            </span>
          </header>
          <div className="p-3 flex-1 flex flex-col justify-between gap-3">
            <p className="text-xs ui-t-muted">
              Déduplication, imputation par la médiane et plafonnement des valeurs extrêmes (IQR).
            </p>
            <button
              onClick={handleAutoClean}
              disabled={isLoading}
              className="ui-btn ui-btn-primary ui-focusable w-full justify-center"
            >
              {autoLoading ? 'Nettoyage en cours…' : 'Lancer le nettoyage automatique'}
            </button>
          </div>
        </section>

        <section className="ui-panel overflow-hidden">
          <header className="ui-panel-header">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
              <Settings className="w-3.5 h-3.5 ui-t-muted" />
              Configuration manuelle
            </span>
          </header>
          <div className="p-3 space-y-2.5">
            <div>
              <label className="ui-label block mb-1">Valeurs manquantes</label>
              <select
                value={missingStrategy}
                onChange={e => setMissingStrategy(e.target.value)}
                className="ui-select w-full"
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="ui-label block mb-1">Détection extrêmes</label>
                <select
                  value={outlierMethod}
                  onChange={e => setOutlierMethod(e.target.value)}
                  className="ui-select w-full"
                  title="Détection outliers"
                >
                  <option value="iqr">IQR (Interquartile)</option>
                  <option value="zscore">Z-Score</option>
                  <option value="isolation_forest">Isolation Forest</option>
                </select>
              </div>
              <div>
                <label className="ui-label block mb-1">Traitement extrêmes</label>
                <select
                  value={outlierTreatment}
                  onChange={e => setOutlierTreatment(e.target.value)}
                  className="ui-select w-full"
                  title="Traitement outliers"
                >
                  <option value="cap">Plafonnement (winsorisation)</option>
                  <option value="remove">Suppression</option>
                  <option value="log">Transformation log</option>
                  <option value="flag">Marquage (indicatrice)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleCustomClean}
              disabled={isLoading}
              className="ui-btn ui-btn-primary ui-focusable w-full justify-center"
            >
              {cleanLoading ? 'Nettoyage en cours…' : 'Appliquer la configuration'}
            </button>
          </div>
        </section>
      </div>

      {result && (
        <section className="ui-panel overflow-hidden" style={{ borderColor: 'var(--ui-success)' }}>
          <header className="ui-panel-header">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-success)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Nettoyage terminé
            </span>
            <span className="ui-num text-xs ui-t-muted">
              {result.shape_before.rows.toLocaleString('fr-FR')} × {result.shape_before.columns} →{' '}
              <strong style={{ color: 'var(--ui-text)' }}>
                {result.shape_after.rows.toLocaleString('fr-FR')} × {result.shape_after.columns}
              </strong>
            </span>
          </header>
          <div className="p-3 space-y-1">
            {result.logs.map((log, i) => (
              <p key={i} className="text-xs ui-t-secondary">
                <strong style={{ color: 'var(--ui-text)' }}>{log.step}</strong> : {log.message}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
