import { useState, useMemo, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';
import { getNodeLabel, type NodeResult } from './canvasGraphConfig';

interface UseCanvasPipelineProps {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  addLog: (message: string, level?: 'info' | 'success' | 'error', nodeId?: string) => void;
  setSelectedResultNode: (node: { id: string; type: string; title: string; result: any } | null) => void;
}

export function useCanvasPipeline({
  nodes,
  setNodes,
  edges,
  addLog,
  setSelectedResultNode,
}: UseCanvasPipelineProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineResults, setPipelineResults] = useState<Record<string, NodeResult> | null>(null);
  const [showResults, setShowResults] = useState(false);

  const resolveNodeLabel = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      return getNodeLabel(nodeId, node?.type);
    },
    [nodes]
  );

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

    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...n.data, runStatus: 'processing' },
      }))
    );

    try {
      const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
      const token = authEnabled ? localStorage.getItem('access_token') || '' : '';

      const response = await fetch(`${API_V1_BASE}/canvas/stream_pipeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': (() => {
            try {
              return getAnonymousClientId();
            } catch {
              return '';
            }
          })(),
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

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'node_start') {
              const label = resolveNodeLabel(data.node_id);
              addLog(`[${label}] Début d'exécution...`, 'info', data.node_id);
              setNodes(nds =>
                nds.map(n =>
                  n.id === data.node_id ? { ...n, data: { ...n.data, runStatus: 'processing' } } : n
                )
              );
            } else if (data.type === 'node_log') {
              const label = resolveNodeLabel(data.node_id);
              addLog(`[${label}] ${data.message}`, 'info', data.node_id);
            } else if (data.type === 'node_complete') {
              const label = resolveNodeLabel(data.node_id);
              addLog(`[${label}] ${data.message}`, 'success', data.node_id);

              setPipelineResults(prev => ({
                ...prev,
                [data.node_id]: { status: data.status, message: data.message, result: data.result },
              }));

              setNodes(nds =>
                nds.map(n => {
                  if (n.id !== data.node_id) return n;
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      runStatus: data.status,
                      runResult: data.result,
                      runMessage: data.message,
                      onOpenResult: (targetId: string) => {
                        const targetNode = nds.find(tn => tn.id === targetId) || n;
                        const type = targetNode.type || '';
                        const title = resolveNodeLabel(targetId);
                        setSelectedResultNode({ id: targetId, type, title, result: data.result });
                      },
                    },
                  };
                })
              );
            } else if (data.type === 'node_error') {
              const label = resolveNodeLabel(data.node_id);
              addLog(`[${label}] Erreur : ${data.error}`, 'error', data.node_id);

              setPipelineResults(prev => ({
                ...prev,
                [data.node_id]: { status: 'error', error: data.error },
              }));

              setNodes(nds =>
                nds.map(n =>
                  n.id === data.node_id
                    ? { ...n, data: { ...n.data, runStatus: 'error', runError: data.error } }
                    : n
                )
              );
            } else if (data.type === 'pipeline_complete') {
              addLog('Pipeline exécuté avec succès !', 'success');
              setShowResults(true);
            }
          } catch (err) {
            console.error('SSE parse error:', err);
          }
        }
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
    setNodes(nds =>
      nds.map(n => ({
        ...n,
        data: { ...n.data, runStatus: 'idle' },
      }))
    );
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
