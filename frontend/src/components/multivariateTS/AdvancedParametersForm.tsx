import React from 'react';

interface AdvancedParametersFormProps {
  showAdvancedParams: boolean;
  setShowAdvancedParams: (show: boolean) => void;
  maxLag: number;
  setMaxLag: (val: number) => void;
  icCriterion: 'aic' | 'bic' | 'hqic' | 'fpe';
  setIcCriterion: (val: any) => void;
  irfPeriods: number;
  setIrfPeriods: (val: number) => void;
  fevdPeriods: number;
  setFevdPeriods: (val: number) => void;
  confidenceLevel: number;
  setConfidenceLevel: (val: number) => void;
  bootstrapIrf: boolean;
  setBootstrapIrf: (val: boolean) => void;
  irfOrth: boolean;
  setIrfOrth: (val: boolean) => void;
  vecmDetOrder: number;
  setVecmDetOrder: (val: number) => void;
  maxDiffOrder: number;
  setMaxDiffOrder: (val: number) => void;
}

export function AdvancedParametersForm({
  showAdvancedParams,
  setShowAdvancedParams,
  maxLag,
  setMaxLag,
  icCriterion,
  setIcCriterion,
  irfPeriods,
  setIrfPeriods,
  fevdPeriods,
  setFevdPeriods,
  confidenceLevel,
  setConfidenceLevel,
  bootstrapIrf,
  setBootstrapIrf,
  irfOrth,
  setIrfOrth,
  vecmDetOrder,
  setVecmDetOrder,
  maxDiffOrder,
  setMaxDiffOrder,
}: AdvancedParametersFormProps) {
  return (
    <div className="mb-4">
      <button
        onClick={() => setShowAdvancedParams(!showAdvancedParams)}
        className="text-sm font-semibold text-primary-600 flex items-center gap-2 mb-2 hover:text-primary-700"
      >
        {showAdvancedParams
          ? '▼ Paramètres Avancés (Masquer)'
          : '► Paramètres Avancés (Afficher)'}
      </button>

      {showAdvancedParams && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-sm text-gray-600">
            Lag Max (VAR/VECM)
            <input
              type="number"
              min={1}
              max={60}
              value={maxLag}
              onChange={e => setMaxLag(Number(e.target.value) || 12)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm text-gray-600">
            Critère d'information
            <select
              value={icCriterion}
              onChange={e => setIcCriterion(e.target.value as any)}
              className="mt-1 w-full"
            >
              <option value="aic">AIC</option>
              <option value="bic">BIC</option>
              <option value="hqic">HQIC</option>
              <option value="fpe">FPE</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            Périodes IRF
            <input
              type="number"
              min={1}
              max={100}
              value={irfPeriods}
              onChange={e => setIrfPeriods(Number(e.target.value) || 20)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm text-gray-600">
            Périodes FEVD
            <input
              type="number"
              min={1}
              max={100}
              value={fevdPeriods}
              onChange={e => setFevdPeriods(Number(e.target.value) || 20)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm text-gray-600">
            Niveau de confiance
            <select
              value={confidenceLevel}
              onChange={e => setConfidenceLevel(Number(e.target.value))}
              className="mt-1 w-full"
            >
              <option value={0.9}>90%</option>
              <option value={0.95}>95%</option>
              <option value={0.99}>99%</option>
            </select>
          </label>
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={bootstrapIrf}
              onChange={e => setBootstrapIrf(e.target.checked)}
            />
            Bootstrap IRF
          </label>
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={irfOrth}
              onChange={e => setIrfOrth(e.target.checked)}
            />
            IRF orthogonalisées
          </label>
          <label className="text-sm text-gray-600">
            Ordre déterministe VECM
            <input
              type="number"
              min={0}
              max={2}
              value={vecmDetOrder}
              onChange={e => setVecmDetOrder(Number(e.target.value) || 0)}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-sm text-gray-600">
            Ordre max différenciation
            <input
              type="number"
              min={1}
              max={5}
              value={maxDiffOrder}
              onChange={e => setMaxDiffOrder(Number(e.target.value) || 2)}
              className="mt-1 w-full"
            />
          </label>
        </div>
      )}
    </div>
  );
}
