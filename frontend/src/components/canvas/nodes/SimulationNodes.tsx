import { useState, useCallback, useEffect } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { PlayCircle } from 'lucide-react';
import { API_V1_BASE, getAnonymousClientId } from '../../../lib/apiBase';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeNumberInput,
  useNodeUpdate, NodeToggle, NodeCollapsible, NodeSeedInput, useConnectedColumns
} from './_shared';

interface FeatureRange {
  min: number;
  mean: number;
  max: number;
}

export function SimulationNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';
  const simType = (data.simulationType as string) || 'prediction';
  const { dsId } = useConnectedColumns(id);
  
  const [featureRanges, setFeatureRanges] = useState<Record<string, FeatureRange> | null>(null);
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [excludedFeatures, setExcludedFeatures] = useState<Set<string>>(new Set());
  const [predictResult, setPredictResult] = useState<any>(null);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);

  useEffect(() => {
    if (simType === 'prediction' && dsId) {
      const fetchRanges = async () => {
        try {
          const response = await fetch(`${API_V1_BASE}/datasets/${dsId}/model/feature-ranges`, {
            headers: { 'X-Client-Id': (() => { try { return getAnonymousClientId(); } catch { return ''; } })() },
          });
          if (response.ok) {
            const result = await response.json();
            setFeatureRanges(result.ranges || {});
          }
        } catch { /* silencieux */ }
      };
      fetchRanges();
    }
  }, [simType, dsId]);

  const handleInitializeMeans = useCallback(() => {
    if (!featureRanges) return;
    const initial: Record<string, string> = {};
    for (const [fname, range] of Object.entries(featureRanges)) {
      initial[fname] = String(range.mean);
    }
    setFeatureValues(initial);
  }, [featureRanges]);

  const toggleFeature = (fname: string) => {
    setExcludedFeatures(prev => {
      const next = new Set(prev);
      if (next.has(fname)) next.delete(fname);
      else next.add(fname);
      return next;
    });
  };

  const handlePredict = async () => {
    if (!dsId || !featureRanges) return;
    setPredictError(null);
    setPredictResult(null);
    setLoadingPrediction(true);

    const features: Record<string, number> = {};
    const activeFeatures = Object.keys(featureRanges).filter(f => !excludedFeatures.has(f));
    for (const fname of activeFeatures) {
      const val = featureValues[fname];
      if (val === undefined || val === '') {
        setPredictError(`Valeur manquante pour : ${fname}`);
        setLoadingPrediction(false);
        return;
      }
      const num = parseFloat(val);
      if (isNaN(num)) {
        setPredictError(`Valeur invalide pour : ${fname}`);
        setLoadingPrediction(false);
        return;
      }
      features[fname] = num;
    }

    try {
      const response = await fetch(`${API_V1_BASE}/datasets/${dsId}/model/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': (() => { try { return getAnonymousClientId(); } catch { return ''; } })(),
        },
        body: JSON.stringify({ features }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur de prédiction');
      }
      const result = await response.json();
      setPredictResult(result);
    } catch (err: any) {
      setPredictError(err.message || 'Erreur de prédiction');
    } finally {
      setLoadingPrediction(false);
    }
  };

  const activeCount = featureRanges ? Object.keys(featureRanges).filter(f => !excludedFeatures.has(f)).length : 0;
  
  return (
    <NodeShell id={id} data={data} color="#f97316" icon={PlayCircle} title="Simulation & Scénarios" hasInput>
      <div>
        <NodeLabel>Type</NodeLabel>
        <NodeSelect name="simulationType" value={simType} onChange={handleChange}>
          <option value="prediction">Prédiction unitaire</option>
          <option value="monte_carlo">Simulation de Monte Carlo</option>
          <option value="sensitivity">Analyse de sensibilité</option>
          <option value="tornado">Tornado chart</option>
          <option value="stress_test">Stress test</option>
          <option value="scenarios">Comparaison de scénarios</option>
        </NodeSelect>
      </div>
      <div className="flex items-center justify-between pt-1">
        <NodeToggle value={mode} onChange={handleChange} />
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? 'Paramétrable' : 'Défauts optimaux'}
        </span>
      </div>
      {isAdvanced && simType !== 'prediction' && (
        <NodeCollapsible title="Paramètres de simulation" defaultOpen>
          {simType === 'monte_carlo' && (
            <div>
              <NodeLabel>Nombre de simulations</NodeLabel>
              <NodeNumberInput name="nSimulations" placeholder="1000" value={(data.nSimulations as string) || ''} onChange={handleChange} min={100} max={100000} step={100} />
            </div>
          )}
          {simType === 'sensitivity' && (
            <div className="space-y-2">
              <div>
                <NodeLabel>Nb points</NodeLabel>
                <NodeNumberInput name="nPoints" placeholder="20" value={(data.nPoints as string) || ''} onChange={handleChange} min={5} max={100} />
              </div>
              <div>
                <NodeLabel>Plage de variation (%)</NodeLabel>
                <NodeNumberInput name="rangePct" placeholder="20" value={(data.rangePct as string) || ''} onChange={handleChange} min={1} max={100} />
              </div>
            </div>
          )}
          {simType === 'stress_test' && (
            <div>
              <NodeLabel>Sigmas à tester</NodeLabel>
              <NodeSelect name="sigmas" value={(data.sigmas as string) || '1,2,3'} onChange={handleChange}>
                <option value="1,2,3">±1σ, ±2σ, ±3σ</option>
                <option value="1,2,3,4,5">±1σ à ±5σ</option>
                <option value="2,3">±2σ, ±3σ</option>
              </NodeSelect>
            </div>
          )}
          {(simType === 'tornado' || simType === 'tornado') && (
            <div>
              <NodeLabel>Sigma (amplitude)</NodeLabel>
              <NodeNumberInput name="sigma" placeholder="1" value={(data.sigma as string) || ''} onChange={handleChange} min={0.5} max={5} step={0.5} />
            </div>
          )}
          <NodeSeedInput value={(data.seed as string) || ''} onChange={handleChange} />
        </NodeCollapsible>
      )}

      {simType === 'prediction' && (
        <NodeCollapsible title="Prédiction unitaire" defaultOpen>
          {!dsId ? (
            <div className="text-[10px] text-amber-400/80 bg-amber-500/10 p-2 rounded-lg border border-amber-500/15">
              Connectez ce bloc à une source de données via une arête.
            </div>
          ) : !featureRanges ? (
            <div className="text-[10px] text-surface-400 bg-white/5 p-2 rounded-lg">
              <div className="w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle" />
              Chargement des features...
            </div>
          ) : Object.keys(featureRanges).length === 0 ? (
            <div className="text-[10px] text-amber-400/80 bg-amber-500/10 p-2 rounded-lg border border-amber-500/15">
              Aucun modèle disponible. Entraînez d'abord un modèle.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-surface-500">{activeCount}/{Object.keys(featureRanges).length} features</span>
                <button
                  type="button"
                  onClick={handleInitializeMeans}
                  className="text-[9px] text-accent-400 hover:text-accent-300 font-medium"
                >
                  Remplir moyennes
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {Object.entries(featureRanges).map(([fname, range]) => {
                  const isExcluded = excludedFeatures.has(fname);
                  return (
                    <div key={fname} className={`rounded-lg p-2 border transition-colors ${isExcluded ? 'bg-surface-800/20 border-white/[0.02] opacity-50' : 'bg-surface-800/40 border-white/[0.04]'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={() => toggleFeature(fname)}
                            className="w-3 h-3 rounded border-white/20 bg-white/5 accent-accent-500"
                          />
                          <span className="text-[11px] text-surface-300 font-medium">{fname}</span>
                        </label>
                      </div>
                      <input
                        type="number"
                        value={featureValues[fname] ?? ''}
                        onChange={(e) => setFeatureValues(prev => ({ ...prev, [fname]: e.target.value }))}
                        disabled={isExcluded}
                        step="any"
                        className="w-full px-2 py-1 rounded bg-black/30 border border-white/[0.08] text-surface-100 text-[11px] placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder={`${range.min.toFixed(2)} — ${range.max.toFixed(2)}`}
                      />
                      {!isExcluded && (
                        <div className="text-[8px] text-surface-600 mt-1 flex justify-between">
                          <span>Min: {range.min.toFixed(2)}</span>
                          <span>Moy: {range.mean.toFixed(2)}</span>
                          <span>Max: {range.max.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {predictError && (
                <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/15">{predictError}</div>
              )}

              <button
                type="button"
                onClick={handlePredict}
                disabled={loadingPrediction || activeCount === 0}
                className="w-full py-2 px-3 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/30 text-accent-300 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingPrediction ? 'Prédiction...' : 'Prédire'}
              </button>

              {predictResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1.5">
                  <div className="text-[10px] text-emerald-400 font-semibold">Résultat</div>
                  {predictResult.predictions?.map((pred: any, i: number) => (
                    <div key={i} className="text-center">
                      <div className="text-lg font-bold text-emerald-300">
                        {typeof pred === 'number' ? pred.toFixed(4) : String(pred)}
                      </div>
                      {predictResult.probabilities?.[i] && (
                        <div className="mt-2 space-y-1">
                          {Object.entries(predictResult.probabilities[i] as Record<string, number>).slice(0, 5).map(([cls, prob]) => (
                            <div key={cls} className="flex items-center gap-1.5">
                              <span className="text-[9px] text-surface-400 w-14 truncate">{cls}</span>
                              <div className="flex-1 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(prob as number) * 100}%` }} />
                              </div>
                              <span className="text-[9px] text-surface-500 w-10 text-right">{((prob as number) * 100).toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </NodeCollapsible>
      )}
    </NodeShell>
  );
}
