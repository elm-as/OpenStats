import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { GitCompare, Bookmark, Check } from 'lucide-react';
import type { TestResult } from '../../types';
import type { StationarityResult } from '../../store/api';
import { addPinnedItem } from '../../store/slices/pinnedNotesSlice';

export function HypothesisTestResults({
  result,
  config,
}: {
  result: TestResult;
  config: Record<string, string>;
}) {
  const dispatch = useDispatch();
  const [pinned, setPinned] = useState(false);

  const handlePin = () => {
    dispatch(
      addPinnedItem({
        title: `${result.test} (${config.value_col || config.col1 || 'Variables'})`,
        category: 'test',
        badge: `p = ${result.p_value < 0.001 ? '< 0.001' : result.p_value.toFixed(4)} (${result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'})`,
        details: `Statistique: ${result.statistic.toFixed(4)} | Interprétation: ${result.interpretation || 'N/A'}`,
      })
    );
    setPinned(true);
    setTimeout(() => setPinned(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div
        className={`ui-panel p-4 border-l-4 ${
          result.significant ? 'border-l-emerald-500' : 'border-l-surface-500'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-accent-400" />
            <h3 className="font-semibold text-surface-100">{result.test}</h3>
            <span
              className={`ui-tag ${
                result.significant
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'ui-tag-neutral'
              }`}
            >
              {result.significant ? 'Significatif' : 'Non significatif'}
            </span>
          </div>

          <button
            onClick={handlePin}
            className="ui-btn text-xs"
            title="Épingler ce résultat au carnet de bord"
          >
            {pinned ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
            {pinned ? 'Épinglé' : 'Épingler'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 ui-num">
          <div className="text-center p-3 bg-surface-800/60 border border-white/10 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Statistique</p>
            <p className="text-lg font-bold font-mono text-surface-100">{result.statistic.toFixed(4)}</p>
          </div>
          <div className="text-center p-3 bg-surface-800/60 border border-white/10 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">p-value</p>
            <p
              className={`text-lg font-bold font-mono ${
                result.p_value < 0.05 ? 'text-emerald-400' : 'text-surface-300'
              }`}
            >
              {result.p_value < 0.001 ? '< 0.001' : result.p_value.toFixed(4)}
            </p>
          </div>
          <div className="text-center p-3 bg-surface-800/60 border border-white/10 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Seuil α</p>
            <p className="text-lg font-bold font-mono text-surface-100">0.05</p>
          </div>
          <div className="text-center p-3 bg-surface-800/60 border border-white/10 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Décision</p>
            <p
              className={`text-sm font-bold ${
                result.significant ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'}
            </p>
          </div>
        </div>

        {result.effect_size && Object.keys(result.effect_size).length > 0 && (
          <div className="border-t border-white/10 pt-3">
            <h4 className="text-sm font-medium text-surface-200 mb-2">Taille d'effet</h4>
            <div className="flex flex-wrap gap-2.5 ui-num">
              {Object.entries(result.effect_size).map(([key, val]) => (
                <div key={key} className="text-sm bg-accent-500/10 border border-accent-500/25 px-3 py-1.5 rounded-lg">
                  <span className="text-accent-400 font-medium">{key} :</span>{' '}
                  <span className="font-mono text-surface-100">
                    {typeof val === 'number' ? val.toFixed(4) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.interpretation && (
          <div className="mt-3 p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sm text-surface-200">
            <strong className="text-sky-400">Interprétation :</strong> {result.interpretation}
          </div>
        )}
      </div>
    </div>
  );
}

export function StationarityBadge({
  summary,
  orders,
  cointegrationLikely,
  configCol,
}: {
  summary: string;
  orders: Record<
    string,
    { order: number; is_stationary: boolean; adf_p: number | null; kpss_p: number | null }
  >;
  cointegrationLikely: boolean;
  configCol?: string;
}) {
  const entries = Object.entries(orders);

  const META: Record<string, { bg: string; border: string; icon: string; title: string; rec: string }> = {
    all_stationary: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: 'OK',
      title: 'Toutes les séries sont stationnaires I(0)',
      rec: 'VAR en niveaux recommandé. ARIMA avec d=0.',
    },
    all_nonstationary: {
      bg: cointegrationLikely ? 'bg-sky-500/10' : 'bg-amber-500/10',
      border: cointegrationLikely ? 'border-sky-500/30' : 'border-amber-500/30',
      icon: cointegrationLikely ? 'COI' : 'WARN',
      title: cointegrationLikely
        ? `${entries.length} séries I(1) — cointégration probable`
        : 'Séries non-stationnaires I(1)',
      rec: cointegrationLikely
        ? 'VECM recommandé (test Johansen inclus). VAR en différences si cointégration rejetée.'
        : 'ARIMA avec d=1. VAR sur premières différences.',
    },
    mixed: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      icon: '≈',
      title: 'Stationnarité mixte — I(0) et I(1) mélangés',
      rec: 'ARDL recommandé (robuste aux ordres mixtes).',
    },
  };

  const meta = META[summary] ?? META.all_nonstationary;
  const focusCol = configCol && orders[configCol];

  return (
    <div className={`mt-4 rounded-lg border p-3 ${meta.bg} ${meta.border}`}>
      <div className="flex items-start gap-2.5">
        <span className="ui-tag ui-tag-neutral text-[10px] font-mono mt-0.5">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-100">{meta.title}</p>
          <p className="text-xs text-surface-400 mt-0.5">{meta.rec}</p>

          {entries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 ui-num">
              {entries.slice(0, 6).map(([col, info]) => (
                <span
                  key={col}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    info.order === 0
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : info.order === 1
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                      : 'bg-red-500/15 border-red-500/30 text-red-400'
                  } ${col === configCol ? 'ring-1 ring-accent-500' : ''}`}
                >
                  {col} I({info.order})
                  {info.adf_p !== null && (
                    <span className="opacity-75 ml-1">p={info.adf_p?.toFixed(3)}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {focusCol && focusCol.order > 0 && (
            <p className="text-xs text-amber-400 mt-1.5">
              <strong>{configCol}</strong> est non-stationnaire I({focusCol.order}) —{' '}
              {focusCol.order === 1
                ? 'ARIMA(d=1) sera utilisé automatiquement.'
                : `${focusCol.order} différenciations nécessaires.`}
            </p>
          )}
          {focusCol && focusCol.order === 0 && (
            <p className="text-xs text-emerald-400 mt-1.5">
              <strong>{configCol}</strong> est stationnaire — ARIMA(d=0)/SARIMA applicable directement.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function StationarityResults({ result }: { result: StationarityResult }) {
  const fmtVal = (v: number | undefined) => (v !== undefined ? v.toFixed(4) : '—');
  const verdictColor = result.is_stationary ? 'border-l-emerald-500' : 'border-l-amber-500';
  const verdictText = result.is_stationary ? 'Série stationnaire' : 'Série non-stationnaire';
  const verdictIcon = result.is_stationary ? 'OK' : 'WARN';

  const TestCard = ({
    name,
    data,
    h0,
    h1,
  }: {
    name: string;
    data: any;
    h0: string;
    h1: string;
  }) => {
    if (!data || data.error) {
      return (
        <div className="ui-panel p-4 border-l-4 border-l-red-500 bg-red-500/10">
          <p className="text-sm font-semibold text-red-400">{name}</p>
          <p className="text-xs text-red-300 mt-1">{data?.error ?? 'Erreur inconnue'}</p>
        </div>
      );
    }
    const isSignificant = data.is_stationary;
    return (
      <div className={`ui-panel p-4 border-l-4 ${isSignificant ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-surface-100">{name}</h4>
            {data.specification && (
              <span className="text-[11px] text-accent-400 font-medium block">
                Spécification : {data.specification}
              </span>
            )}
          </div>
          <span
            className={`ui-tag ${
              isSignificant
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {data.interpretation}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 ui-num">
          <div className="text-center p-2 bg-surface-800/60 border border-white/10 rounded">
            <p className="text-xs text-surface-400">Statistique</p>
            <p className="font-mono font-bold text-surface-100">{fmtVal(data.statistic)}</p>
          </div>
          <div className="text-center p-2 bg-surface-800/60 border border-white/10 rounded">
            <p className="text-xs text-surface-400">p-value</p>
            <p className={`font-mono font-bold ${isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
              {data.p_value < 0.001 ? '< 0.001' : fmtVal(data.p_value)}
            </p>
          </div>
          <div className="text-center p-2 bg-surface-800/60 border border-white/10 rounded">
            <p className="text-xs text-surface-400">Lags utilisés</p>
            <p className="font-mono font-bold text-surface-100">{data.lags_used ?? '—'}</p>
          </div>
          <div className="text-center p-2 bg-surface-800/60 border border-white/10 rounded">
            <p className="text-xs text-surface-400">Observations</p>
            <p className="font-mono font-bold text-surface-100">{data.n_obs ?? result.n_obs}</p>
          </div>
        </div>
        {data.critical_values && (
          <div className="flex flex-wrap gap-2 ui-num">
            <span className="text-xs text-surface-400">Valeurs critiques :</span>
            {Object.entries(data.critical_values).map(([k, v]: any) => (
              <span key={k} className="text-xs font-mono bg-surface-800 border border-white/10 px-2 py-0.5 rounded text-surface-200">
                {k}: {typeof v === 'number' ? v.toFixed(3) : v}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-surface-400 space-y-0.5">
          <p><span className="font-medium text-surface-300">H₀ :</span> {h0}</p>
          <p><span className="font-medium text-surface-300">H₁ :</span> {h1}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`ui-panel p-4 border-l-4 ${verdictColor}`}>
        <div className="flex items-center gap-3">
          <span className="ui-tag ui-tag-accent font-mono">{verdictIcon}</span>
          <div>
            <h3 className="font-bold text-surface-100 text-lg">
              {result.column} — {verdictText}
            </h3>
            <p className="text-sm text-surface-300 mt-0.5">{result.conclusion}</p>
          </div>
        </div>
        <p className="text-xs text-surface-400 mt-2 ui-num">{result.n_obs} observations analysées</p>
      </div>

      <TestCard
        name="Test ADF (Augmented Dickey-Fuller)"
        data={result.adf}
        h0="La série a une racine unitaire (non-stationnaire)"
        h1="La série est stationnaire (rejet de H₀ si p < 0.05)"
      />

      <TestCard
        name="Test KPSS (Kwiatkowski-Phillips-Schmidt-Shin)"
        data={result.kpss}
        h0="La série est stationnaire"
        h1="La série a une racine unitaire (rejet de H₀ si p < 0.05)"
      />

      {!result.is_stationary && (
        <div className="ui-panel p-4 bg-sky-500/10 border-sky-500/30">
          <p className="text-sm font-medium text-sky-400 mb-1">Recommandation</p>
          <p className="text-sm text-surface-200">
            La série est non-stationnaire. Envisagez une différenciation (1ère ou 2ème ordre), une
            transformation logarithmique, ou utilisez des modèles adaptés (ARIMA avec d &gt; 0, VECM).
          </p>
        </div>
      )}
    </div>
  );
}
