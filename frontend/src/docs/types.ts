export interface AnalysisDoc {
  id: string;
  title: string;
  category: 'descriptive' | 'tests' | 'modeling' | 'clustering' | 'timeseries' | 'factorielle' | 'simulation';
  categoryLabel: string;
  summary: string;
  useCase: string;
  assumptions: string[];
  formulaTitle: string;
  formulaTex: string; // Printable KaTeX mathematical notation
  variables: { symbol: string; label: string }[];
  formulaNote?: string;
  interpretationGuide: {
    metric: string;
    description?: string;
    thresholds?: string;
    decisionRule: string;
  }[];
  practicalExample: {
    context: string;
    sampleResult: string;
    conclusion: string;
  };
}

export const ANALYSES_CATEGORIES = [
  { id: 'all', label: 'Toutes les analyses' },
  { id: 'descriptive', label: 'Descriptif & Covariance' },
  { id: 'tests', label: 'Tests d\'Hypothèses' },
  { id: 'modeling', label: 'Régression & ML' },
  { id: 'clustering', label: 'Clustering & Segmentation' },
  { id: 'timeseries', label: 'Séries Temporelles' },
  { id: 'factorielle', label: 'Réduction de Dimension (ACP)' },
  { id: 'simulation', label: 'Simulation & Risque' },
];
