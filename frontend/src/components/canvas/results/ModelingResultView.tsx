import React from 'react';
import {
  Layers,
  BarChart2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Database,
  Grid3X3,
} from 'lucide-react';
import { Section, KpiCard, DataTable, Badge, pctBar, fmt } from './ResultAtoms';
import { SvgScatterPlot, SvgHeatmap } from './ResultCharts';

export const ExplainabilityResultView = ({ resultData }: { resultData: any }) => {
  const importance = resultData.global_importance || [];
  const waterfall = resultData.waterfall_example || [];
  return (
    <div className="space-y-5">
      <Section title="Explicabilité globale (SHAP Values)" icon={BarChart2} color="#8b5cf6">
        <div className="space-y-2">
          {importance.slice(0, 10).map((f: any, idx: number) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="text-xs font-semibold text-surface-200 w-36 truncate">{f.feature}</span>
              {pctBar((f.mean_shap / (importance[0]?.mean_shap || 1)) * 100, '#8b5cf6')}
              <span className="text-xs font-mono text-surface-300 w-20 text-right">{fmt(f.mean_shap)}</span>
            </div>
          ))}
        </div>
      </Section>

      {waterfall.length > 0 && (
        <Section title="Impact local (Exemple d'observation)" icon={Layers} color="#ec4899">
          <DataTable
            headers={['Feature', 'Valeur SHAP (Impact)']}
            rows={waterfall.slice(0, 8).map((w: any) => [
              w.feature,
              w.shap_value > 0 ? `+${w.shap_value}` : fmt(w.shap_value),
            ])}
          />
        </Section>
      )}
    </div>
  );
};

export const ManifoldResultView = ({ resultData }: { resultData: any }) => {
  const points = resultData.points || [];
  return (
    <div className="space-y-4">
      <Section title="Projection t-SNE 2D & DBSCAN" icon={Layers} color="#8b5cf6">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Observations" value={resultData.n_observations} color="#8b5cf6" />
          <KpiCard label="Clusters Densité" value={resultData.n_clusters} color="#06b6d4" />
          <KpiCard label="Points de Bruit" value={resultData.n_noise_points} color="#f59e0b" />
        </div>
      </Section>

      {points.length > 0 && (
        <SvgScatterPlot
          points={points.map((p: any) => ({
            x: p.x,
            y: p.y,
            label: p.cluster === -1 ? 'Bruit' : `C${p.cluster}`,
            color: p.cluster === -1 ? '#64748b' : `hsl(${(p.cluster * 137.5) % 360}, 70%, 55%)`,
          }))}
          title="Projection Manifold 2D (t-SNE)"
          xLabel="Axe t-SNE 1"
          yLabel="Axe t-SNE 2"
        />
      )}
    </div>
  );
};

