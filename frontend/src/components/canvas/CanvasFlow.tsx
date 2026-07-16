import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Connection,
  Edge,
  Node,
  BaseEdge,
  getBezierPath
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Loader2, CheckCircle2, XCircle, AlertCircle, Share2, Copy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';

import Sidebar from './Sidebar';
import TemplateSelector from './TemplateSelector';
import {
  DatasetNode,
  TypingNode, CleaningNode, TransformNode, ComputeVariableNode,
  DescriptiveNumericNode, DescriptiveCategoricalNode,
  CorrelationNode, VIFNode,
  TestCompareMeansNode, TestCorrelationNode, TestIndependenceNode, TestStationarityNode,
  PCANode, CANode, MCANode, ClusteringNode,
  RegressionNode, ClassificationNode,
  TimeSeriesNode, MultivariateTimeSeriesNode,
  SimulationNode,
  VisualizationNode,
  AINode, ExtensionNode, InsightsNode, OutputNode,
  SqlNode, PythonNode,
  CanvasNodeData,
} from './nodes';
import CanvasResultModal from './CanvasResultModal';

const initialNodes: Node[] = [];

export const nodeTypes = {
  dataset: DatasetNode,
  typing: TypingNode,
  cleaning: CleaningNode,
  transform: TransformNode,
  computeVariable: ComputeVariableNode,
  descriptiveNumeric: DescriptiveNumericNode,
  descriptiveCategorical: DescriptiveCategoricalNode,
  correlation: CorrelationNode,
  vif: VIFNode,
  testCompareMeans: TestCompareMeansNode,
  testCorrelation: TestCorrelationNode,
  testIndependence: TestIndependenceNode,
  testStationarity: TestStationarityNode,
  pca: PCANode,
  ca: CANode,
  mca: MCANode,
  clustering: ClusteringNode,
  regression: RegressionNode,
  classification: ClassificationNode,
  timeseries: TimeSeriesNode,
  multivariateTimeseries: MultivariateTimeSeriesNode,
  simulation: SimulationNode,
  visualization: VisualizationNode,
  ai: AINode,
  extension: ExtensionNode,
  insights: InsightsNode,
  output: OutputNode,
  sql: SqlNode,
  python: PythonNode,
};


interface NodeResult {
  status: 'success' | 'error' | 'skipped';
  message?: string;
  error?: string;
  result?: unknown;
}

const AnimatedDataEdge = ({
  id,
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
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: edgeColor, strokeWidth: 2, strokeLinecap: 'round', opacity: 0.5 }} />
      <circle r="3" fill={edgeColor} style={{ filter: `drop-shadow(0 0 5px ${edgeColor})` }}>
        <animateMotion dur={edgeSpeed} repeatCount="indefinite" path={edgePath} />
      </circle>
      {/* Une deuxième particule décalée pour plus de fluidité */}
      <circle r="2" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }}>
        <animateMotion dur={edgeSpeed} begin={edgeSpeedOffset} repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

export const edgeTypes = { animatedDataEdge: AnimatedDataEdge };

let id = 1;
const getId = () => `node_${id++}`;

