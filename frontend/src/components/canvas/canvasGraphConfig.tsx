import React from 'react';
import { BaseEdge, getBezierPath } from '@xyflow/react';
import {
  DatasetNode,
  TypingNode,
  CleaningNode,
  TransformNode,
  ComputeVariableNode,
  DescriptiveNumericNode,
  DescriptiveCategoricalNode,
  CorrelationNode,
  VIFNode,
  TestCompareMeansNode,
  TestCorrelationNode,
  TestIndependenceNode,
  TestStationarityNode,
  TestNormalityNode,
  TestAnovaNode,
  PCANode,
  CANode,
  MCANode,
  ClusteringNode,
  HierarchicalClusteringNode,
  RegressionNode,


  ClassificationNode,
  ExplainabilityNode,
  TimeSeriesNode,
  MultivariateTimeSeriesNode,
  GrangerNode,
  CointegrationNode,
  TSDecompositionNode,
  ChowTestNode,
  SimulationNode,
  VisualizationNode,
  AINode,
  ExtensionNode,
  InsightsNode,
  OutputNode,
  SqlNode,
  PythonNode,
  BootstrapNode,
  OutliersNode,
  SurvivalNode,
  PanelNode,
  CausalNode,
  ManifoldNode,
  GarchNode,
} from './nodes';
import {
  CountModelNode,
  RegressionDiagnosticsNode,
  PowerAnalysisNode,
  QuantileRegressionNode,
  EquivalenceTestNode,
} from './nodes/InferenceNodes';

export interface NodeResult {
  status: 'success' | 'error' | 'skipped';
  message?: string;
  error?: string;
  result?: unknown;
}

export const nodeTypes = {
  dataset: DatasetNode,
  typing: TypingNode,
  cleaning: CleaningNode,
  transform: TransformNode,
  computeVariable: ComputeVariableNode,
  descriptiveNumeric: DescriptiveNumericNode,
  descriptiveCategorical: DescriptiveCategoricalNode,
  bootstrap: BootstrapNode,
  outliers: OutliersNode,
  correlation: CorrelationNode,
  vif: VIFNode,
  testCompareMeans: TestCompareMeansNode,
  testCorrelation: TestCorrelationNode,
  testIndependence: TestIndependenceNode,
  testStationarity: TestStationarityNode,
  testNormality: TestNormalityNode,
  testAnova: TestAnovaNode,
  pca: PCANode,
  ca: CANode,
  mca: MCANode,
  clustering: ClusteringNode,
  hierarchicalClustering: HierarchicalClusteringNode,
  regression: RegressionNode,

  classification: ClassificationNode,
  explainability: ExplainabilityNode,
  survival: SurvivalNode,
  panel: PanelNode,
  countModel: CountModelNode,
  regressionDiagnostics: RegressionDiagnosticsNode,
  powerAnalysis: PowerAnalysisNode,
  quantileRegression: QuantileRegressionNode,
  equivalenceTest: EquivalenceTestNode,
  causal: CausalNode,
  manifold: ManifoldNode,
  garch: GarchNode,
  timeseries: TimeSeriesNode,
  multivariateTimeseries: MultivariateTimeSeriesNode,
  granger: GrangerNode,
  cointegration: CointegrationNode,
  tsDecomposition: TSDecompositionNode,
  chowTest: ChowTestNode,
  simulation: SimulationNode,
  visualization: VisualizationNode,
  ai: AINode,
  extension: ExtensionNode,
  insights: InsightsNode,
  output: OutputNode,
  sql: SqlNode,
  python: PythonNode,
};

export const AnimatedDataEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: any) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  const edgeColor = data?.color || '#38bdf8';
  const edgeSpeed = data?.speed || '2.5s';
  const edgeSpeedOffset = data?.speedOffset || '1.25s';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          strokeLinecap: 'round',
          opacity: 0.5,
        }}
      />
      <circle r="3" fill={edgeColor} style={{ filter: `drop-shadow(0 0 5px ${edgeColor})` }}>
        <animateMotion dur={edgeSpeed} repeatCount="indefinite" path={edgePath} />
      </circle>
      <circle
        r="2"
        fill="#ffffff"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}
      >
        <animateMotion
          dur={edgeSpeed}
          begin={edgeSpeedOffset}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
    </>
  );
};

export const edgeTypes = { animatedDataEdge: AnimatedDataEdge };

const NODE_LABELS_MAP: Record<string, string> = {
  dataset: 'Source',
  typing: 'Type',
  cleaning: 'Nettoyage',
  transform: 'Transf.',
  computeVariable: 'Variable',
  descriptiveNumeric: 'Desc. Num.',
  descriptiveCategorical: 'Desc. Cat.',
  correlation: 'Corrélation',
  vif: 'VIF',
  testCompareMeans: 'Moyennes',
  testCorrelation: 'Corr.',
  testIndependence: 'Indép.',
  testStationarity: 'Stat.',
  pca: 'ACP',
  ca: 'AFC',
  mca: 'ACM',
  clustering: 'Clustering',
  regression: 'Régression',
  classification: 'Classif.',
  timeseries: 'Séries Temp.',
  multivariateTimeseries: 'TS Multivarié',
  simulation: 'Simulation',
  visualization: 'Graphique',
  ai: 'IA',
  extension: 'Extension',
  insights: 'Insights',
  output: 'Export',
};

export function getNodeLabel(nodeId: string, nodeType?: string): string {
  return NODE_LABELS_MAP[nodeType || ''] || nodeType || nodeId;
}
