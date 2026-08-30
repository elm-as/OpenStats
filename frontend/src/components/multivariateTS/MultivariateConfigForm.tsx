import React, { useState } from 'react';
import { TrendingUp, ArrowLeft, Activity, Play, RefreshCw } from 'lucide-react';
import { AdvancedParametersForm } from './AdvancedParametersForm';

interface MultivariateConfigFormProps {
  onBack: () => void;
  valueCols: string[];
  dateCol: string;
  forecastSteps: number;
  onApplyAcademicPreset: () => void;
  onSwitchToExploration: () => void;
  forcedModel: string;
  setForcedModel: (val: any) => void;
  varDataMode: 'auto' | 'levels' | 'diff';
  setVarDataMode: (val: 'auto' | 'levels' | 'diff') => void;
  varTrend: 'c' | 'ct' | 'ctt' | 'n';
  setVarTrend: (val: 'c' | 'ct' | 'ctt' | 'n') => void;
  grangerDataMode: 'auto' | 'levels' | 'diff';
  setGrangerDataMode: (val: 'auto' | 'levels' | 'diff') => void;
  targetCol: string;
  setTargetCol: (val: string) => void;
  bvarLambda1: number;
  setBvarLambda1: (val: number) => void;
  bvarLambda2: number;
  setBvarLambda2: (val: number) => void;
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
  error: string | null;
  isLoading: boolean;
  onRun: () => void;
}

export function MultivariateConfigForm({
  onBack,
  valueCols,
  dateCol,
  forecastSteps,
  onApplyAcademicPreset,
  onSwitchToExploration,
  forcedModel,
  setForcedModel,
  varDataMode,
  setVarDataMode,
  varTrend,
  setVarTrend,
  grangerDataMode,
  setGrangerDataMode,
  targetCol,
  setTargetCol,
  bvarLambda1,
  setBvarLambda1,
  bvarLambda2,
  setBvarLambda2,
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
  error,
  isLoading,
  onRun,
}: MultivariateConfigFormProps) {
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary-600" />
          Séries Temporelles Multivariées
        </h3>
        <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 mb-2">
          Variables : <strong>{valueCols.join(', ')}</strong>
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Date : <strong>{dateCol}</strong> — Horizon : <strong>{forecastSteps}</strong> pas
        </p>

        <div className="mb-4 p-3 rounded-lg border border-indigo-200 bg-indigo-50">
          <p className="text-xs font-semibold text-indigo-800 mb-2">Preset académique</p>
          <p className="text-xs text-indigo-700 mb-3">
            Reproduit l'approche "Bodjong" : VAR forcé en niveaux avec constante + tendance (trend=ct),
            et Granger en niveaux.
          </p>
          <button onClick={onApplyAcademicPreset} className="btn-primary text-sm">
            Appliquer preset académique et lancer
          </button>
        </div>

        <div className="mb-4 p-3 rounded-lg border border-surface-700 bg-surface-800/50">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-surface-200">Mode exploration par modèle</p>
              <p className="text-xs text-surface-400 mb-2">
                Lancez chaque modèle individuellement avec ses propres paramètres et comparez les résultats.
              </p>
              <button onClick={onSwitchToExploration} className="btn-secondary text-sm">
                Passer en mode exploration
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm text-gray-600">
            Forçage de modèle
            <select
              value={forcedModel}
              onChange={e => setForcedModel(e.target.value as any)}
              className="mt-1 w-full"
            >
              <option value="auto">Auto (sélection par critères d'information)</option>
              <option value="var">VAR</option>
              <option value="vecm">VECM</option>
              <option value="ardl">ARDL</option>
              <option value="bvar">BVAR</option>
              <option value="pairwise_var">Pairwise VAR</option>
              <option value="varmax">VARMAX</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="text-sm text-gray-600">
            Régime des données (VAR/VECM)
            <select
              value={varDataMode}
              onChange={e => setVarDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
              className="mt-1 w-full"
            >
              <option value="auto">Auto</option>
              <option value="levels">Niveaux</option>
              <option value="diff">Différences</option>
            </select>
          </label>

          <label className="text-sm text-gray-600">
            Trend VAR
            <select
              value={varTrend}
              onChange={e => setVarTrend(e.target.value as 'c' | 'ct' | 'ctt' | 'n')}
              className="mt-1 w-full"
            >
              <option value="c">c (constante)</option>
              <option value="ct">ct (constante + tendance)</option>
              <option value="ctt">ctt (constante + tendance + quadratique)</option>
              <option value="n">n (sans constante)</option>
            </select>
          </label>

          <label className="text-sm text-gray-600">
            Régime des données (Granger)
            <select
              value={grangerDataMode}
              onChange={e => setGrangerDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
              className="mt-1 w-full"
            >
              <option value="auto">Auto</option>
              <option value="levels">Niveaux</option>
              <option value="diff">Différences</option>
            </select>
          </label>
        </div>

        {forcedModel === 'ardl' && valueCols.length > 0 && (
          <div className="mb-4">
            <label className="text-sm text-gray-600">
              Variable dépendante (ARDL)
              <select
                value={targetCol}
                onChange={e => setTargetCol(e.target.value)}
                className="mt-1 w-full"
              >
                <option value="">Première variable par défaut</option>
                {valueCols.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {forcedModel === 'bvar' && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="text-sm text-gray-600">
              λ₁ (tightness)
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.05}
                value={bvarLambda1}
                onChange={e => setBvarLambda1(Number(e.target.value) || 0.2)}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm text-gray-600">
              λ₂ (cross-variable)
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.05}
                value={bvarLambda2}
                onChange={e => setBvarLambda2(Number(e.target.value) || 0.5)}
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        <AdvancedParametersForm
          showAdvancedParams={showAdvancedParams}
          setShowAdvancedParams={setShowAdvancedParams}
          maxLag={maxLag}
          setMaxLag={setMaxLag}
          icCriterion={icCriterion}
          setIcCriterion={setIcCriterion}
          irfPeriods={irfPeriods}
          setIrfPeriods={setIrfPeriods}
          fevdPeriods={fevdPeriods}
          setFevdPeriods={setFevdPeriods}
          confidenceLevel={confidenceLevel}
          setConfidenceLevel={setConfidenceLevel}
          bootstrapIrf={bootstrapIrf}
          setBootstrapIrf={setBootstrapIrf}
          irfOrth={irfOrth}
          setIrfOrth={setIrfOrth}
          vecmDetOrder={vecmDetOrder}
          setVecmDetOrder={setVecmDetOrder}
          maxDiffOrder={maxDiffOrder}
          setMaxDiffOrder={setMaxDiffOrder}
        />

        {error && (
          <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={onRun}
          disabled={isLoading}
          className="btn-primary flex items-center gap-2 w-full justify-center"
        >
          {isLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          {isLoading ? 'Analyse en cours…' : "Lancer l'analyse multivariée"}
        </button>
      </div>
    </div>
  );
}
