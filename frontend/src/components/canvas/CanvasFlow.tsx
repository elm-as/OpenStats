import React, { useCallback, useState } from 'react';
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
import { nodeTypes, edgeTypes } from './canvasGraphConfig';
import { useCanvasGraph } from './useCanvasGraph';
import { useCanvasPipeline } from './useCanvasPipeline';
import { useCanvasExport } from './useCanvasExport';
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

  const pipeline = useCanvasPipeline({
    nodes: graph.nodes,
    setNodes: graph.setNodes,
    edges: graph.edges,
    addLog,
    setSelectedResultNode,
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
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          onNodesChange={graph.onNodesChange}
          onEdgesChange={graph.onEdgesChange}
          onConnect={graph.onConnect}
          onEdgeDoubleClick={(_, edge) =>
            graph.setEdges(eds => eds.filter(e => e.id !== edge.id))
          }
          onInit={graph.setReactFlowInstance}
          onDrop={graph.onDrop}
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
          <MiniMap
            nodeStrokeColor="#ffffff"
            nodeColor="#0f172a"
            maskColor="rgba(15,23,42,0.6)"
            className="!bg-surface-900/90 !border !border-white/[0.1] !rounded-xl !shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden backdrop-blur-md"
            style={{ right: 20, bottom: 20 }}
          />
        </ReactFlow>

        <CanvasActionToolbar
          nodesCount={graph.nodes.length}
          isRunning={pipeline.isRunning}
          isSharing={exporter.isSharing}
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
