import React, { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import Sidebar from './Sidebar';
import TemplateSelector from './TemplateSelector';
import CodeViewerModal from './CodeViewerModal';
import CanvasResultModal from './CanvasResultModal';
import CanvasLogConsole, { LogEntry } from './CanvasLogConsole';
import { CanvasSearchBar } from './CanvasSearchBar';
import { nodeTypes, edgeTypes } from './canvasGraphConfig';
import { useCanvasGraph } from './useCanvasGraph';
import { useCanvasPipeline } from './useCanvasPipeline';
import { useCanvasExport } from './useCanvasExport';
import { useCanvasHistory } from './useCanvasHistory';
import { useCanvasLayout } from './useCanvasLayout';
import { useCanvasWorkspace } from './useCanvasWorkspace';
import { CanvasActionToolbar } from './CanvasActionToolbar';
import { CanvasPipelineResultsPanel } from './CanvasPipelineResultsPanel';
import { CanvasShareModal } from './CanvasShareModal';

export { nodeTypes, edgeTypes };

function DnDFlow() {
  const [selectedResultNode, setSelectedResultNode] = useState<{
    id: string;
    type: string;
    title: string;
    result: any;
  } | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const addLog = useCallback(
    (message: string, level: 'info' | 'success' | 'error' = 'info', nodeId?: string) => {
      const time = new Date().toLocaleTimeString();
      setLogs(prev => [
        ...prev,
        { id: Math.random().toString(36).slice(2), time, message, level, nodeId },
      ]);
    },
    []
  );

  const graph = useCanvasGraph({
    onResetPipeline: () => {
      pipeline.setPipelineResults(null);
      pipeline.setShowResults(false);
    },
  });

  const history = useCanvasHistory(
    graph.nodes,
    graph.setNodes,
    graph.edges,
    graph.setEdges
  );

  const { computeAutoLayout } = useCanvasLayout();

  const handleAutoLayout = useCallback(() => {
    history.takeSnapshot();
    const next = computeAutoLayout(graph.nodes, graph.edges);
    graph.setNodes(next);
    setTimeout(() => {
      graph.reactFlowInstance?.fitView({ duration: 600 });
    }, 50);
  }, [graph.nodes, graph.edges, graph.setNodes, graph.reactFlowInstance, computeAutoLayout, history]);

  // Raccourci clavier Ctrl+F pour la recherche de nœuds
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectSearchNode = useCallback(
    (node: any) => {
      if (graph.reactFlowInstance && node.position) {
        graph.reactFlowInstance.setCenter(node.position.x + 120, node.position.y + 60, {
          zoom: 1.2,
          duration: 600,
        });
      }
    },
    [graph.reactFlowInstance]
  );

  const pipeline = useCanvasPipeline({
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    edges: graph.edges,
    addLog,
    setSelectedResultNode,
  });

  const workspace = useCanvasWorkspace({
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    edges: graph.edges,
    setEdges: graph.setEdges,
    pipelineResults: pipeline.pipelineResults,
    setPipelineResults: pipeline.setPipelineResults,
    onSuccess: msg => addLog(msg, 'success'),
    onError: err => addLog(err, 'error'),
    onTakeSnapshot: history.takeSnapshot,
    fitView: graph.reactFlowInstance?.fitView,
  });

  const exporter = useCanvasExport({
    nodes: graph.nodes,
    edges: graph.edges,
    pipelineResults: pipeline.pipelineResults,
  });

  return (
    <div className="flex h-[calc(100vh-56px)] w-full text-surface-50">
      <Sidebar />
      <div className="flex-1 h-full relative" ref={graph.reactFlowWrapper}>
        <TemplateSelector onSelect={graph.loadTemplate} />

        {/* Barre de recherche de nœuds */}
        <CanvasSearchBar
          nodes={graph.nodes}
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSelectNode={handleSelectSearchNode}
        />

        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          onNodesChange={graph.onNodesChange}
          onEdgesChange={graph.onEdgesChange}
          onConnect={params => {
            history.takeSnapshot();
            graph.onConnect(params);
          }}
          onEdgeDoubleClick={(_, edge) => {
            history.takeSnapshot();
            graph.setEdges(eds => eds.filter(e => e.id !== edge.id));
          }}
          onInit={graph.setReactFlowInstance}
          onDrop={e => {
            const file = e.dataTransfer.files?.[0];
            if (file && (file.name.endsWith('.openstats') || file.name.endsWith('.json'))) {
              e.preventDefault();
              workspace.importWorkspaceFromFile(file);
              return;
            }
            history.takeSnapshot();
            graph.onDrop(e);
          }}
          onDragOver={graph.onDragOver}
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
          {showMiniMap && (
            <MiniMap
              nodeStrokeColor="#ffffff"
              nodeColor="#0f172a"
              maskColor="rgba(15,23,42,0.6)"
              className="!bg-surface-900/90 !border !border-white/[0.1] !rounded-xl !shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden backdrop-blur-md"
              style={{ right: 20, bottom: 20 }}
            />
          )}
        </ReactFlow>

        <CanvasActionToolbar
          nodesCount={graph.nodes.length}
          isRunning={pipeline.isRunning}
          isSharing={exporter.isSharing}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          showMiniMap={showMiniMap}
          onUndo={history.undo}
          onRedo={history.redo}
          onAutoLayout={handleAutoLayout}
          onToggleMiniMap={() => setShowMiniMap(prev => !prev)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onExportWorkspace={() => workspace.exportWorkspace()}
          onImportWorkspace={workspace.importWorkspaceFromFile}
          onOpenGlobalCodeModal={exporter.handleOpenGlobalCodeModal}
          onSaveTemplate={exporter.handleSaveTemplate}
          onShare={exporter.handleShare}
          onRun={pipeline.handleRun}
        />

        <CanvasShareModal
          shareUrl={exporter.shareUrl}
          onClose={() => exporter.setShareUrl(null)}
          onCopy={exporter.copyToClipboard}
        />

        <CanvasPipelineResultsPanel
          showResults={pipeline.showResults}
          pipelineResults={pipeline.pipelineResults}
          nodes={graph.nodes}
          summary={pipeline.summary}
          resolveNodeLabel={pipeline.resolveNodeLabel}
          onOpenGlobalReport={() =>
            setSelectedResultNode({
              id: 'global_report',
              type: 'global',
              title: 'Rapport Global du Pipeline',
              result: pipeline.pipelineResults,
            })
          }
          onOpenNodeResult={(nodeId, nodeType, nodeName, result) =>
            setSelectedResultNode({
              id: nodeId,
              type: nodeType,
              title: nodeName,
              result,
            })
          }
          onResetResults={pipeline.resetResults}
        />

        <CanvasResultModal
          isOpen={!!selectedResultNode}
          onClose={() => setSelectedResultNode(null)}
          nodeTitle={selectedResultNode?.title || ''}
          nodeType={selectedResultNode?.type || ''}
          resultData={selectedResultNode?.result}
          nodes={graph.nodes}
          pipelineResults={pipeline.pipelineResults}
        />

        <CanvasLogConsole
          logs={logs}
          isRunning={pipeline.isRunning}
          onClear={() => setLogs([])}
        />

        <CodeViewerModal
          isOpen={exporter.showGlobalCodeModal}
          onClose={() => exporter.setShowGlobalCodeModal(false)}
          title="Script Pipeline Canvas Complet (Python & R)"
          pythonCode={exporter.pythonCode}
          rCode={exporter.rCode}
          onExportNotebook={exporter.handleExportNotebook}
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
