import React from 'react';
import { Activity, BarChart2, TrendingUp } from 'lucide-react';
import { Section, KpiCard, DataTable } from './ResultAtoms';

export const SurvivalResultView = ({ resultData }: { resultData: any }) => {
  const km = resultData.km_table || resultData.kaplan_meier || [];
  const cox = resultData.cox_regression;
  const logRank = resultData.log_rank_test;

  return (
    <div className="space-y-5">
      <Section title={`Analyse de Survie (${resultData.duration_column || ''})`} icon={Activity} color="#ec4899">
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
};
