import React from 'react';
import { GitCompare } from 'lucide-react';
import type { TestResult } from '../../types';
import type { StationarityResult } from '../../store/api';

export function HypothesisTestResults({
  result,
  config,
}: {
  result: TestResult;
  config: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <div
        className={`card border-l-4 ${
          result.significant ? 'border-l-green-500' : 'border-l-gray-400'
        }`}
      >
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">{result.test}</h3>
          <span
            className={`badge ${
              result.significant ? 'bg-green-100 text-green-800' : 'bg-surface-800 text-surface-400'
            }`}
          >
            {result.significant ? 'Significatif' : 'Non significatif'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Statistique</p>
            <p className="text-lg font-bold font-mono">{result.statistic.toFixed(4)}</p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">p-value</p>
            <p
              className={`text-lg font-bold font-mono ${
                result.p_value < 0.05 ? 'text-green-600' : 'text-surface-400'
              }`}
            >
              {result.p_value < 0.001 ? '< 0.001' : result.p_value.toFixed(4)}
            </p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Seuil α</p>
            <p className="text-lg font-bold font-mono">0.05</p>
          </div>
          <div className="text-center p-3 bg-surface-900 rounded-lg">
            <p className="text-xs text-surface-400 mb-1">Décision</p>
            <p
              className={`text-sm font-bold ${
                result.significant ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {result.significant ? 'H₀ rejetée' : 'H₀ non rejetée'}
            </p>
          </div>
        </div>

        {result.effect_size && Object.keys(result.effect_size).length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Taille d'effet</h4>
            <div className="flex flex-wrap gap-3">
              {Object.entries(result.effect_size).map(([key, val]) => (
                <div key={key} className="text-sm bg-purple-50 px-3 py-1.5 rounded-lg">
                  <span className="text-purple-600 font-medium">{key}:</span>{' '}
                  <span className="font-mono">
                    {typeof val === 'number' ? val.toFixed(4) : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.interpretation && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <strong>Interprétation :</strong> {result.interpretation}
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
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: 'OK',
      title: 'Toutes les séries sont stationnaires I(0)',
      rec: 'VAR en niveaux recommandé. ARIMA avec d=0.',
    },
    all_nonstationary: {
      bg: cointegrationLikely ? 'bg-indigo-50' : 'bg-amber-50',
      border: cointegrationLikely ? 'border-indigo-200' : 'border-amber-200',
      icon: cointegrationLikely ? 'COI' : 'WARN',
      title: cointegrationLikely
        ? `${entries.length} séries I(1) — cointégration probable`
        : 'Séries non-stationnaires I(1)',
      rec: cointegrationLikely
        ? 'VECM recommandé (test Johansen inclus). VAR en différences si cointégration rejetée.'
        : 'ARIMA avec d=1. VAR sur premières différences.',
    },
    mixed: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: '≈',
      title: 'Stationnarité mixte — I(0) et I(1) mélangés',
      rec: 'ARDL recommandé (robuste aux ordres mixtes).',
    },
  };

  const meta = META[summary] ?? META.all_nonstationary;
  const focusCol = configCol && orders[configCol];

  return (
    <div className={`mt-4 rounded-lg border p-3 ${meta.bg} ${meta.border}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{meta.title}</p>
          <p className="text-xs text-surface-400 mt-0.5">{meta.rec}</p>

          {entries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entries.slice(0, 6).map(([col, info]) => (
                <span
                  key={col}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    info.order === 0
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : info.order === 1
                      ? 'bg-amber-100 border-amber-300 text-amber-700'
                      : 'bg-red-100 border-red-300 text-red-700'
                  } ${col === configCol ? 'ring-1 ring-offset-1 ring-gray-400' : ''}`}
                >
                  {col} I({info.order})
                  {info.adf_p !== null && (
                    <span className="opacity-60 ml-1">p={info.adf_p?.toFixed(3)}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {focusCol && focusCol.order > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              <strong>{configCol}</strong> est non-stationnaire I({focusCol.order}) —{' '}
              {focusCol.order === 1
                ? 'ARIMA(d=1) sera utilisé automatiquement.'
                : `${focusCol.order} différenciations nécessaires.`}
            </p>
          )}
          {focusCol && focusCol.order === 0 && (
            <p className="text-xs text-emerald-700 mt-1.5">
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
  const verdictColor = result.is_stationary
    ? 'border-l-green-500 bg-green-50'
    : 'border-l-orange-500 bg-orange-50';
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
        <div className="card p-4 border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{name}</p>
          <p className="text-xs text-red-500 mt-1">{data?.error ?? 'Erreur inconnue'}</p>
        </div>
      );
    }
    const isSignificant = data.is_stationary;
    return (
      <div className={`card border-l-4 ${isSignificant ? 'border-l-green-500' : 'border-l-amber-400'}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">{name}</h4>
          <span
            className={`badge ${
              isSignificant ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {data.interpretation}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Statistique</p>
            <p className="font-mono font-bold">{fmtVal(data.statistic)}</p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">p-value</p>
            <p className={`font-mono font-bold ${isSignificant ? 'text-green-600' : 'text-amber-600'}`}>
              {data.p_value < 0.001 ? '< 0.001' : fmtVal(data.p_value)}
            </p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Lags utilisés</p>
            <p className="font-mono font-bold">{data.lags_used ?? '—'}</p>
          </div>
          <div className="text-center p-2 bg-surface-900 rounded">
            <p className="text-xs text-surface-400">Observations</p>
            <p className="font-mono font-bold">{data.n_obs ?? result.n_obs}</p>
          </div>
        </div>
        {data.critical_values && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-surface-400">Valeurs critiques :</span>
            {Object.entries(data.critical_values).map(([k, v]: any) => (
              <span key={k} className="text-xs font-mono bg-surface-800 px-2 py-0.5 rounded">
                {k}: {typeof v === 'number' ? v.toFixed(3) : v}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-surface-400 space-y-0.5">
          <p>
            <span className="font-medium">H₀ :</span> {h0}
          </p>
          <p>
            <span className="font-medium">H₁ :</span> {h1}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className={`card border-l-4 ${verdictColor}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{verdictIcon}</span>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {result.column} — {verdictText}
            </h3>
            <p className="text-sm text-surface-400 mt-0.5">{result.conclusion}</p>
          </div>
        </div>
        <p className="text-xs text-surface-500 mt-2">{result.n_obs} observations analysées</p>
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
        <div className="card bg-blue-50 border border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-1">Recommandation</p>
          <p className="text-sm text-blue-700">
            La série est non-stationnaire. Envisagez une différenciation (1ère ou 2ème ordre), une
            transformation logarithmique, ou utilisez des modèles adaptés (ARIMA avec d &gt; 0, VECM).
          </p>
        </div>
      )}
    </div>
  );
}
