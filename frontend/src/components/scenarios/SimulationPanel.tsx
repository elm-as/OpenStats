import { useMemo, useState } from 'react';
import { useGetFeatureRangesQuery, usePredictMutation } from '../../store/api';
import type { PredictionResult } from '../../types';
import { ArrowLeft, Play, Target, Info } from 'lucide-react';

interface Props {
  datasetId: string;
  onBack: () => void;
}

export default function SimulationPanel({ datasetId, onBack }: Props) {
  const { data: rangeData, isLoading: loadingRanges, error: rangeError } = useGetFeatureRangesQuery(datasetId);
  const [predict, { isLoading: predicting }] = usePredictMutation();

  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludedFeatures, setExcludedFeatures] = useState<Set<string>>(new Set());

  const activeFeatures = useMemo(() => {
    if (!rangeData) return [];
    return rangeData.features.filter((f) => !excludedFeatures.has(f));
  }, [rangeData, excludedFeatures]);

  const handleInitialize = () => {
    if (!rangeData) return;
    const initial: Record<string, string> = {};
    for (const fname of rangeData.features) {
      const range = rangeData.ranges[fname];
      if (range) {
        initial[fname] = range.type === 'categorical' ? range.mode : String(range.mean);
      }
    }
    setFeatureValues(initial);
  };

  const handlePredict = async () => {
    if (!rangeData) return;
    setError(null);

    const features: Record<string, number | string> = {};
    for (const fname of activeFeatures) {
      const val = featureValues[fname];
      if (val === undefined || val === '') {
        setError(`Valeur manquante pour : ${fname}`);
        return;
      }
      const range = rangeData.ranges[fname];
      if (range && range.type === 'categorical') {
        features[fname] = val;
      } else {
        const num = parseFloat(val);
        if (isNaN(num)) {
          setError(`Valeur numérique invalide pour ${fname}: "${val}"`);
          return;
        }
        features[fname] = num;
      }
    }

    try {
      setPredictions(await predict({ id: datasetId, features }).unwrap());
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur de prédiction');
    }
  };

  const toggleFeature = (fname: string) => {
    setExcludedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(fname)) next.delete(fname);
      else next.add(fname);
      return next;
    });
  };

  if (loadingRanges) {
    return (
      <div className="flex items-center justify-center py-10 text-xs ui-t-muted">
        <div className="animate-spin w-4 h-4 border-2 border-accent-500 border-t-transparent rounded-full mr-2" />
        Chargement du modèle...
      </div>
    );
  }

  if (rangeError || !rangeData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--ui-text)]">Simulation / Prédiction</h3>
          <button onClick={onBack} className="ui-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </button>
        </div>
        <div className="ui-panel p-5 text-center border border-amber-500/30 bg-amber-500/10">
          <Target className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <h4 className="font-semibold text-sm text-[var(--ui-text)] mb-1">Modèle non disponible</h4>
          <p className="text-xs ui-t-muted">
            Entraînez d'abord un modèle dans l'onglet Modélisation pour obtenir des prédictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--ui-text)]">Simulation / Prédiction</h3>
        <button onClick={onBack} className="ui-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      <div className="ui-panel px-3.5 py-2 flex items-center gap-2 text-xs">
        <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-[var(--ui-text)]">
          Modèle : <strong>{rangeData.best_model_key}</strong> ({rangeData.task_type === 'regression' ? 'Régression' : 'Classification'})
        </span>
      </div>

      <div className="ui-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-xs uppercase tracking-wider ui-t-muted ui-num">
            Variables explicatives ({activeFeatures.length}/{rangeData.features.length})
          </h4>
          <button onClick={handleInitialize} className="ui-btn ui-btn-ghost text-xs text-accent-400">
            Remplir les valeurs par défaut
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rangeData.features.map((fname) => {
            const range = rangeData.ranges[fname];
            const isExcluded = excludedFeatures.has(fname);
            return (
              <div
                key={fname}
                className={`border rounded-md p-3 transition-opacity ${isExcluded ? 'opacity-40' : ''}`}
                style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
              >
                <label className="flex items-center gap-2 text-xs font-medium text-[var(--ui-text)] cursor-pointer mb-1.5">
                  <input
                    type="checkbox"
                    checked={!isExcluded}
                    onChange={() => toggleFeature(fname)}
                    className="rounded"
                  />
                  {fname}
                </label>

                {range?.type === 'categorical' ? (
                  <select
                    value={featureValues[fname] ?? ''}
                    onChange={(e) => setFeatureValues((prev) => ({ ...prev, [fname]: e.target.value }))}
                    disabled={isExcluded}
                    className="ui-select w-full text-xs"
                  >
                    <option value="" disabled>Sélectionner...</option>
                    {range.categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    value={featureValues[fname] ?? ''}
                    onChange={(e) => setFeatureValues((prev) => ({ ...prev, [fname]: e.target.value }))}
                    disabled={isExcluded}
                    step="any"
                    className="ui-input w-full text-xs ui-num"
                    placeholder={range?.type === 'numeric' ? `${range.min} — ${range.max}` : ''}
                  />
                )}

                {range?.type === 'numeric' && !isExcluded && (
                  <div className="text-[11px] ui-t-muted mt-1 flex justify-between ui-num">
                    <span>Min: {range.min.toFixed(2)}</span>
                    <span>Moy: {range.mean.toFixed(2)}</span>
                    <span>Max: {range.max.toFixed(2)}</span>
                  </div>
                )}

                {range?.type === 'categorical' && !isExcluded && (
                  <div className="text-[11px] ui-t-muted mt-1 flex justify-between ui-num">
                    <span>Mode: {range.mode}</span>
                    <span>{range.categories.length} mod.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">{error}</div>
        )}

        <div className="mt-4">
          <button onClick={handlePredict} disabled={predicting || activeFeatures.length === 0} className="ui-btn ui-btn-primary text-xs">
            <Play className="w-3.5 h-3.5" />
            {predicting ? 'Prédiction...' : 'Prédire'}
          </button>
        </div>
      </div>

      {predictions && (
        <div className="ui-panel p-4 border border-emerald-500/30 space-y-3">
          <h4 className="font-semibold text-emerald-400 flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" />
            Résultat de la prédiction
          </h4>

          <div className="space-y-2.5">
            {predictions.predictions.map((pred, i) => (
              <div
                key={i}
                className="rounded p-3 border"
                style={{ background: 'var(--ui-bg-sunken)', borderColor: 'var(--ui-border)' }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-xs ui-t-muted">Valeur prédite</span>
                  <span className="text-lg font-bold text-emerald-400 ui-num">
                    {typeof pred === 'number' ? pred.toFixed(4) : String(pred)}
                  </span>
                </div>

                {predictions.probabilities?.[i] && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1">
                    {Object.entries(predictions.probabilities[i]).map(([cls, prob]) => (
                      <div key={cls} className="flex items-center gap-2 text-xs">
                        <span className="font-medium w-24 truncate">{cls}</span>
                        <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: 'var(--ui-bg-raised)' }}>
                          <div className="h-full bg-emerald-500" style={{ width: `${(prob as number) * 100}%` }} />
                        </div>
                        <span className="ui-t-muted w-14 text-right ui-num">
                          {((prob as number) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-[11px] ui-t-muted border-t border-white/10 pt-2">
            Modèle : <strong>{predictions.model_used}</strong> — Variables : {predictions.features_used.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
