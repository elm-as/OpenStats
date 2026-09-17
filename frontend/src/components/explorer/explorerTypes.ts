/** Types du moteur d'exploration adaptative (miroir de app/core/exploration). */

export interface CovariateScore {
  column: string;
  mutual_info: number;
}

export interface ProbeInfo {
  key: string;
  label: string;
  explains: string;
  admissible: boolean;
  gated: boolean;
  triggered_by: string[];
  estimated_cost_sec: number;
}

export interface Capabilities {
  dataset_id: string;
  target: string | null;
  target_kind: string | null;
  n_rows: number;
  columns: { numeric: string[]; categorical: string[]; temporal: string[] };
  covariate_ranking: CovariateScore[];
  initial_facts: string[];
  probes: ProbeInfo[];
  n_admissible: number;
}

export interface Finding {
  kind: string;
  variables: string[];
  effect_size: number;
  effect_metric: string;
  headline: string;
  detail: string;
  p_value: number | null;
  n: number;
  establishes: string[];
  payload: Record<string, unknown>;
  probe: string;
  q_value: number | null;
  survives_fdr: boolean | null;
  magnitude: number;
  confidence: number;
  effect_label: string;
  interest: number;
}

export type ProbeStatus = 'success' | 'empty' | 'error' | 'skipped_budget' | 'not_triggered';

export interface ProbeRun {
  key: string;
  label: string;
  status: ProbeStatus;
  duration_ms: number;
  n_findings: number;
  triggered_by: string[];
  error: string | null;
}

export interface ExplorationSummary {
  probes_run: number;
  probes_available: number;
  findings_total: number;
  findings_retained: number;
  hypotheses_tested: number;
  surviving_fdr: number;
  descriptive_findings: number;
}

export interface ExplorationResult {
  target: string | null;
  target_kind: string | null;
  findings: Finding[];
  runs: ProbeRun[];
  facts: string[];
  covariate_ranking: CovariateScore[];
  fdr: { tested: number; descriptive: number; surviving: number; alpha: number };
  notes: string[];
  elapsed_sec: number;
  budget_exhausted: boolean;
  summary: ExplorationSummary;
}

/** Une étape du raisonnement, telle qu'elle se déroule en direct. */
export interface TraceStep {
  key: string;
  label: string;
  explains: string;
  triggeredBy: string[];
  status: 'running' | ProbeStatus;
  durationMs?: number;
  nFindings?: number;
  error?: string | null;
}

export type ExplorerEvent =
  | { type: 'context'; target: string | null; target_kind: string | null; n_rows: number;
      covariate_ranking: CovariateScore[]; initial_facts: string[];
      admissible_probes: { key: string; label: string; explains: string; gated: boolean }[];
      budget_sec: number }
  | { type: 'probe_start'; key: string; label: string; explains: string;
      triggered_by: string[]; elapsed_sec: number }
  | { type: 'finding'; probe: string; finding: Finding }
  | ({ type: 'probe_done'; new_facts: string[]; elapsed_sec: number } & ProbeRun)
  | { type: 'complete'; result: ExplorationResult }
  | { type: 'error'; error: string };

/** Libellés lisibles des faits internes du moteur. */
export const FACT_LABELS: Record<string, string> = {
  cible_definie: 'cible définie',
  cible_numeric: 'cible continue',
  cible_categorical: 'cible qualitative',
  cible_binary: 'cible binaire',
  axe_temporel: 'axe temporel',
  petit_echantillon: 'petit échantillon',
  multi_numerique: 'plusieurs variables continues',
  categorielles_presentes: 'variables qualitatives',
  association_lineaire: 'association linéaire',
  non_linearite: 'relation non linéaire',
  colinearite_possible: 'colinéarité possible',
  multicolinearite: 'multicolinéarité',
  difference_groupes: 'différence entre groupes',
  segmenteur_disponible: 'variable segmentante',
  lien_categoriel: 'lien entre qualitatives',
  asymetrie: 'distribution asymétrique',
  non_normalite: 'non-normalité',
  valeurs_extremes: 'valeurs extrêmes',
  transformation_utile: 'transformation utile',
  desequilibre_classes: 'classes déséquilibrées',
  non_stationnarite: 'non-stationnarité',
  differenciation_requise: 'différenciation requise',
  tendance: 'tendance temporelle',
  causalite_granger: 'précédence de Granger',
  predicteur_avance: 'prédicteur avancé',
  interaction: 'effet d’interaction',
  relation_conditionnelle: 'relation conditionnelle',
  paradoxe_simpson: 'paradoxe de Simpson',
  modele_utile: 'modèle prédictif utile',
  variable_dominante: 'variable dominante',
  heteroscedasticite: 'hétéroscédasticité',
  erreurs_robustes_requises: 'erreurs robustes requises',
  pouvoir_predictif_nul: 'aucun pouvoir prédictif',
};

export const factLabel = (fact: string): string => FACT_LABELS[fact] ?? fact.replace(/_/g, ' ');
