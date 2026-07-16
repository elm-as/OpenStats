// Canvas node types - re-exported from nodes folder for convenience
export type { CanvasNodeData } from './nodes';

export type NodeType =
  // Source
  | 'dataset'
  // Préparation
  | 'typing'
  | 'cleaning'
  | 'transform'
  | 'computeVariable'
  // Statistiques descriptives
  | 'descriptiveNumeric'
  | 'descriptiveCategorical'
  // Corrélations & Diagnostic
  | 'correlation'
  | 'vif'
  // Tests d'hypothèses
  | 'testCompareMeans'
  | 'testCorrelation'
  | 'testIndependence'
  | 'testStationarity'
  // Analyse factorielle & Clustering
  | 'pca'
  | 'ca'
  | 'mca'
  | 'clustering'
  // Machine Learning
  | 'regression'
  | 'classification'
  // Séries temporelles
  | 'timeseries'
  | 'multivariateTimeseries'
  // Simulation
  | 'simulation'
  // Visualisation
  | 'visualization'
  // IA & Export
  | 'ai'
  | 'extension'
  | 'insights'
  | 'output';
