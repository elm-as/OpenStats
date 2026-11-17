import React from 'react';
import { X, BarChart2, AlertCircle, FileCode, Zap, Info } from 'lucide-react';
import CodeViewerModal from './CodeViewerModal';
import { fetchPythonAndRCode } from './canvasCodeExport';
import { Badge, RenderJson, Section, getNodeLabel } from './results/ResultAtoms';
import {
  DatasetResultView,
  TypingResultView,
  CleaningResultView,
  DescriptiveStatsResultView,
  CorrelationResultView,
  VifResultView,
} from './results/DescriptiveResultView';
import {
  StatisticalTestsResultView,
  BootstrapResultView,
  CausalResultView,
} from './results/StatisticalTestsResultView';
import {
  ExplainabilityResultView,
  ManifoldResultView,
  ClusteringResultView,
  RegressionClassificationResultView,
} from './results/ModelingResultView';
import { HierarchicalClusteringResultView } from './results/HierarchicalClusteringResultView';

import { TimeSeriesResultView } from './results/TimeSeriesResultView';
import { PanelResultView } from './results/PanelResultView';
import { AnalyticResultView } from './results/AnalyticResultView';
import { FactorAnalysisResultView } from './results/FactorAnalysisResultView';
import {
  InsightsResultView,
  TransformResultView,
  ComputeVariableResultView,
} from './results/TransformResultView';
import {
  VisualizationResultView,
  OutputReportResultView,
  SimulationResultView,
  ScriptAndCustomResultView,
} from './results/CustomScriptResultView';

interface CanvasResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTitle: string;
  nodeType: string;
  resultData: any;
  nodes?: any[];
  pipelineResults?: any;
}

