import { useEffect, useMemo, useState } from 'react';
import { useGetFeatureRangesQuery, usePredictMutation } from '../store/api';
import type { PredictionResult } from '../types';
import { ArrowLeft, Play, Target, Info, SlidersHorizontal } from 'lucide-react';

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



  // Initialize values with means when range data loads
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
        if (range.type === 'categorical') {
          initial[fname] = range.mode;
        } else {
          initial[fname] = String(range.mean);
        }
      }
    }
    setFeatureValues(initial);
  };





  const handlePredict = async () => {
    if (!rangeData) return;
    setError(null);

    // Build features dict
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
      const result = await predict({ id: datasetId, features }).unwrap();
      setPredictions(result);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur de prédiction');
    }
  };

  const toggleFeature = (fname: string) => {
    setExcludedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(fname)) {
        next.delete(fname);
      } else {
        next.add(fname);
      }
      return next;
    });
  };

  if (loadingRanges) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-600">Chargement des informations du modèle...</span>
      </div>
    );
  }

  if (rangeError || !rangeData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Simulation / Prédiction</h3>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
        <div className="card bg-amber-50 border-amber-200 p-6 text-center">
          <Target className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h4 className="font-semibold text-amber-800 mb-2">Modèle non disponible</h4>
          <p className="text-sm text-amber-700">
            Entraînez d'abord un modèle dans l'onglet Modélisation pour pouvoir faire des prédictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">Simulation / Prédiction</h3>
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>

      {/* Model info */}
      <div className="card bg-emerald-500/10 border-emerald-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-200">
            Modèle : <strong className="text-emerald-100">{rangeData.best_model_key}</strong> — Type : <strong className="text-emerald-100">{rangeData.task_type === 'regression' ? 'Régression' : 'Classification'}</strong>
          </span>
        </div>
        <p className="text-xs text-emerald-300/80">
          Saisissez les valeurs des variables explicatives pour obtenir une prédiction.
          Décochez les variables que vous souhaitez exclure. Le modèle comblera automatiquement les variables manquantes.
        </p>
      </div>



      {/* Feature inputs */}
      <div className="card border-surface-700 bg-surface-900/50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-surface-100">Variables explicatives ({activeFeatures.length}/{rangeData.features.length})</h4>
          <button
            onClick={handleInitialize}
            className="text-sm text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
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
                className={`border rounded-xl p-3.5 transition-all duration-200 ${isExcluded ? 'bg-surface-800/20 opacity-40 border-surface-700/30' : 'bg-surface-800/80 border-surface-700 shadow-sm hover:border-surface-600'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-surface-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => toggleFeature(fname)}
                      className="rounded border-surface-600 bg-surface-900 text-accent-500 focus:ring-accent-500/30"
                    />
                    {fname}
                  </label>
                </div>
                
                {range?.type === 'categorical' ? (
                  <select
                    value={featureValues[fname] ?? ''}
                    onChange={(e) => setFeatureValues((prev) => ({ ...prev, [fname]: e.target.value }))}
                    disabled={isExcluded}
                    className="w-full border border-surface-700/60 rounded-lg px-3 py-1.5 text-sm bg-surface-900/50 text-surface-200 focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50 disabled:bg-surface-900/30 disabled:text-surface-600 transition-colors"
                  >
                    <option value="" disabled>Sélectionner...</option>
                    {range.categories.map(cat => (
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
                    className="w-full border border-surface-700/60 rounded-lg px-3 py-1.5 text-sm bg-surface-900/50 text-surface-200 focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50 disabled:bg-surface-900/30 disabled:text-surface-600 transition-colors placeholder:text-surface-600"
                    placeholder={range?.type === 'numeric' ? `${range.min} — ${range.max}` : ''}
                  />
                )}
                
                {range?.type === 'numeric' && !isExcluded && (
                  <div className="text-xs text-surface-400 mt-1 flex justify-between">
                    <span>Min: {range.min.toFixed(2)}</span>
                    <span>Moy: {range.mean.toFixed(2)}</span>
                    <span>Max: {range.max.toFixed(2)}</span>
                  </div>
                )}
                
                {range?.type === 'categorical' && !isExcluded && (
                  <div className="text-xs text-surface-400 mt-1 flex justify-between">
                    <span>Mode: {range.mode}</span>
                    <span>{range.categories.length} catégories</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
        )}

        <div className="mt-4 flex gap-3">
          <button onClick={handlePredict} disabled={predicting || activeFeatures.length === 0} className="btn-primary flex items-center gap-2">
            {predicting ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Prédiction...</>
            ) : (
              <><Play className="w-4 h-4" /> Prédire</>
            )}
          </button>
        </div>
      </div>



      {/* Prediction results */}
      {predictions && (
        <div className="card border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-900/10 mt-6 shadow-xl shadow-emerald-900/20 rounded-xl">
          <h4 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2 text-lg">
            <Target className="w-5 h-5" />
            Résultat de la prédiction
          </h4>

          <div className="space-y-3">
            {predictions.predictions.map((pred, i) => (
              <div key={i} className="bg-surface-800 rounded-lg p-4 border border-emerald-500/20">
                <div className="text-center">
                  <span className="text-sm text-surface-400">Valeur prédite</span>
                  <div className="text-3xl font-bold text-emerald-400 mt-1">
                    {typeof pred === 'number' ? pred.toFixed(4) : String(pred)}
                  </div>
                </div>

                {/* Probabilities for classification */}
                {predictions.probabilities?.[i] && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20">
                    <span className="text-xs font-medium text-surface-300">Probabilités par classe :</span>
                    <div className="mt-2 space-y-1">
                      {Object.entries(predictions.probabilities[i]).map(([cls, prob]) => (
                        <div key={cls} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-200 w-20 truncate">{cls}</span>
                          <div className="flex-1 h-4 bg-surface-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${(prob as number) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-surface-400 w-14 text-right">
                            {((prob as number) * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-emerald-400/70 border-t border-emerald-500/20 pt-3">
            Modèle utilisé : <strong className="text-emerald-300">{predictions.model_used}</strong> — 
            Variables : {predictions.features_used.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

