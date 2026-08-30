import { AnalysisDoc } from './types';
import { DESCRIPTIVE_ANALYSES } from './data/descriptive';
import { TESTS_ANALYSES } from './data/tests';
import { MODELING_ANALYSES } from './data/modeling';
import { TIMESERIES_ANALYSES } from './data/timeseries';
import { CAUSAL_SURVIVAL_ANALYSES } from './data/causal_survival';
import { FACTORIELLE_CLUSTERING_ANALYSES } from './data/factorielle_clustering';
import { SIMULATION_ANALYSES } from './data/simulation';
import { EXTENSIONS_ANALYSES } from './data/extensions';

export * from './types';

export const ANALYSES_DATA: AnalysisDoc[] = [
  ...DESCRIPTIVE_ANALYSES,
  ...TESTS_ANALYSES,
  ...MODELING_ANALYSES,
  ...TIMESERIES_ANALYSES,
  ...CAUSAL_SURVIVAL_ANALYSES,
  ...FACTORIELLE_CLUSTERING_ANALYSES,
  ...SIMULATION_ANALYSES,
  ...EXTENSIONS_ANALYSES,
];
