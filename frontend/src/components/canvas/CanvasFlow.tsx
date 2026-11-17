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
import { useCurrentTheme } from '../viz/PlotlyBase';
import { getCanvasSessionSnapshot, saveCanvasLogs } from './canvasSessionStore';

export { nodeTypes, edgeTypes };

function DnDFlow() {
  const isLight = useCurrentTheme() === 'light';
  const [selectedResultNode, setSelectedResultNode] = useState<{
    id: string;
    type: string;
    title: string;
    result: any;
  } | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>(() => getCanvasSessionSnapshot().logs);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    saveCanvasLogs(logs);
  }, [logs]);

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

  const history = useCanvasHistory({
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    edges: graph.edges,
    setEdges: graph.setEdges,
  });

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
    <div
      className="flex h-full min-h-0 w-full"
      style={{ background: 'var(--ui-bg-app)', color: 'var(--ui-text)' }}
    >
      <Sidebar />
      <div className="flex-1 h-full flex flex-col min-w-0 relative" ref={graph.reactFlowWrapper}>
        <div
          className="ui-panel shrink-0 flex items-center justify-between gap-2 px-3 z-20"
          style={{
            minHeight: 40,
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            background: 'var(--ui-bg-panel)',
          }}
        >
          <TemplateSelector onSelect={graph.loadTemplate} />
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
        </div>

        <div className="flex-1 min-h-0 relative">
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
            style={{ background: 'var(--ui-bg-app)' }}
            defaultEdgeOptions={{
              type: 'animatedDataEdge',
              style: { stroke: isLight ? '#0284c7' : '#38bdf8', strokeWidth: 2, opacity: 0.65 },
            }}
          >
            <Background color={isLight ? '#cbd5e1' : '#1e293b'} gap={24} size={1.2} />
            <Controls
              className="!rounded-[var(--ui-radius)] !shadow-sm"
              style={{
                background: 'var(--ui-bg-panel)',
                border: '1px solid var(--ui-border-strong)',
              }}
            />
            {showMiniMap && (
              <MiniMap
                nodeStrokeColor={isLight ? '#64748b' : '#94a3b8'}
                nodeColor={isLight ? '#ffffff' : '#1e293b'}
                maskColor={isLight ? 'rgba(241,245,249,0.72)' : 'rgba(15,23,42,0.6)'}
                className="!rounded-[var(--ui-radius)] overflow-hidden"
                style={{
                  left: 56,
                  bottom: 16,
                  background: 'var(--ui-bg-panel)',
                  border: '1px solid var(--ui-border-strong)',
                }}
              />
            )}
          </ReactFlow>
        </div>

        <CanvasShareModal
          shareUrl={exporter.shareUrl}
          copied={exporter.copied}
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
