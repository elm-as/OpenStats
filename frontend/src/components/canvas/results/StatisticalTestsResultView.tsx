import React from 'react';
import {
  Activity,
  GitCompare,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { Section, SummaryStrip, DataTable, fmt } from './ResultAtoms';
import { PlotlyChart } from '../../viz/PlotlyBase';

export const StatisticalTestsResultView = ({
  nodeType,
  resultData,
}: {
  nodeType: string;
  resultData: any;
}) => {
  if (nodeType === 'testNormality' && resultData.tests) {
    return (
      <Section title="Test de Normalité (Shapiro-Wilk)" icon={Activity} color="#ef4444">
        <DataTable
          headers={['Colonne', 'Statistique W', 'p-value', 'Conclusion']}
          rows={resultData.tests.map((t: any) => [
            t.column,
            t.statistic,
            t.p_value,
            t.is_normal ? 'Normal (p > 0.05)' : 'Non-normal (p <= 0.05)',
          ])}
        />
      </Section>
    );
  }

  if (nodeType === 'testAnova') {
    return (
      <div className="space-y-4">
        <Section title="Résultat ANOVA & Kruskal-Wallis" icon={GitCompare} color="#ef4444">
        <SummaryStrip
          items={[
            { label: 'ANOVA (F-stat)', value: resultData.anova_f },
            { label: 'p-value (F-test)', value: resultData.anova_p, tone: resultData.anova_p < 0.05 ? 'success' : 'warning' },
            { label: 'Kruskal-Wallis (H-stat)', value: resultData.kruskal_h },
            { label: 'p-value (H-test)', value: resultData.kruskal_p, tone: resultData.kruskal_p < 0.05 ? 'success' : 'warning' },
          ]}
        />
        </Section>
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            resultData.is_significant
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}
        >
          {resultData.is_significant
            ? ' Différence statistiquement significative détectée entre les groupes (p < 0.05)'
            : ' Pas de différence statistiquement significative entre les moyennes (p >= 0.05)'}
        </div>
      </div>
    );
  }

  if (nodeType === 'testStationarity' && resultData.tests) {
    return (
      <div className="space-y-4">
        {resultData.tests.map((testResult: any, idx: number) => {
          const conclusion = testResult.conclusion || testResult.interpretation;
          return (
            <Section
              key={idx}
              title={`Stationnarité: ${testResult.column || `Variable ${idx + 1}`}`}
              icon={Activity}
              color="#8b5cf6"
            >
              {conclusion && (
                <div className="p-3 bg-surface-800/40 rounded-xl border border-white/[0.04] text-sm text-surface-200 mb-3 font-medium">
                  {conclusion}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-1">
                {testResult.adf && (
                  <div className="bg-surface-800/60 p-3 rounded-lg border border-white/[0.04]">
                    <div className="text-xs font-bold text-surface-400 mb-2">
                      Test ADF (Augmented Dickey-Fuller)
                    </div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-surface-400">Statistique</span>
                      <span className="text-xs font-mono text-surface-200">{fmt(testResult.adf.statistic)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-surface-400">p-value</span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          typeof testResult.adf.p_value === 'number' && testResult.adf.p_value < 0.05
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {testResult.adf.p_value === 0 ? '< 0.001' : fmt(testResult.adf.p_value)}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] mt-2 pt-2 border-t border-white/[0.04] ${
                        testResult.adf.is_stationary ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {testResult.adf.interpretation}
                    </div>
                  </div>
                )}
                {testResult.kpss && (
                  <div className="bg-surface-800/60 p-3 rounded-lg border border-white/[0.04]">
                    <div className="text-xs font-bold text-surface-400 mb-2">Test KPSS</div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-surface-400">Statistique</span>
                      <span className="text-xs font-mono text-surface-200">{fmt(testResult.kpss.statistic)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-surface-400">p-value</span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          typeof testResult.kpss.p_value === 'number' && testResult.kpss.p_value > 0.05
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {testResult.kpss.p_value === 0.1 ? '>= 0.10' : fmt(testResult.kpss.p_value)}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] mt-2 pt-2 border-t border-white/[0.04] ${
                        testResult.kpss.is_stationary ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {testResult.kpss.interpretation}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          );
        })}
      </div>
    );
  }

  const testName = resultData.test_name || resultData.test || 'Test';
  const pValue = resultData.p_value;
  const stat = resultData.statistic ?? resultData.coefficient;
  const conclusion = resultData.conclusion || resultData.interpretation;
  const significant = resultData.significant;
  const effectSize = resultData.effect_size;

  return (
    <div className="space-y-4">
      <Section title="Résultat du test" icon={CheckCircle2} color="#8b5cf6">
        <SummaryStrip
          items={[
            { label: 'Test', value: testName },
            ...(stat !== undefined ? [{ label: 'Statistique', value: stat }] : []),
            ...(pValue !== undefined
              ? [{
                  label: 'p-value',
                  value: typeof pValue === 'number' ? (pValue < 0.001 ? pValue.toExponential(3) : pValue.toFixed(4)) : pValue,
                  tone: (typeof pValue === 'number' && pValue < 0.05 ? 'success' : 'warning') as 'success' | 'warning',
                }]
              : []),
            ...(significant !== undefined
              ? [{
                  label: 'Significatif',
                  value: significant ? 'Oui (p < 0.05)' : 'Non (p >= 0.05)',
                  tone: (significant ? 'success' : 'warning') as 'success' | 'warning',
                }]
              : []),
          ]}
        />
      </Section>
      {conclusion && (
        <div className="p-3 bg-surface-800/40 rounded-xl border border-white/[0.04] text-sm text-surface-200">
          {conclusion}
        </div>
      )}
      {resultData.is_stationary !== undefined && (
        <div
          className={`p-3 rounded-lg border text-sm font-medium ${
            resultData.is_stationary
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}
        >
          {resultData.is_stationary ? 'La série est stationnaire' : "La série n'est pas stationnaire"}
        </div>
      )}
      {effectSize && typeof effectSize === 'object' && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(effectSize).map(([k, v]) => (
            <div key={k} className="bg-surface-800/30 rounded-lg px-3 py-2 border border-white/[0.03]">
              <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">
                {k.replace(/_/g, ' ')}
              </div>
              <div className="text-xs text-surface-200 font-mono mt-0.5">{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const BootstrapResultView = ({ resultData }: { resultData: any }) => {
  return (
    <div className="space-y-4">
      <Section title={`Bootstrap (95% IC) sur '${resultData.column}'`} icon={TrendingUp} color="#06b6d4">
        <SummaryStrip
          items={[
            { label: 'Estimation', value: resultData.point_estimate },
            { label: 'Borne Inf (2.5%)', value: resultData.ci_lower },
            { label: 'Borne Sup (97.5%)', value: resultData.ci_upper },
            { label: 'Erreur Type (SE)', value: resultData.se },
          ]}
        />
      </Section>
      <div className="p-3 bg-accent-500/10 border border-accent-500/25 rounded-lg text-xs text-surface-200">
        Intervalle de confiance à 95% obtenu par 1 000 tirages bootstrap non-paramétriques.
      </div>
    </div>
  );
};

export const CausalResultView = ({ resultData }: { resultData: any }) => {
  const isPsm = resultData.method?.includes('PSM') || resultData.method?.includes('Propensity');
  const effect = resultData.att ?? resultData.att_estimate ?? resultData.coefficient;
  const lovePlot = resultData.love_plot || [];
  const sortedLove = [...lovePlot].sort(
    (a: any, b: any) => Math.abs(a.smd_before ?? 0) - Math.abs(b.smd_before ?? 0)
  );

  return (
    <div className="space-y-4">
      <Section title={`Inférence Causale (${resultData.method})`} icon={GitCompare} color="#0284c7">
        <SummaryStrip
          items={[
            { label: 'Traitement (X)', value: resultData.treatment_column },
            { label: 'Résultat (Y)', value: resultData.outcome_column },
            { label: isPsm ? 'Effet Traitement (ATT)' : 'Effet Causal / Coef', value: effect !== undefined ? Number(effect).toFixed(4) : '—' },
            {
              label: 'p-value',
              value: resultData.p_value,
              tone: resultData.is_significant ? 'success' : 'warning',
            },
          ]}
        />
      </Section>

      {isPsm && (
        <SummaryStrip
          items={[
            { label: 'Paires Appariées (1:1)', value: resultData.n_matched_pairs },
            { label: 'Traités Totaux', value: resultData.n_treated_total },
            { label: 'Témoins Totaux', value: resultData.n_control_total },
          ]}
        />
      )}

      {lovePlot.length > 0 && (
        <Section title="Diagnostic de Balance des Covariables (Love Plot)" icon={GitCompare} color="#0284c7">
          <div className="mb-4">
            <PlotlyChart
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: '|SMD| Avant appariement',
                  x: sortedLove.map((l: any) => Math.abs(Number(l.smd_before ?? 0))),
                  y: sortedLove.map((l: any) => l.covariate),
                  marker: { color: '#d97706', size: 9, symbol: 'circle-open', line: { width: 2 } },
                },
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: '|SMD| Après appariement',
                  x: sortedLove.map((l: any) => Math.abs(Number(l.smd_after ?? 0))),
                  y: sortedLove.map((l: any) => l.covariate),
                  marker: { color: '#0284c7', size: 9, symbol: 'circle' },
                },
              ]}
              layout={{
                title: { text: 'Love Plot — Équilibre des covariables (|SMD|)', font: { size: 13 } },
                xaxis: { title: { text: 'Différence moyenne standardisée absolue |SMD|' }, zeroline: true },
                yaxis: { automargin: true },
                legend: { orientation: 'h', y: -0.22 },
                hovermode: 'y unified',
                shapes: [
                  {
                    type: 'line',
                    x0: 0.1,
                    x1: 0.1,
                    y0: -0.5,
                    y1: Math.max(0.5, sortedLove.length - 0.5),
                    line: { color: '#059669', width: 1.5, dash: 'dash' },
                  },
                ],
                annotations: [
                  {
                    x: 0.1,
                    y: 1.03,
                    yref: 'paper',
                    text: 'Seuil 0.1',
                    showarrow: false,
                    font: { size: 10, color: '#059669' },
                  },
                ],
              }}
              height={Math.max(250, sortedLove.length * 32 + 120)}
            />
          </div>
          <DataTable
            headers={['Covariable', 'SMD Avant (Non apparié)', 'SMD Après (Apparié)', 'Équilibre']}
            rows={lovePlot.map((l: any) => [
              l.covariate,
              l.smd_before?.toFixed(3) ?? '—',
              l.smd_after?.toFixed(3) ?? '—',
              l.balanced ? 'Équilibré (|SMD| < 0.1)' : 'Déséquilibre persistant',
            ])}
          />
        </Section>
      )}

      <div
        className="p-3.5 rounded-xl border text-xs font-semibold"
        style={
          resultData.is_significant
            ? { background: 'var(--ui-success-soft)', borderColor: 'var(--ui-success)', color: 'var(--ui-success)' }
            : { background: 'var(--ui-warning-soft)', borderColor: 'var(--ui-warning)', color: 'var(--ui-warning)' }
        }
      >
        {resultData.is_significant
          ? 'Effet causal statistiquement significatif du traitement (p < 0.05)'
          : "Pas d'effet causal significatif identifié au seuil 5%."}
      </div>
    </div>
  );
};