export const ClusteringResultView = ({ resultData }: { resultData: any }) => {
  const points = resultData.points || [];
  const hasPoints = Array.isArray(points) && points.length > 0;

  return (
    <div className="space-y-5">
      <Section title={`Clustering ${resultData.method || ''}`} icon={Layers} color="#06b6d4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {resultData.k && <KpiCard label="Nombre de clusters" value={resultData.k} icon={Layers} color="#06b6d4" />}
          {resultData.n_clusters !== undefined && (
            <KpiCard label="Clusters détectés" value={resultData.n_clusters} icon={Layers} color="#06b6d4" />
          )}
          {resultData.silhouette !== undefined && (
            <KpiCard
              label="Score Silhouette"
              value={resultData.silhouette}
              icon={BarChart2}
              color={resultData.silhouette > 0.5 ? '#10b981' : resultData.silhouette > 0.25 ? '#f59e0b' : '#ef4444'}
            />
          )}
          {resultData.noise_points !== undefined && (
            <KpiCard label="Points de bruit" value={resultData.noise_points} icon={AlertCircle} color="#ef4444" />
          )}
        </div>
        {resultData.cluster_sizes && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(resultData.cluster_sizes).map(([k, v]) => {
              const hue = (parseInt(k, 10) * 137.5) % 360;
              return (
                <div
                  key={k}
                  className="flex items-center gap-3 bg-surface-800/40 px-3 py-2 rounded-lg border border-white/[0.04]"
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: `hsl(${hue}, 70%, 55%)` }} />
                  <span className="text-[11px] font-bold text-surface-200">Cluster {k}</span>
                  <span className="text-[11px] font-mono text-surface-400 ml-auto">{v as number}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {hasPoints && (
        <SvgScatterPlot
          points={points.map((p: any) => ({
            x: p.x,
            y: p.y,
            label: p.cluster === -1 ? 'Bruit' : `C${p.cluster}`,
            color: p.cluster === -1 ? '#64748b' : `hsl(${(p.cluster * 137.5) % 360}, 70%, 55%)`,
          }))}
          title="Projection des clusters (ACP 2D)"
          xLabel="Composante 1"
          yLabel="Composante 2"
        />
      )}
    </div>
  );
};

export const RegressionClassificationResultView = ({
  nodeType,
  resultData,
}: {
  nodeType: string;
  resultData: any;
}) => {
  const ranking = resultData.ranking || resultData.rankings || [];
  const bestKey = resultData.best_model_key || resultData.best_model_name;
  const bestName = ranking.length > 0 ? ranking[0].model_name : bestKey;
  const taskType = resultData.task_type || nodeType;
  const dataSplit = resultData.data_split;
  const diagnostics = resultData.diagnostics;
  const failed = resultData.failed || [];

  return (
    <div className="space-y-5">
      {bestName && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <div>
            <div className="text-xs text-emerald-300/70 font-bold uppercase tracking-wider">Meilleur modèle</div>
            <div className="text-sm font-bold text-emerald-200">{bestName}</div>
          </div>
          <Badge color="#10b981">{taskType}</Badge>
        </div>
      )}

      {ranking[0]?.metrics?.r2 !== undefined && ranking[0].metrics.r2 < 0 && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-rose-300">
              Avertissement de Généralisation (R² = {ranking[0].metrics.r2.toFixed(3)})
            </div>
            <p className="text-xs text-rose-200/80 mt-0.5 leading-relaxed">
              Le modèle obtient une erreur hors-échantillon supérieure à celle d'une simple moyenne constante.
              Ce phénomène survient généralement en cas de rupture structurelle temporelle (extrapolation impossible pour les arbres) ou de multicolinéarité sévère.
            </p>
          </div>
        </div>
      )}

      {diagnostics?.quality_flag === 'critical' && (!ranking[0]?.metrics?.r2 || ranking[0].metrics.r2 >= 0) && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
          {diagnostics.message || 'Qualité de prédiction faible.'}
        </div>
      )}

      {dataSplit && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Train" value={dataSplit.train_size ?? '\u2014'} icon={Database} color="#3b82f6" />
          <KpiCard label="Test" value={dataSplit.test_size ?? '\u2014'} icon={Database} color="#f59e0b" />
          <KpiCard label="Features" value={dataSplit.features?.length ?? '\u2014'} icon={Layers} color="#8b5cf6" />
          <KpiCard label="Stratégie" value={dataSplit.strategy ?? 'random'} color="#06b6d4" />
        </div>
      )}

      {ranking.length > 0 && (() => {
        const metrics = ranking[0].metrics || {};
        const metricKeys = Object.keys(metrics).filter(
          k => k !== 'confusion_matrix' && k !== 'classification_report'
        );
        const bestMetrics = ranking[0].metrics || {};
        const cm = bestMetrics.confusion_matrix;
        const labels = bestMetrics.classification_report
          ? Object.keys(bestMetrics.classification_report).filter(
              k => !['accuracy', 'macro avg', 'weighted avg'].includes(k)
            )
          : undefined;

        return (
          <>
            <Section title={`Classement (${ranking.length} modèles)`} icon={TrendingUp} color="#8b5cf6">
              <DataTable
                headers={['#', 'Modèle', ...metricKeys.map(k => k.toUpperCase())]}
                rows={ranking.map((r: any, i: number) => [
                  i + 1,
                  r.model_name || r.model_key,
                  ...metricKeys.map(k => r.metrics?.[k]),
                ])}
              />
            </Section>
            {cm && Array.isArray(cm) && (
              <Section title="Matrice de confusion (Meilleur Modèle)" icon={Grid3X3} color="#ec4899">
                <SvgHeatmap
                  matrix={cm}
                  labels={labels}
                  title="Matrice de confusion"
                  colorStart="#1e293b"
                  colorEnd="#ec4899"
                />
              </Section>
            )}
          </>
        );
      })()}

      {ranking.length > 0 && ranking[0].feature_importance && ranking[0].feature_importance.length > 0 && (
        <Section title="Importance des features" icon={BarChart2} color="#f59e0b">
          <div className="space-y-1.5">
            {ranking[0].feature_importance.slice(0, 10).map((f: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-surface-200 w-32 truncate">{f.feature}</span>
                {pctBar((f.importance / (ranking[0].feature_importance[0]?.importance || 1)) * 100, '#f59e0b')}
                <span className="text-xs font-mono text-surface-300 w-16 text-right">{fmt(f.importance)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {(() => {
        const regSummary = resultData.regression_summary || ranking[0]?.regression_summary;
        if (!regSummary?.coefficients || regSummary.coefficients.length === 0) return null;
        return (
          <Section title={`Équation & Coefficients OLS (${bestName})`} icon={TrendingUp} color="#3b82f6">
            {regSummary.equation && (
              <div className="p-3 bg-surface-900/90 rounded-lg border border-white/10 font-mono text-xs text-cyan-300 overflow-x-auto select-all">
                {regSummary.equation}
              </div>
            )}
            <DataTable
              headers={['Variable', 'Coeff (β)', 'Std Err', 't-stat', 'p-value', 'IC 95%']}
              rows={regSummary.coefficients.map((c: any) => [
                c.variable,
                fmt(c.coefficient),
                fmt(c.std_error),
                fmt(c.t_statistic),
                c.p_value < 0.001 ? '< 0.001' : fmt(c.p_value),
                `[${fmt(c.ci_lower)}, ${fmt(c.ci_upper)}]`,
              ])}
            />
          </Section>
        );
      })()}

      {failed.length > 0 && (
        <Section title={`${failed.length} modèle(s) échoué(s)`} icon={AlertCircle} color="#ef4444">
          <div className="space-y-1">
            {failed.map((f: any, i: number) => (
              <div key={i} className="text-xs text-red-300/80 bg-red-500/5 p-2 rounded-lg">
                <strong>{f.model_name || f.model_key}</strong>: {f.error}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};
