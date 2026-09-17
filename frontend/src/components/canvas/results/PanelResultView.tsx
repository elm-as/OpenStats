import React from 'react';
import { Grid3x3, Scale, Layers } from 'lucide-react';
import { Section, KpiCard, DataTable } from './ResultAtoms';

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

  const entetes = ['Variable', 'Coefficient', 'Erreur type', 't / z', 'p-valeur', 'Significatif'];
  const lignesCoefficients = (retenu.coefficients || []).map((c: any) => [
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
        color="#f97316"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Entités" value={resultData.n_entities} color="#f97316" />
          <KpiCard label="Observations" value={resultData.n_observations} color="#8b5cf6" />
          <KpiCard
            label="Panel cylindré"
            value={resultData.is_balanced ? 'oui' : 'non'}
            color="#10b981"
          />
          <KpiCard label="R² within" value={fe.r2_within} color="#06b6d4" />
        </div>
        <p className="text-[11px] text-surface-400 mt-3 leading-relaxed">
          Entité : <span className="text-surface-200">{resultData.entity_column}</span> · Période :{' '}
          <span className="text-surface-200">{resultData.time_column}</span>
        </p>
      </Section>

      <Section title="Test de Hausman" icon={Scale} color="#06b6d4">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="χ²" value={hausman.statistic} color="#06b6d4" />
          <KpiCard label="p-valeur" value={hausman.p_value} color="#ef4444" />
          <KpiCard
            label="Modèle retenu"
            value={prefereFE ? 'Effets fixes' : 'Effets aléatoires'}
            color="#10b981"
          />
        </div>
        {hausman.conclusion && (
          <p className="text-[11px] text-surface-300 mt-3 leading-relaxed">{hausman.conclusion}</p>
        )}
      </Section>

      <Section
        title={`Coefficients — ${prefereFE ? 'effets fixes (within)' : 'effets aléatoires (GLS)'}`}
        icon={Layers}
        color="#8b5cf6"
      >
        {lignesCoefficients.length > 0 ? (
          <DataTable headers={entetes} rows={lignesCoefficients} />
        ) : (
          <p className="text-[11px] text-surface-400">Aucun coefficient estimé.</p>
        )}
      </Section>
    </div>
  );
};
