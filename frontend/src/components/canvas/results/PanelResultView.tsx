import React from 'react';
import { Grid3x3, Scale, Layers } from 'lucide-react';
import { Section, SummaryStrip, DataTable } from './ResultAtoms';
import { PlotlyChart } from '../../viz/PlotlyBase';

/**
 * Résultat d'une estimation de panel.
 *
 * Le test de Hausman est mis en avant parce qu'il décide lequel des deux jeux
 * de coefficients est interprétable : lire les effets aléatoires alors qu'ils
 * sont corrélés aux régresseurs conduit à des conclusions fausses.
 */
export const PanelResultView = ({ resultData }: { resultData: any }) => {
  const hausman = resultData.hausman_test || {};
  const fe = resultData.fixed_effects || {};
  const re = resultData.random_effects || {};
  const prefereFE = Boolean(hausman.prefer_fixed_effects);
  const retenu = prefereFE ? fe : re;
  const coefs = (retenu.coefficients || []) as any[];
  const sortedCoefs = [...coefs].reverse();

  const entetes = ['Variable', 'Coefficient', 'Erreur type', 't / z', 'p-valeur', 'Significatif'];
  const lignesCoefficients = coefs.map((c: any) => [
    c.variable,
    c.coefficient,
    c.std_error,
    c.t_statistic ?? c.z_statistic,
    c.p_value,
    c.significant ? 'oui' : 'non',
  ]);

  return (
    <div className="space-y-5">
      <Section
        title={`Économétrie de panel — ${resultData.target_column || ''}`}
        icon={Grid3x3}
        color="#d97706"
      >
        <SummaryStrip
          items={[
            { label: 'Entités', value: resultData.n_entities },
            { label: 'Observations', value: resultData.n_observations },
            { label: 'Panel cylindré', value: resultData.is_balanced ? 'oui' : 'non', tone: resultData.is_balanced ? 'success' : 'neutral' },
            { label: 'R² within', value: fe.r2_within },
          ]}
        />
        <p className="text-[11px] ui-t-muted mt-2.5 leading-relaxed">
          Entité : <span className="font-medium text-[var(--ui-text)]">{resultData.entity_column}</span> · Période :{' '}
          <span className="font-medium text-[var(--ui-text)]">{resultData.time_column}</span>
        </p>
      </Section>

      <Section title="Test de Hausman" icon={Scale} color="#0284c7">
        <SummaryStrip
          items={[
            { label: 'χ²', value: hausman.statistic },
            { label: 'p-valeur', value: hausman.p_value },
            { label: 'Modèle retenu', value: prefereFE ? 'Effets fixes' : 'Effets aléatoires', tone: 'success' },
          ]}
        />
        {hausman.conclusion && (
          <p className="text-[11px] text-[var(--ui-text-secondary)] mt-3 leading-relaxed">{hausman.conclusion}</p>
        )}
      </Section>

      <Section
        title={`Coefficients — ${prefereFE ? 'effets fixes (within)' : 'effets aléatoires (GLS)'}`}
        icon={Layers}
        color="#0284c7"
      >
        {sortedCoefs.length > 0 && (
          <div className="mb-4">
            <PlotlyChart
              data={[
                {
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Coefficient ± IC 95%',
                  x: sortedCoefs.map((c: any) => Number(c.coefficient ?? 0)),
                  y: sortedCoefs.map((c: any) => c.variable),
                  error_x: {
                    type: 'data',
                    array: sortedCoefs.map((c: any) => 1.96 * Math.abs(Number(c.std_error ?? 0))),
                    visible: true,
                    color: '#94a3b8',
                    thickness: 1.5,
                  },
                  marker: {
                    size: 9,
                    color: sortedCoefs.map((c: any) =>
                      !c.significant ? '#64748b' : Number(c.coefficient) >= 0 ? '#059669' : '#dc2626'
                    ),
                  },
                },
              ]}
              layout={{
                title: { text: 'Diagramme des coefficients (β ± IC 95%)', font: { size: 13 } },
                xaxis: { title: { text: 'Coefficient estimé' }, zeroline: true },
                yaxis: { automargin: true },
                showlegend: false,
                shapes: [
                  {
                    type: 'line',
                    x0: 0,
                    x1: 0,
                    y0: -0.5,
                    y1: Math.max(0.5, sortedCoefs.length - 0.5),
                    line: { color: '#94a3b8', width: 1, dash: 'dash' },
                  },
                ],
              }}
              height={Math.max(240, sortedCoefs.length * 34 + 100)}
            />
          </div>
        )}
        {lignesCoefficients.length > 0 ? (
          <DataTable headers={entetes} rows={lignesCoefficients} />
        ) : (
          <p className="text-[11px] text-[var(--ui-text-muted)]">Aucun coefficient estimé.</p>
        )}
      </Section>
    </div>
  );
};
