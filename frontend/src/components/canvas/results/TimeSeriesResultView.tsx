import React from 'react';
import {
  Shuffle,
  LineChart,
  AlertCircle,
  Activity,
  BarChart2,
  TrendingUp,
  Layers,
  Hash,
} from 'lucide-react';
import { Section, KpiCard, DataTable, Badge, RenderJson } from './ResultAtoms';

export const TimeSeriesResultView = ({
  nodeType,
  resultData,
}: {
  nodeType: string;
  resultData: any;
}) => {
  if (nodeType === 'granger') {
    const details = resultData?.details || [];
    const matrix = resultData?.matrix || {};
    const cols = resultData?.columns || [];

    return (
      <div className="space-y-4">
        <Section title={`Causalité de Granger (Lag max=${resultData.max_lag || 4})`} icon={Shuffle} color="#f59e0b">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-surface-400">
                  <th className="p-2 text-left">Cause \ Effet</th>
                  {cols.map((c: string) => (
                    <th key={c} className="p-2 text-center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cols.map((cause: string) => (
                  <tr key={cause} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-2 font-semibold text-surface-200">{cause}</td>
                    {cols.map((effect: string) => {
                      if (cause === effect) {
                        return <td key={effect} className="p-2 text-center text-surface-600">—</td>;
                      }
                      const p = matrix[cause]?.[effect];
                      const isSig = typeof p === 'number' && p < 0.05;
                      return (
                        <td key={effect} className="p-2 text-center">
                          {p !== null && p !== undefined ? (
                            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                              isSig
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'text-surface-400'
                            }`}>
                              p={Number(p).toFixed(3)} {isSig ? '★' : ''}
                            </span>
                          ) : (
                            <span className="text-surface-600">n/a</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        {details.length > 0 && (
          <Section title="Relations de Causalité Identifiées" icon={Shuffle} color="#f59e0b">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {details.filter((d: any) => d.significant).map((d: any, idx: number) => (
                <div key={idx} className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200 flex items-center justify-between">
                  <span className="font-semibold">{d.cause} → {d.effect}</span>
                  <span className="text-[11px] opacity-80">p = {d.p_value}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  if (nodeType === 'cointegration') {
    return (
      <div className="space-y-4">
        <Section title="Test de Johansen (Cointégration)" icon={Shuffle} color="#f59e0b">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Statistique Trace (r=0)" value={resultData.r0_stat} color="#f59e0b" />
            <KpiCard label="Valeur Critique 5%" value={resultData.r0_crit_5pct} color="#6b7280" />
          </div>
        </Section>
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            resultData.is_cointegrated
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}
        >
          {resultData.is_cointegrated
            ? " Cointégration confirmée : relation d'équilibre à long terme identifiée."
            : ' Aucune relation de cointégration détectée au seuil 5%.'}
        </div>
      </div>
    );
  }

  if (nodeType === 'tsDecomposition') {
    const hasVector = resultData?.observed && resultData?.trend && resultData?.seasonal && resultData?.residuals;

    return (
      <div className="space-y-4">
        <Section title={`Décomposition STL (${resultData.column})`} icon={LineChart} color="#f59e0b">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Moyenne Tendance" value={resultData.trend_mean} color="#3b82f6" />
            <KpiCard label="Écart-type Saison" value={resultData.seasonal_std} color="#10b981" />
            <KpiCard label="Écart-type Bruit" value={resultData.resid_std} color="#f59e0b" />
          </div>
        </Section>
        {hasVector && (
          <Section title="Composantes Isolées (Tendance, Saisonnalité, Résidus)" icon={LineChart} color="#f59e0b">
            <div className="space-y-2">
              <div className="text-xs text-surface-400">
                Période saisonnière : <span className="font-semibold text-surface-200">{resultData.period}</span> observations
              </div>
              <div className="grid grid-cols-4 gap-2 text-[11px] py-1 border-b border-white/10 font-medium text-surface-400">
                <span>Date</span>
                <span className="text-right text-cyan-400">Observé</span>
                <span className="text-right text-amber-300">Tendance</span>
                <span className="text-right text-purple-300">Saison</span>
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                {resultData.dates.slice(0, 30).map((d: string, i: number) => (
                  <div key={i} className="grid grid-cols-4 gap-2 py-0.5 border-b border-white/5 text-surface-300">
                    <span className="truncate">{d}</span>
                    <span className="text-right text-cyan-400">{resultData.observed[i]?.toFixed(2) ?? '—'}</span>
                    <span className="text-right text-amber-300">{resultData.trend[i]?.toFixed(2) ?? '—'}</span>
                    <span className="text-right text-purple-300">{resultData.seasonal[i]?.toFixed(2) ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}
      </div>
    );
  }

  if (nodeType === 'chowTest') {
    return (
      <div className="space-y-4">
        <Section title={`Test de Rupture Structurelle de Chow (${resultData.target_col})`} icon={Shuffle} color="#f59e0b">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Statistique F" value={resultData.f_statistic} color="#f59e0b" />
            <KpiCard label="p-value" value={resultData.p_value} color={resultData.is_significant ? '#10b981' : '#6b7280'} />
            <KpiCard label="Point de Rupture" value={resultData.break_label} color="#06b6d4" />
            <KpiCard label="Échantillon N" value={resultData.sample_size} color="#8b5cf6" />
          </div>
        </Section>
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            resultData.is_significant
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-surface-800/40 border-white/10 text-surface-300'
          }`}
        >
          {resultData.interpretation}
        </div>
      </div>
    );
  }

  if (nodeType === 'outliers') {
    return (
      <div className="space-y-4">
        <Section title="Détection d'anomalies (Isolation Forest)" icon={AlertCircle} color="#f97316">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Obs. Atypiques" value={resultData.n_outliers} color="#f97316" />
            <KpiCard
              label="Pourcentage"
              value={`${resultData.outlier_percentage?.toFixed(1)}%`}
              color="#ef4444"
            />
            <KpiCard label="Variables Analysées" value={resultData.n_features} color="#8b5cf6" />
          </div>
        </Section>
      </div>
    );
  }

  if (nodeType === 'survival') {
    const km = resultData.km_table || resultData.kaplan_meier || [];
    const cox = resultData.cox_regression;
    const logRank = resultData.log_rank_test;

    return (
      <div className="space-y-5">
        <Section title={`Analyse de Survie (${resultData.duration_column})`} icon={Activity} color="#ec4899">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Observations" value={resultData.n_observations} color="#ec4899" />
            <KpiCard label="Événements" value={resultData.n_events} color="#ef4444" />
            <KpiCard
              label="Survie Médiane"
              value={resultData.median_survival_time ?? 'Non atteinte'}
              color="#10b981"
            />
          </div>
        </Section>

        {logRank && (
          <Section title="Test du Log-Rank (Mantel-Cox)" icon={Activity} color="#06b6d4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard label="Comparaison" value={`${logRank.group1} vs ${logRank.group2}`} color="#06b6d4" />
              <KpiCard label="Statistique χ²" value={logRank.chi2_statistic} color="#8b5cf6" />
              <KpiCard label="p-value" value={logRank.p_value} color={logRank.significant ? '#10b981' : '#f59e0b'} />
              <KpiCard label="Différence" value={logRank.significant ? 'Significative' : 'Non significative'} color={logRank.significant ? '#10b981' : '#f59e0b'} />
            </div>
          </Section>
        )}

        {km.length > 0 && (
          <Section title="Table de Survie Kaplan-Meier & IC Greenwood (95%)" icon={BarChart2} color="#ec4899">
            <DataTable
              headers={['Temps', 'À Risque', 'Événements', 'Censurés', 'Probabilité Survie', 'IC 95%']}
              rows={km.slice(0, 40).map((r: any) => [
                r.time,
                r.n_at_risk,
                r.n_events,
                r.n_censored,
                `${(r.survival_probability * 100).toFixed(1)}%`,
                r.ci_lower !== undefined ? `[${(r.ci_lower * 100).toFixed(1)}% - ${(r.ci_upper * 100).toFixed(1)}%]` : '—',
              ])}
            />
          </Section>
        )}

        {cox && (
          <Section title="Régression de Cox (Hazard Ratios)" icon={TrendingUp} color="#8b5cf6">
            <DataTable
              headers={['Variable', 'Hazard Ratio (HR)', 'p-value']}
              rows={Object.keys(cox.hazard_ratios || {}).map((col: string) => [
                col,
                cox.hazard_ratios[col],
                cox.p_values[col],
              ])}
            />
          </Section>
        )}
      </div>
    );
  }


  if (nodeType === 'garch') {
    const params = resultData.garch_parameters || {};
    return (
      <div className="space-y-4">
        <Section title={`Volatilité GARCH(1,1) — ${resultData.variable}`} icon={TrendingUp} color="#f59e0b">
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Volatilité Inconditionnelle" value={resultData.unconditional_volatility} color="#f59e0b" />
            <KpiCard label="Volatilité Moyenne" value={resultData.mean_conditional_volatility} color="#10b981" />
            <KpiCard label="Persistance (α+β)" value={params['persistence']} color="#8b5cf6" />
          </div>
        </Section>
      </div>
    );
  }

  if (nodeType === 'timeseries') {
    const bestModel =
      resultData.best_model_name || resultData.model_selected || resultData.model || 'Série Temporelle';
    const metrics = resultData.metrics || {};
    const forecast = resultData.forecast || resultData.predictions || [];
    const isArrayForecast = Array.isArray(forecast);

    return (
      <div className="space-y-5">
        <Section title={`Analyse de Série Temporelle (${bestModel})`} icon={TrendingUp} color="#f59e0b">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Modèle" value={bestModel} icon={TrendingUp} color="#f59e0b" />
            {metrics.aic !== undefined && <KpiCard label="AIC" value={metrics.aic} color="#3b82f6" />}
            {metrics.rmse !== undefined && <KpiCard label="RMSE" value={metrics.rmse} color="#10b981" />}
            {metrics.mae !== undefined && <KpiCard label="MAE" value={metrics.mae} color="#8b5cf6" />}
          </div>
        </Section>

        {isArrayForecast && forecast.length > 0 && (
          <Section title={`Prévisions (${forecast.length} pas)`} icon={BarChart2} color="#f59e0b">
            <DataTable
              headers={['Pas', 'Prévision', 'IC Inf (95%)', 'IC Sup (95%)']}
              rows={forecast.map((row: any, i: number) => [
                row.step ?? i + 1,
                row.forecast ?? row.yhat ?? row.value ?? row,
                row.lower_95 ?? row.yhat_lower ?? '\u2014',
                row.upper_95 ?? row.yhat_upper ?? '\u2014',
              ])}
            />
          </Section>
        )}

        {resultData.stationary_test && (
          <div className="p-3 bg-surface-800/40 rounded-xl border border-white/[0.04] text-xs text-surface-200">
            <strong>Test de stationnarité :</strong>{' '}
            {resultData.stationary_test.interpretation ||
              (resultData.stationary_test.is_stationary ? 'Série stationnaire' : 'Série non-stationnaire')}
          </div>
        )}
      </div>
    );
  }

  if (nodeType === 'multivariateTimeseries') {
    const model = resultData.model_selected || resultData.model || 'VAR/VECM';
    const vars = resultData.variables || [];
    const lags = resultData.selected_lag || resultData.max_lag;
    const granger = resultData.granger_causality;

    return (
      <div className="space-y-5">
        <Section title={`Séries Temporelles Multivariées (${model})`} icon={Activity} color="#f59e0b">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Modèle" value={model} icon={Activity} color="#f59e0b" />
            <KpiCard label="Variables" value={vars.length} icon={Layers} color="#3b82f6" />
            {lags !== undefined && <KpiCard label="Lags retenus" value={lags} icon={Hash} color="#8b5cf6" />}
            {resultData.johansen_test?.coint_rank !== undefined && (
              <KpiCard
                label="Rang de cointégration"
                value={resultData.johansen_test.coint_rank}
                color="#10b981"
              />
            )}
          </div>
        </Section>

        {granger && typeof granger === 'object' && (
          <Section title="Causalité de Granger" icon={TrendingUp} color="#8b5cf6">
            <div className="space-y-2">
              {Object.entries(granger).map(([cause, targets]: [string, any]) =>
                Object.entries(targets || {}).map(([target, info]: [string, any]) => {
                  const pVal = typeof info === 'object' ? info.p_value : info;
                  const isCausal =
                    typeof info === 'object' ? info.is_causal : typeof pVal === 'number' && pVal < 0.05;
                  return (
                    <div
                      key={`${cause}-${target}`}
                      className="flex items-center gap-3 bg-surface-800/30 p-2.5 rounded-lg border border-white/[0.03]"
                    >
                      <span className="text-xs font-semibold text-surface-200">
                        {cause} → {target}
                      </span>
                      <Badge color={isCausal ? '#10b981' : '#6b7280'}>
                        {isCausal ? 'Causal (p < 0.05)' : 'Non-causal'}
                      </Badge>
                      <span
                        className="text-xs font-mono ml-auto"
                        style={{ color: isCausal ? '#10b981' : '#94a3b8' }}
                      >
                        p = {typeof pVal === 'number' ? (pVal < 0.001 ? '< 0.001' : pVal.toFixed(4)) : pVal}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return null;
};