function DnDFlow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Pipeline execution state
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<Record<string, NodeResult> | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [selectedResultNode, setSelectedResultNode] = useState<{ id: string; type: string; title: string; result: any } | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [lastDroppedId, setLastDroppedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const datasetId = searchParams.get('dataset');
    const templateEncoded = searchParams.get('template');
    
    if (templateEncoded && nodes.length === 0) {
      try {
        const payload = JSON.parse(decodeURIComponent(templateEncoded));
        if (payload.nodes) {
          const templateNodes = payload.nodes.map((n: any) => ({
            ...n,
            data: {
              ...n.data,
              onChange: onNodeDataChange,
              onDelete: onNodeDelete,
              getConnectedDatasetId,
            },
          }));
          const templateEdges = (payload.edges || []).map((e: any) => ({
            ...e,
            type: 'animatedDataEdge',
          }));
          const maxId = templateNodes.reduce((max: number, n: any) => {
            const num = parseInt(n.id.replace('node_', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          id = Math.max(id, maxId + 1);
          setNodes(templateNodes);
          setEdges(templateEdges);
        }
      } catch {}
      return;
    }

    if (datasetId && nodes.length === 0) {
      const newNode: Node = {
        id: 'ds_from_dashboard',
        type: 'dataset',
        position: { x: 100, y: 200 },
        data: {
          importMode: 'existing',
          file: datasetId,
          onChange: onNodeDataChange,
          onDelete: onNodeDelete,
          getConnectedDatasetId,
        },
      };
      setNodes([newNode]);
      id = Math.max(id, 2);
    }
  }, [searchParams]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => {
    // Déterminer la couleur/vitesse selon le nœud source
    let color = '#38bdf8'; // Bleu (Data) par défaut
    let speed = '2.5s';
    let speedOffset = '1.25s';

    setNodes((currentNodes) => {
      const sourceNode = currentNodes.find(n => n.id === params.source);
      if (sourceNode) {
        if (['dataset', 'cleaning', 'transform', 'computeVariable', 'typing'].includes(sourceNode.type as string)) {
          color = '#38bdf8'; // Bleu (Data/Prépa)
          speed = '2s';
          speedOffset = '1s';
        } else if (['descriptiveNumeric', 'descriptiveCategorical', 'correlation', 'vif', 'pca', 'ca', 'mca', 'clustering'].includes(sourceNode.type as string)) {
          color = '#8b5cf6'; // Violet (Analyse)
          speed = '3s';
          speedOffset = '1.5s';
        } else if (['regression', 'classification', 'timeseries', 'multivariateTimeseries', 'simulation'].includes(sourceNode.type as string)) {
          color = '#10b981'; // Vert Émeraude (ML)
          speed = '1.5s'; // Plus rapide pour simuler du calcul intense
          speedOffset = '0.75s';
        } else {
          color = '#f59e0b'; // Ambre (Test/Output)
          speed = '2.5s';
          speedOffset = '1.25s';
        }
      }
      return currentNodes;
    });

    return addEdge({
      ...params,
      type: 'animatedDataEdge',
      data: { color, speed, speedOffset },
    }, eds);
  }), [setEdges, setNodes]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeDataChange = useCallback((nodeId: string, key: string, value: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, [key]: value },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const onNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  // Trace path backwards to find the dataset ID
  const getConnectedDatasetId = useCallback((nodeId: string): string | null => {
    let currentId = nodeId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) return null; // Cycle
      visited.add(currentId);

      const node = nodes.find(n => n.id === currentId);
      if (node?.type === 'dataset' && node.data?.file) {
        return node.data.file as string;
      }

      // Find parent
      const parentEdge = edges.find(e => e.target === currentId);
      if (!parentEdge) return null;
      currentId = parentEdge.source;
    }
    return null;
  }, [nodes, edges]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = getId();
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: { 
          onChange: onNodeDataChange, 
          onDelete: onNodeDelete,
          getConnectedDatasetId
        },
      };

      setLastDroppedId(newNodeId);
      setTimeout(() => setLastDroppedId(null), 500);

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, onNodeDataChange, onNodeDelete, getConnectedDatasetId],
  );

  // ── Template loading ──
  const loadTemplate = useCallback((templateNodes: Node[], templateEdges: Edge[]) => {
    // Inject callbacks into template nodes
    const injectedNodes = templateNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        onChange: onNodeDataChange,
        onDelete: onNodeDelete,
        getConnectedDatasetId,
      },
    }));

    // Update the ID counter to avoid collisions
    const maxId = templateNodes.reduce((max, n) => {
      const num = parseInt(n.id.replace('node_', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    id = maxId + 1;

    setNodes(injectedNodes);
    setEdges(templateEdges);
    setPipelineResults(null);
    setShowResults(false);
  }, [setNodes, setEdges, onNodeDataChange, onNodeDelete, getConnectedDatasetId]);

  // ── Pipeline execution ──
  const handleRun = async () => {
    if (nodes.length === 0) return;
    setIsRunning(true);
    setPipelineResults(null);
    setShowResults(false);

    // Build payload — strip callbacks from data
    const pipeline = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: Object.fromEntries(
          Object.entries(n.data).filter(([k]) => k !== 'onChange' && k !== 'onDelete')
        ),
      })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
    };

    // Update node borders to "running" state
    setNodes((nds) => nds.map(n => ({
      ...n,
      data: { ...n.data, runStatus: 'processing' },
    })));

    try {
      const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
      const token = authEnabled ? (localStorage.getItem('access_token') || '') : '';
      const response = await fetch(`${API_V1_BASE}/canvas/run_pipeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': (() => { try { return getAnonymousClientId(); } catch { return ''; } })(),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(pipeline),
      });

      const result = await response.json();

      if (result.success) {
        const nodeResults: Record<string, NodeResult> = result.results || {};
        setPipelineResults(nodeResults);
        setShowResults(true);

        // Color nodes by result status
        setNodes((nds) => nds.map(n => {
          const r = nodeResults[n.id];
          return {
            ...n,
            data: { ...n.data, runStatus: r?.status || 'idle' },
          };
        }));
      } else {
        // Global error
        setPipelineResults({ _global: { status: 'error', error: result.error || 'Erreur inconnue' } });
        setShowResults(true);
        // Reset borders
        setNodes((nds) => nds.map(n => ({
          ...n,
          data: { ...n.data, runStatus: 'error' },
        })));
      }
    } catch (e) {
      console.error('Pipeline error:', e);
      setPipelineResults({ _global: { status: 'error', error: 'Connexion au serveur échouée' } });
      setShowResults(true);
      setNodes((nds) => nds.map(n => ({
        ...n,
        data: { ...n.data, runStatus: 'error' },
      })));
    } finally {
      setIsRunning(false);
    }
  };

  // ── Share Pipeline ──
  const handleShare = async () => {
    if (nodes.length === 0) return;
    setIsSharing(true);
    setShareUrl(null);
    
    const pipeline = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: Object.fromEntries(
          Object.entries(n.data).filter(([k]) => k !== 'onChange' && k !== 'onDelete')
        ),
        position: n.position,
      })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
      results: pipelineResults, // Inclure les résultats pour que les viewers puissent voir l'analyse
    };
    
    try {
      const response = await fetch(`${API_V1_BASE}/canvas/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': (() => { try { return getAnonymousClientId(); } catch { return ''; } })(),
        },
        body: JSON.stringify(pipeline),
      });
      const result = await response.json();
      if (result.success) {
        const fullUrl = `${window.location.origin}${result.url}`;
        setShareUrl(fullUrl);
      } else {
        alert("Erreur lors du partage : " + result.error);
      }
    } catch (e) {
      console.error('Share error:', e);
      alert("Erreur réseau lors du partage");
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      // Feedback simple
      const btn = document.getElementById('copy-btn');
      if (btn) {
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-emerald-400"><path d="M20 6 9 17l-5-5"/></svg> Copié !';
        setTimeout(() => {
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copier le lien';
        }, 2000);
      }
    }
  };

  const resetResults = () => {
    setPipelineResults(null);
    setShowResults(false);
    setNodes((nds) => nds.map(n => ({
      ...n,
      data: { ...n.data, runStatus: 'idle' },
    })));
  };

  // Compute summary stats from results
  const summary = pipelineResults ? (() => {
    const entries = Object.entries(pipelineResults).filter(([k]) => k !== '_global');
    return {
      total: entries.length,
      success: entries.filter(([, r]) => r.status === 'success').length,
      error: entries.filter(([, r]) => r.status === 'error').length,
      skipped: entries.filter(([, r]) => r.status === 'skipped').length,
    };
  })() : null;

  // Build display-friendly label for a node ID
  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return nodeId;
    const labels: Record<string, string> = {
      dataset: 'Source', typing: 'Type', cleaning: 'Nettoyage', transform: 'Transf.',
      computeVariable: 'Variable', descriptiveNumeric: 'Desc. Num.', descriptiveCategorical: 'Desc. Cat.',
      correlation: 'Corrélation', vif: 'VIF', testCompareMeans: 'Moyennes', testCorrelation: 'Corr.',
      testIndependence: 'Indép.', testStationarity: 'Stat.',
      pca: 'ACP', ca: 'AFC', mca: 'ACM',
      clustering: 'Clustering', regression: 'Régression', classification: 'Classif.',
      timeseries: 'Séries Temp.', multivariateTimeseries: 'TS Multivarié', simulation: 'Simulation',
      visualization: 'Graphique', ai: 'IA', extension: 'Extension', insights: 'Insights', output: 'Export',
    };
    return labels[node.type || ''] || node.type || nodeId;
  };

  return (
    <div className="flex h-[calc(100vh-56px)] w-full text-surface-50">
      <Sidebar />
      <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
        <TemplateSelector onSelect={loadTemplate} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={(event, edge) => setEdges((eds) => eds.filter((e) => e.id !== edge.id))}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes as any}
          edgeTypes={edgeTypes as any}
          fitView
          snapToGrid={true}
          snapGrid={[15, 15]}
          className="bg-surface-950"
          defaultEdgeOptions={{
            type: 'animatedDataEdge',
            style: { stroke: '#38bdf8', strokeWidth: 2, opacity: 0.5 },
          }}
        >
          <Background color="#1e293b" gap={24} size={1.5} />
          <Controls className="!bg-surface-800/90 !border !border-white/[0.08] !rounded-xl !shadow-2xl [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-surface-300 [&>button:hover]:!bg-white/10 [&>button]:!rounded-lg" />
          <MiniMap
            nodeStrokeColor="#ffffff"
            nodeColor="#0f172a"
            maskColor="rgba(15,23,42,0.6)"
            className="!bg-surface-900/90 !border !border-white/[0.1] !rounded-xl !shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden backdrop-blur-md"
            style={{ right: 20, bottom: 20 }}
          />
        </ReactFlow>

        <div className="absolute bottom-8 right-8 flex items-center gap-4 z-10">
          <button
            className={`px-5 py-3.5 rounded-full font-bold text-sm shadow-lg border border-white/[0.08] backdrop-blur-md transition-all flex items-center gap-2 ${
              isSharing
                ? 'bg-surface-800 text-surface-400 cursor-wait'
                : 'bg-surface-900/80 hover:bg-surface-800 text-surface-200 hover:text-white'
            }`}
            onClick={handleShare}
            disabled={isSharing || nodes.length === 0}
            title="Générer un lien public en lecture seule"
          >
            {isSharing ? (
              <><Loader2 size={16} className="animate-spin" /> ...</>
            ) : (
              <><Share2 size={16} /> Partager</>
            )}
          </button>
          <button
            className={`px-7 py-3.5 rounded-full font-black text-sm shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] hover:-translate-y-1 transition-all flex items-center gap-2.5 ${
              isRunning
                ? 'bg-surface-600 text-surface-300 cursor-wait'
                : 'bg-accent-500 hover:bg-accent-400 text-surface-950'
            }`}
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
          >
            {isRunning ? (
              <><Loader2 size={18} className="animate-spin" /> Exécution en cours...</>
            ) : (
              <><Play fill="currentColor" size={18} /> Exécuter le Workflow</>
            )}
          </button>
        </div>
        
        {/* Modal / Toast de Partage */}
        {shareUrl && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-surface-900 border border-accent-500/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-5 w-[400px] animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-surface-50 text-lg flex items-center gap-2">
                <Share2 className="text-accent-400" size={20} />
                Lien généré !
              </h3>
              <button onClick={() => setShareUrl(null)} className="text-surface-400 hover:text-white">
                <XCircle size={20} />
              </button>
            </div>
            <p className="text-surface-300 text-sm mb-4">Ce lien permet à n'importe qui de consulter votre workflow et ses résultats en lecture seule.</p>
            <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/[0.06]">
              <input type="text" readOnly value={shareUrl} className="bg-transparent border-none outline-none text-surface-200 text-xs w-full px-2" />
              <button 
                id="copy-btn"
                onClick={copyToClipboard}
                className="shrink-0 bg-white/10 hover:bg-white/20 text-surface-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Copy size={14} /> Copier le lien
              </button>
            </div>
          </div>
        )}

        {/* ── Results Panel ── */}
        {showResults && pipelineResults && (
          <div className="absolute top-4 right-4 w-[380px] max-h-[calc(100vh-120px)] overflow-auto z-20 rounded-2xl border border-white/[0.08] bg-surface-900/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                {summary && summary.error > 0 ? (
                  <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                    <XCircle size={16} className="text-red-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-surface-100">Résultats du Pipeline</h3>
                  {summary && (
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {summary.success} OK · {summary.error > 0 ? `${summary.error} FAIL · ` : ''}{summary.skipped > 0 ? `${summary.skipped} SKIP` : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={resetResults}
                className="text-surface-400 hover:text-surface-200 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                Fermer
              </button>
            </div>

            {/* Global error */}
            {pipelineResults._global && (
              <div className="px-5 py-3 bg-red-500/10 border-b border-red-500/20">
                <p className="text-xs text-red-300 font-medium">{pipelineResults._global.error}</p>
              </div>
            )}

            {/* Per-node results */}
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(pipelineResults)
                .filter(([k]) => k !== '_global')
                .map(([nodeId, result]) => (
                <div key={nodeId} className="px-5 py-3 hover:bg-white/[0.02] transition-colors group flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      {result.status === 'success' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                      {result.status === 'error' && <XCircle size={14} className="text-red-400 shrink-0" />}
                      {result.status === 'skipped' && <AlertCircle size={14} className="text-amber-400 shrink-0" />}
                      <span className="text-xs font-bold text-surface-200">{getNodeLabel(nodeId)}</span>
                    </div>
                    <p className={`text-[11px] mt-1 ml-6 leading-relaxed ${
                      result.status === 'success' ? 'text-surface-400' :
                      result.status === 'error' ? 'text-red-300/80' :
                      'text-amber-300/70'
                    }`}>
                      {result.message || result.error || 'Terminé'}
                    </p>
                  </div>
                  {result.status === 'success' && result.result !== undefined && (
                    <button
                      onClick={() => setSelectedResultNode({
                        id: nodeId,
                        type: nodes.find(n => n.id === nodeId)?.type || '',
                        title: getNodeLabel(nodeId),
                        result: result.result
                      })}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-white/10 text-surface-400 hover:text-accent-400 transition-all shrink-0 mt-1"
                      title="Voir les résultats"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Modal de détails */}
        <CanvasResultModal
          isOpen={!!selectedResultNode}
          onClose={() => setSelectedResultNode(null)}
          nodeTitle={selectedResultNode?.title || ''}
          nodeType={selectedResultNode?.type || ''}
          resultData={selectedResultNode?.result}
        />
      </div>
    </div>
  );
}

export default function CanvasFlow() {
  return (
    <ReactFlowProvider>
      <DnDFlow />
    </ReactFlowProvider>
  );
}
