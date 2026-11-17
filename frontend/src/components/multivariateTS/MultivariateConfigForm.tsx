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

export function MultivariateConfigForm(props: MultivariateConfigFormProps) {
  const {
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
  } = props;
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--ui-text)] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-400" />
          Séries Temporelles Multivariées
        </h3>
        <button onClick={onBack} className="ui-btn text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour
        </button>
      </div>

      <div className="ui-panel p-4">
        <div className="text-xs ui-t-secondary mb-3 flex flex-wrap gap-x-4 gap-y-1 ui-num">
          <span>Variables : <strong className="text-[var(--ui-text)]">{valueCols.join(', ')}</strong></span>
          <span>Date : <strong className="text-[var(--ui-text)]">{dateCol}</strong></span>
          <span>Horizon : <strong className="text-[var(--ui-text)]">{forecastSteps}</strong> pas</span>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 p-2.5 rounded border border-sky-500/30 bg-sky-500/10 text-xs">
          <button onClick={onApplyAcademicPreset} className="ui-btn ui-btn-primary text-xs">
            Preset académique (VAR niveaux, ct)
          </button>
          <button onClick={onSwitchToExploration} className="ui-btn text-xs">
            <Activity className="w-3.5 h-3.5 text-accent-400" />
            Mode exploration par modèle
          </button>
        </div>

        <div className="mb-3">
          <label className="text-xs ui-t-secondary block">
            Forçage de modèle
            <select
              value={forcedModel}
              onChange={e => setForcedModel(e.target.value as any)}
              className="ui-select mt-1 w-full"
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <label className="text-xs ui-t-secondary">
            Régime (VAR/VECM)
            <select
              value={varDataMode}
              onChange={e => setVarDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
              className="ui-select mt-1 w-full"
            >
              <option value="auto">Auto</option>
              <option value="levels">Niveaux</option>
              <option value="diff">Différences</option>
            </select>
          </label>

          <label className="text-xs ui-t-secondary">
            Trend VAR
            <select
              value={varTrend}
              onChange={e => setVarTrend(e.target.value as 'c' | 'ct' | 'ctt' | 'n')}
              className="ui-select mt-1 w-full"
            >
              <option value="c">c (constante)</option>
              <option value="ct">ct (constante + tendance)</option>
              <option value="ctt">ctt (constante + tendance + quadratique)</option>
              <option value="n">n (sans constante)</option>
            </select>
          </label>

          <label className="text-xs ui-t-secondary">
            Régime (Granger)
            <select
              value={grangerDataMode}
              onChange={e => setGrangerDataMode(e.target.value as 'auto' | 'levels' | 'diff')}
              className="ui-select mt-1 w-full"
            >
              <option value="auto">Auto</option>
              <option value="levels">Niveaux</option>
              <option value="diff">Différences</option>
            </select>
          </label>
        </div>

        {forcedModel === 'ardl' && valueCols.length > 0 && (
          <div className="mb-3">
            <label className="text-xs ui-t-secondary block">
              Variable dépendante (ARDL)
              <select
                value={targetCol}
                onChange={e => setTargetCol(e.target.value)}
                className="ui-select mt-1 w-full"
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
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="text-xs ui-t-secondary">
              λ₁ (tightness)
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.05}
                value={bvarLambda1}
                onChange={e => setBvarLambda1(Number(e.target.value) || 0.2)}
                className="ui-input mt-1 w-full ui-num"
              />
            </label>
            <label className="text-xs ui-t-secondary">
              λ₂ (cross-variable)
              <input
                type="number"
                min={0.01}
                max={1}
                step={0.05}
                value={bvarLambda2}
                onChange={e => setBvarLambda2(Number(e.target.value) || 0.5)}
                className="ui-input mt-1 w-full ui-num"
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
          <div className="mb-3 p-2.5 rounded border border-red-500/35 bg-red-500/10 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={onRun}
          disabled={isLoading}
          className="ui-btn ui-btn-primary w-full justify-center text-xs"
        >
          {isLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isLoading ? 'Analyse en cours…' : "Lancer l'analyse multivariée"}
        </button>
      </div>
    </div>
  );
}