export default function CanvasResultModal(props: CanvasResultModalProps) {
  const {
    isOpen,
    onClose,
    nodeTitle,
    nodeType,
    resultData,
    nodes,
    pipelineResults,
  } = props;
  const [showCodeModal, setShowCodeModal] = React.useState(false);
  const [pyCode, setPyCode] = React.useState('');
  const [rCode, setRCode] = React.useState('');

  if (!isOpen) return null;

  const renderNodeResult = (type: string, data: any) => {
    if (!data) return <div className="text-surface-400 italic text-sm p-4">Aucun résultat disponible.</div>;
    if (data.error) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm text-red-200 font-medium">{data.error}</p>
            {data.traceback && (
              <pre className="text-[10px] text-red-300/60 mt-2 font-mono whitespace-pre-wrap max-h-40 overflow-auto">
                {data.traceback}
              </pre>
            )}
          </div>
        </div>
      );
    }

    if (type === 'dataset') return <DatasetResultView resultData={data} />;
    if (type === 'typing') return <TypingResultView resultData={data} />;
    if (type === 'cleaning') return <CleaningResultView resultData={data} />;
    if (type === 'descriptiveNumeric' || type === 'descriptiveCategorical') {
      return <DescriptiveStatsResultView resultData={data} />;
    }
    if (type === 'correlation') return <CorrelationResultView resultData={data} />;
    if (type === 'vif') return <VifResultView resultData={data} />;

    if (
      [
        'testCompareMeans',
        'testCorrelation',
        'testIndependence',
        'testStationarity',
        'testNormality',
        'testAnova',
      ].includes(type)
    ) {
      return <StatisticalTestsResultView nodeType={type} resultData={data} />;
    }
    if (type === 'bootstrap') return <BootstrapResultView resultData={data} />;
    if (type === 'causal') return <CausalResultView resultData={data} />;
    if (type === 'explainability') return <ExplainabilityResultView resultData={data} />;
    if (type === 'manifold') return <ManifoldResultView resultData={data} />;
    if (type === 'clustering') return <ClusteringResultView resultData={data} />;
    if (type === 'hierarchicalClustering') return <HierarchicalClusteringResultView resultData={data} />;
    if (type === 'regression' || type === 'classification') {

      return <RegressionClassificationResultView nodeType={type} resultData={data} />;
    }

    if (
      [
        'granger',
        'cointegration',
        'tsDecomposition',
        'chowTest',
        'outliers',
        'survival',
        'garch',
        'timeseries',
        'multivariateTimeseries',
      ].includes(type)
    ) {
      return <TimeSeriesResultView nodeType={type} resultData={data} />;
    }

    if (['pca', 'ca', 'mca'].includes(type)) {
      return <FactorAnalysisResultView nodeType={type} resultData={data} />;
    }

    if (type === 'panel') return <PanelResultView resultData={data} />;

    const VUES_INFERENCE: Record<string, { titre: string; couleur: string }> = {
      countModel: { titre: 'Modèle de comptage', couleur: '#14b8a6' },
      regressionDiagnostics: { titre: 'Diagnostics de régression', couleur: '#ef4444' },
      powerAnalysis: { titre: 'Puissance statistique', couleur: '#f59e0b' },
      quantileRegression: { titre: 'Régression quantile', couleur: '#0ea5e9' },
      equivalenceTest: { titre: "Test d'équivalence (TOST)", couleur: '#10b981' },
    };
    if (VUES_INFERENCE[type]) {
      return (
        <AnalyticResultView
          resultData={data}
          titre={VUES_INFERENCE[type].titre}
          couleur={VUES_INFERENCE[type].couleur}
        />
      );
    }
    if (type === 'insights') return <InsightsResultView resultData={data} />;
    if (type === 'visualization') return <VisualizationResultView resultData={data} />;
    if (type === 'output') return <OutputReportResultView resultData={data} />;
    if (type === 'transform') return <TransformResultView resultData={data} />;
    if (type === 'computeVariable') return <ComputeVariableResultView resultData={data} />;
    if (type === 'simulation') return <SimulationResultView resultData={data} />;
    if (['ai', 'extension', 'sql', 'python'].includes(type)) {
      return <ScriptAndCustomResultView nodeType={type} resultData={data} />;
    }

    return <RenderJson data={data} />;
  };

  const renderContent = () => {
    if (nodeType === 'global') {
      const executedNodes = Object.entries(pipelineResults || {}).filter(
        ([k, r]: any) => k !== '_global' && r.status === 'success'
      );

      if (executedNodes.length === 0) {
        return (
          <div className="text-surface-400 italic text-sm p-4 text-center">
            Aucun résultat d'analyse disponible pour le moment.
          </div>
        );
      }

      return (
        <div className="space-y-10 divide-y divide-white/[0.06]">
          {executedNodes.map(([nodeId, r]: any, idx) => {
            const node = nodes?.find(n => n.id === nodeId);
            const type = node?.type || '';
            const title = getNodeLabel(type, nodeId);

            return (
              <div key={nodeId} className={idx > 0 ? 'pt-8' : ''}>
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-1.5 h-5 bg-accent-500 rounded-full" />
                  <h3 className="text-sm font-bold text-strong uppercase tracking-wider">{title}</h3>
                </div>
                {renderNodeResult(type, r.result)}
              </div>
            );
          })}
        </div>
      );
    }
    return renderNodeResult(nodeType, resultData);
  };

  const renderInsightsBlock = () => {
    const insights = resultData?.insights || [];
    if (!Array.isArray(insights) || insights.length === 0) return null;

    const severityColors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#f59e0b',
      low: '#10b981',
      info: '#3b82f6',
      methodological: '#14b8a6',
    };

    return (
      <div className="mt-6 border-t border-white/[0.06] pt-6">
        <Section title={`${insights.length} insight(s) généré(s)`} icon={Zap} color="#06b6d4">
          <div className="space-y-3">
            {insights.map((ins: any, idx: number) => {
              const sev = ins.severity || ins.type || 'info';
              const col = severityColors[sev] || '#6b7280';
              const isTutorial = ins.tags?.includes('tutorial');
              const bgClass = isTutorial
                ? 'bg-sky-500/10 border-sky-500/30'
                : 'bg-surface-800/40 border-white/[0.06]';
              return (
                <div
                  key={idx}
                  className={`rounded-xl p-4 border-l-[3px] border ${bgClass}`}
                  style={{ borderLeftColor: col }}
                >
                  <div className="flex items-start gap-3">
                    <Info size={16} className="shrink-0 mt-0.5" style={{ color: col }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-surface-100">{ins.title || 'Insight'}</span>
                        <Badge color={col}>{sev}</Badge>
                      </div>
                      <p className="text-xs text-surface-300 leading-relaxed">
                        {ins.description || ins.text || ins.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    );
  };

  const handleOpenCodeModal = async () => {
    setShowCodeModal(true);
    try {
      const { pythonCode, rCode: generatedR } = await fetchPythonAndRCode({
        nodes: [{ id: 'node_1', type: nodeType, data: resultData || {} }],
        edges: [],
        dataset_name: 'dataset.csv',
      });
      if (pythonCode) setPyCode(pythonCode);
      if (generatedR) setRCode(generatedR);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/75" onClick={onClose} />
        <div className="ui-panel relative w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
          >
            <div className="flex items-center gap-2.5">
              <BarChart2 className="text-accent-400" size={16} />
              <div>
                <h2 className="text-sm font-bold text-[var(--ui-text)]">{nodeTitle}</h2>
                <p className="text-[11px] ui-t-muted">Résultats du bloc</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCodeModal}
                className="ui-btn text-xs bg-accent-500/15 hover:bg-accent-500/25 text-accent-400 border-accent-500/30"
              >
                <FileCode size={14} /> Code Source (Python & R)
              </button>
              <button
                onClick={onClose}
                className="p-2 text-surface-400 hover:text-surface-100 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto flex-1 min-h-0">
            {renderContent()}
            {nodeType !== 'insights' && nodeType !== 'global' && renderInsightsBlock()}
          </div>
        </div>
      </div>

      <CodeViewerModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        title={`Code Source Reproductible — ${nodeTitle}`}
        pythonCode={pyCode}
        rCode={rCode}
      />
    </>
  );
}
