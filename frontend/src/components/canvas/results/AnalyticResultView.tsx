import React from 'react';
import { FlaskConical, ListChecks } from 'lucide-react';
import { Section, KpiCard, DataTable } from './ResultAtoms';

/**
 * Vue commune aux analyses inférentielles (comptage, diagnostics, puissance,
 * quantiles, équivalence).
 *
 * Elle met l'interprétation en premier : sur ces analyses, la conclusion tient
 * en une phrase et les tableaux ne servent qu'à l'étayer. Une vue par analyse
 * aurait multiplié le même code sans rien apporter de plus.
 */

const LIBELLES: Record<string, string> = {
  dispersion: 'Dispersion',
  n_observations: 'Observations',
  r_squared: 'R²',
  r_squared_adj: 'R² ajusté',
  durbin_watson: 'Durbin-Watson',
  n_violations: 'Hypothèses en défaut',
  puissance_atteinte: 'Puissance atteinte',
  effet_observe_d: "Effet observé (d)",
  effet_minimal_detectable_unites: 'Effet minimal détectable',
  n_requis_par_groupe: 'n requis / groupe',
  difference_observee: 'Écart observé',
  marge_equivalence: "Marge d'équivalence",
  p_value_tost: 'p (TOST)',
  p_value_test_classique: 'p (test classique)',
  mean_count: 'Moyenne',
  variance_count: 'Variance',
  n_comparaisons: 'Comparaisons',
  n_significatives: 'Significatives',
};

const IGNORES = new Set([
  'status', 'interpretation', 'message', 'covariates', 'quantiles', 'groupes',
]);

function estTableau(valeur: unknown): valeur is Record<string, unknown>[] {
  return (
    Array.isArray(valeur) &&
    valeur.length > 0 &&
    typeof valeur[0] === 'object' &&
    valeur[0] !== null &&
    !Array.isArray(valeur[0])
  );
}

function formater(valeur: unknown): string {
  if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non';
  if (valeur === null || valeur === undefined) return '—';
  return String(valeur);
}

export const AnalyticResultView = ({
  resultData,
  titre,
  couleur = '#8b5cf6',
}: {
  resultData: any;
  titre: string;
  couleur?: string;
}) => {
  const donnees = resultData || {};

  const scalaires = Object.entries(donnees).filter(
    ([cle, v]) =>
      !IGNORES.has(cle) &&
      (typeof v === 'number' || typeof v === 'boolean') &&
      LIBELLES[cle] !== undefined
  );

  const tableaux = Object.entries(donnees).filter(([cle, v]) => !IGNORES.has(cle) && estTableau(v));

  return (
    <div className="space-y-5">
      <Section title={titre} icon={FlaskConical} color={couleur}>
        {donnees.interpretation && (
          <p className="text-xs text-surface-200 leading-relaxed mb-3">{donnees.interpretation}</p>
        )}
        {scalaires.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {scalaires.map(([cle, valeur]) => (
              <KpiCard
                key={cle}
                label={LIBELLES[cle] || cle}
                value={typeof valeur === 'boolean' ? (valeur ? 'oui' : 'non') : (valeur as number)}
                color={couleur}
              />
            ))}
          </div>
        )}
      </Section>

      {tableaux.map(([cle, lignes]) => {
        const entetes = Object.keys((lignes as Record<string, unknown>[])[0]);
        const rangees = (lignes as Record<string, unknown>[]).map(ligne =>
          entetes.map(e => formater(ligne[e]))
        );
        return (
          <Section key={cle} title={LIBELLES[cle] || cle} icon={ListChecks} color={couleur}>
            <DataTable headers={entetes} rows={rangees} />
          </Section>
        );
      })}
    </div>
  );
};
