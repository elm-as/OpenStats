import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { apiFetch } from '../../lib/apiBase';
import { getNodeLabel, type NodeResult } from './canvasGraphConfig';
import { getCanvasSessionSnapshot, saveCanvasPipelineState } from './canvasSessionStore';

interface UseCanvasPipelineProps {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  addLog: (message: string, level?: 'info' | 'success' | 'error', nodeId?: string) => void;
  setSelectedResultNode: (node: { id: string; type: string; title: string; result: any } | null) => void;
}

interface SseDispatchContext {
  data: any;
  resolveNodeLabel: (id: string) => string;
  addLog: UseCanvasPipelineProps['addLog'];
  setNodes: UseCanvasPipelineProps['setNodes'];
  setPipelineResults: React.Dispatch<React.SetStateAction<Record<string, NodeResult> | null>>;
  setShowResults: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedResultNode: UseCanvasPipelineProps['setSelectedResultNode'];
}

function patchNodeData(
  setNodes: UseCanvasPipelineProps['setNodes'],
  nodeId: string,
  buildPatch: (n: Node, allNodes: Node[]) => Record<string, any>
) {
  setNodes(nds => nds.map(n => (n.id === nodeId ? { ...n, data: { ...n.data, ...buildPatch(n, nds) } } : n)));
}

function handleSseEvent(ctx: SseDispatchContext) {
  const { data, resolveNodeLabel, addLog, setNodes, setPipelineResults, setShowResults, setSelectedResultNode } = ctx;
  const label = data.node_id ? resolveNodeLabel(data.node_id) : '';

  if (data.type === 'node_start') {
    addLog(`[${label}] Début d'exécution...`, 'info', data.node_id);
    patchNodeData(setNodes, data.node_id, () => ({ runStatus: 'processing' }));
    return;
  }
  if (data.type === 'node_log') {
    addLog(`[${label}] ${data.message}`, 'info', data.node_id);
    return;
  }
  if (data.type === 'node_complete') {
    addLog(`[${label}] ${data.message}`, 'success', data.node_id);
    setPipelineResults(prev => ({
      ...prev,
      [data.node_id]: { status: data.status, message: data.message, result: data.result },
    }));
    patchNodeData(setNodes, data.node_id, (n, nds) => ({
      runStatus: data.status,
      runResult: data.result,
      runMessage: data.message,
      onOpenResult: (targetId: string) => {
        const targetNode = nds.find(tn => tn.id === targetId) || n;
        setSelectedResultNode({
          id: targetId,
          type: targetNode.type || '',
          title: resolveNodeLabel(targetId),
          result: data.result,
        });
      },
    }));
    return;
  }
  if (data.type === 'node_error') {
    addLog(`[${label}] Erreur : ${data.error}`, 'error', data.node_id);
    setPipelineResults(prev => ({ ...prev, [data.node_id]: { status: 'error', error: data.error } }));
    patchNodeData(setNodes, data.node_id, () => ({ runStatus: 'error', runError: data.error }));
    return;
  }
  if (data.type === 'pipeline_complete') {
    addLog('Pipeline exécuté avec succès', 'success');
    setShowResults(true);
  }
}

export function useCanvasPipeline(props: UseCanvasPipelineProps) {
  const { nodes, setNodes, edges, addLog, setSelectedResultNode } = props;
  const cached = getCanvasSessionSnapshot();
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<Record<string, NodeResult> | null>(
    cached.pipelineResults,
  );
  const [showResults, setShowResults] = useState(cached.showResults);

  useEffect(() => {
    saveCanvasPipelineState(pipelineResults, showResults);
  }, [pipelineResults, showResults]);

  const resolveNodeLabel = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      return getNodeLabel(nodeId, node?.type);
    },
    [nodes]
  );

  // Restaure le gestionnaire d'ouverture de résultat sur les nœuds conservés entre onglets.
  useEffect(() => {
    if (!pipelineResults) return;
    setNodes(nds =>
      nds.map(n => {
        if (!n.data?.runResult || typeof n.data.onOpenResult === 'function') return n;
        const storedResult = n.data.runResult;
        return {
          ...n,
          data: {
            ...n.data,
            onOpenResult: (targetId: string) => {
              const targetNode = nds.find(tn => tn.id === targetId) || n;
              setSelectedResultNode({
                id: targetId,
                type: targetNode.type || '',
                title: getNodeLabel(targetId, targetNode.type),
                result: storedResult,
              });
            },
          },
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dispatchChunks = (chunks: string[]) => {
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith('data: ')) continue;
      try {
        handleSseEvent({
          data: JSON.parse(line.slice(6)),
          resolveNodeLabel,
          addLog,
          setNodes,
          setPipelineResults,
          setShowResults,
          setSelectedResultNode,
        });
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    }
  };

  const handleRun = async () => {
    if (nodes.length === 0) return;
    setIsRunning(true);
    setPipelineResults({});
    setShowResults(false);
    addLog('Démarrage du pipeline...', 'info');

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
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, runStatus: 'processing' } })));

    try {
      const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
      const token = authEnabled ? localStorage.getItem('access_token') || '' : '';
      const response = await apiFetch('/canvas/stream_pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(pipeline),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Erreur serveur (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';
        dispatchChunks(chunks);
      }
    } catch (e: any) {
      console.error('Pipeline streaming error:', e);
      const errorMessage = e?.message || 'Erreur réseau ou déconnexion du serveur';
      addLog(`Erreur globale : ${errorMessage}`, 'error');
      setPipelineResults(prev => ({ ...prev, _global: { status: 'error', error: errorMessage } }));
      setShowResults(true);
    } finally {
      setIsRunning(false);
    }
  };

  const resetResults = () => {
    setPipelineResults(null);
    setShowResults(false);
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, runStatus: 'idle' } })));
  };

  const summary = useMemo(() => {
    if (!pipelineResults) return null;
    const entries = Object.entries(pipelineResults).filter(([k]) => k !== '_global');
    return {
      total: entries.length,
      success: entries.filter(([, r]) => r.status === 'success').length,
      error: entries.filter(([, r]) => r.status === 'error').length,
      skipped: entries.filter(([, r]) => r.status === 'skipped').length,
    };
  }, [pipelineResults]);

  return {
    isRunning,
    pipelineResults,
    setPipelineResults,
    showResults,
    setShowResults,
    handleRun,
    resetResults,
    summary,
    resolveNodeLabel,
  };
}
