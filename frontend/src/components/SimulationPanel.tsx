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
        initial[fname] = String(range.mean);
      }
    }
    setFeatureValues(initial);
  };





  const handlePredict = async () => {
    if (!rangeData) return;
    setError(null);

    // Build features dict
    const features: Record<string, number> = {};
    for (const fname of activeFeatures) {
      const val = featureValues[fname];
      if (val === undefined || val === '') {
        setError(`Valeur manquante pour : ${fname}`);
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        setError(`Valeur invalide pour ${fname}: "${val}"`);
        return;
      }
      features[fname] = num;
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
      <div className="card bg-emerald-50 border-emerald-200">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            Modèle : <strong>{rangeData.best_model_key}</strong> — Type : <strong>{rangeData.task_type === 'regression' ? 'Régression' : 'Classification'}</strong>
          </span>
        </div>
        <p className="text-xs text-emerald-700">
          Saisissez les valeurs des variables explicatives pour obtenir une prédiction.
          Décochez les variables que vous souhaitez exclure.
        </p>
      </div>



      {/* Feature inputs */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Variables explicatives ({activeFeatures.length}/{rangeData.features.length})</h4>
          <button
            onClick={handleInitialize}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Remplir avec les moyennes
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rangeData.features.map((fname) => {
            const range = rangeData.ranges[fname];
            const isExcluded = excludedFeatures.has(fname);
            return (
              <div
                key={fname}
                className={`border rounded-lg p-3 transition-all ${isExcluded ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!isExcluded}
                      onChange={() => toggleFeature(fname)}
                      className="rounded border-gray-300 text-emerald-600"
                    />
                    {fname}
                  </label>
                </div>
                <input
                  type="number"
                  value={featureValues[fname] ?? ''}
                  onChange={(e) => setFeatureValues((prev) => ({ ...prev, [fname]: e.target.value }))}
                  disabled={isExcluded}
                  step="any"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                  placeholder={range ? `${range.min} — ${range.max}` : ''}
                />
                {range && !isExcluded && (
                  <div className="text-xs text-gray-400 mt-1 flex justify-between">
                    <span>Min: {range.min.toFixed(2)}</span>
                    <span>Moy: {range.mean.toFixed(2)}</span>
                    <span>Max: {range.max.toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
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
        <div className="card border-emerald-200 bg-emerald-50">
          <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Résultat de la prédiction
          </h4>

          <div className="space-y-3">
            {predictions.predictions.map((pred, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-emerald-200">
                <div className="text-center">
                  <span className="text-sm text-gray-500">Valeur prédite</span>
                  <div className="text-3xl font-bold text-emerald-700 mt-1">
                    {typeof pred === 'number' ? pred.toFixed(4) : String(pred)}
                  </div>
                </div>

                {/* Probabilities for classification */}
                {predictions.probabilities?.[i] && (
                  <div className="mt-3 pt-3 border-t border-emerald-100">
                    <span className="text-xs font-medium text-gray-600">Probabilités par classe :</span>
                    <div className="mt-2 space-y-1">
                      {Object.entries(predictions.probabilities[i]).map(([cls, prob]) => (
                        <div key={cls} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700 w-20 truncate">{cls}</span>
                          <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${(prob as number) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-14 text-right">
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

          <div className="mt-3 text-xs text-emerald-700">
            Modèle utilisé : <strong>{predictions.model_used}</strong> — 
            Variables : {predictions.features_used.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

