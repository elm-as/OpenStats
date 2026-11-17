import React, { useMemo } from 'react';
import { Activity, BarChart2, TrendingUp } from 'lucide-react';
import { Section, SummaryStrip, DataTable } from './ResultAtoms';
import { PlotlyChart, SCI_COLORS, useCurrentTheme } from '../../viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';

export const SurvivalResultView = ({ resultData }: { resultData: any }) => {
  const km = resultData.km_table || resultData.kaplan_meier || [];
  const groupCurves: Record<string, any[]> = resultData.group_curves || {};
  const cox = resultData.cox_regression;
  const logRank = resultData.log_rank_test;
  const theme = useCurrentTheme();
  const isLight = theme === 'light';

  const kmPlot = useMemo(() => {
    const traces: Data[] = [];
    const groupNames = Object.keys(groupCurves);

    if (groupNames.length > 0) {
      groupNames.forEach((grp, idx) => {
        const rows = groupCurves[grp] || [];
        if (rows.length === 0) return;
        traces.push({
          x: rows.map((r: any) => r.time),
          y: rows.map((r: any) => Number(r.survival_probability) * 100),
          type: 'scatter',
          mode: 'lines',
          line: { shape: 'hv', width: 2.5, color: SCI_COLORS[idx % SCI_COLORS.length] },
          name: `${grp}`,
          hovertemplate: `<b>${grp}</b><br>t=%{x}<br>S(t)=%{y:.1f}%<extra></extra>`,
        } as Data);
      });
    } else if (km.length > 0) {
      const times = km.map((r: any) => r.time);
      const surv = km.map((r: any) => Number(r.survival_probability) * 100);
      const hasCi = km.some((r: any) => r.ci_lower !== undefined && r.ci_upper !== undefined);

      if (hasCi) {
        const upper = km.map((r: any) => Number(r.ci_upper ?? r.survival_probability) * 100);
        const lower = km.map((r: any) => Number(r.ci_lower ?? r.survival_probability) * 100);
        traces.push({
          x: [...times, ...[...times].reverse()],
          y: [...upper, ...lower.slice().reverse()],
          fill: 'toself',
          fillcolor: isLight ? 'rgba(2, 132, 199, 0.14)' : 'rgba(14, 165, 233, 0.16)',
          line: { color: 'transparent', shape: 'hv' },
          name: 'IC 95% Greenwood',
          hoverinfo: 'skip',
          showlegend: true,
          type: 'scatter',
        } as Data);
      }

      traces.push({
        x: times,
        y: surv,
        type: 'scatter',
        mode: 'lines',
        line: { shape: 'hv', width: 2.5, color: SCI_COLORS[0] },
        name: 'Survie Kaplan-Meier',
        hovertemplate: 't=%{x}<br>S(t)=%{y:.1f}%<extra></extra>',
      } as Data);
    }

    const layout: Partial<Layout> = {
      title: {
        text: logRank
          ? `Courbe de Survie Kaplan-Meier (Log-Rank p = ${Number(logRank.p_value).toFixed(4)})`
          : 'Courbe de Survie Kaplan-Meier (IC 95%)',
        font: { size: 14 },
      },
      xaxis: { title: { text: resultData.duration_column || 'Temps' } },
      yaxis: { title: { text: 'Probabilité de survie (%)' }, range: [0, 105] },
      legend: { orientation: 'h', y: -0.2 },
    };
    return { traces, layout };
  }, [km, groupCurves, logRank, resultData.duration_column, isLight]);

  return (
    <div className="space-y-5">
      <Section title={`Analyse de Survie (${resultData.duration_column || ''})`} icon={Activity} color="#0284c7">
        <SummaryStrip
          items={[
            { label: 'Observations', value: resultData.n_observations },
            { label: 'Événements', value: resultData.n_events },
            { label: 'Survie Médiane', value: resultData.median_survival_time ?? 'Non atteinte', tone: 'success' },
          ]}
        />
      </Section>

      {kmPlot.traces.length > 0 && (
        <Section title="Courbe de Survie (Kaplan-Meier)" icon={TrendingUp} color="#0284c7">
          <PlotlyChart data={kmPlot.traces} layout={kmPlot.layout} height={360} />
        </Section>
      )}

      {logRank && (
        <Section title="Test du Log-Rank (Mantel-Cox)" icon={Activity} color="#0284c7">
          <SummaryStrip
            items={[
              { label: 'Comparaison', value: `${logRank.group1} vs ${logRank.group2}` },
              { label: 'Statistique χ²', value: logRank.chi2_statistic },
              { label: 'p-value', value: logRank.p_value, tone: logRank.significant ? 'success' : 'warning' },
              { label: 'Différence', value: logRank.significant ? 'Significative' : 'Non significative', tone: logRank.significant ? 'success' : 'warning' },
            ]}
          />
        </Section>
      )}

      {km.length > 0 && (
        <Section title="Table de Survie Kaplan-Meier & IC Greenwood (95%)" icon={BarChart2} color="#0284c7">
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
        <Section title="Régression de Cox (Hazard Ratios)" icon={TrendingUp} color="#059669">
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
