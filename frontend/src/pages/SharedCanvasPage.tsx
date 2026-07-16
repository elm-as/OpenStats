import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, MiniMap, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, AlertCircle, Home, CheckCircle2, XCircle } from 'lucide-react';
import { nodeTypes, edgeTypes } from '../components/canvas/CanvasFlow';
import CanvasResultModal from '../components/canvas/CanvasResultModal';
import { API_V1_BASE, getAnonymousClientId } from '../lib/apiBase';

export default function SharedCanvasPage() {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  
  const [selectedResultNode, setSelectedResultNode] = useState<{ id: string; type: string; title: string; result: any } | null>(null);

  useEffect(() => {
    async function fetchShared() {
      try {
        const res = await fetch(`${API_V1_BASE}/canvas/share/${shareId}`, {
          headers: {
            'X-Client-Id': (() => { try { return getAnonymousClientId(); } catch { return ''; } })(),
          },
        });
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "Impossible de charger ce lien partagé.");
        }
      } catch (err) {
        setError("Erreur réseau. Impossible de contacter le serveur.");
      } finally {
        setLoading(false);
      }
    }
    fetchShared();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center text-surface-400">
        <Loader2 className="animate-spin mb-4 text-accent-500" size={32} />
        <p>Chargement du rapport partagé...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col items-center justify-center text-surface-400 p-6">
        <AlertCircle className="text-red-500 mb-4" size={48} />
        <h2 className="text-xl font-bold text-surface-50 mb-2">Lien introuvable</h2>
        <p className="mb-6">{error}</p>
        <Link to="/" className="px-5 py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-lg flex items-center gap-2 transition-colors">
          <Home size={18} /> Retour à l'accueil
        </Link>
      </div>
    );
  }

  // Injecter l'état `runStatus` dans les noeuds pour qu'ils s'affichent correctement
  const nodes: Node[] = data.nodes.map((n: any) => {
    const nodeRes = data.results && data.results[n.id];
    return {
      ...n,
      data: {
        ...n.data,
        runStatus: nodeRes?.status || 'success', // Show success if no result is strictly tracked but the pipeline finished
      },
      draggable: false, // Read only
      selectable: true, // We want them to click to see results
    };
  });

  const edges: Edge[] = data.edges.map((e: any) => ({
    ...e,
    id: `e-${e.source}-${e.target}`,
    type: 'animatedDataEdge',
    data: { color: '#38bdf8', speed: '3s', speedOffset: '1.5s' } // Defaults, could be inferred properly
  }));
  
  // Try to find the node label
  const getNodeLabel = (nodeId: string) => {
    const node = data.nodes.find((n: any) => n.id === nodeId);
    return node?.type || nodeId;
  };

  return (
    <div className="h-screen w-full flex flex-col bg-surface-950">
      <header className="h-14 border-b border-white/[0.06] bg-surface-900/50 backdrop-blur flex items-center justify-between px-6 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center">
            <span className="text-white font-black text-sm tracking-tighter">OS</span>
          </div>
          <span className="font-bold text-surface-100">OpenStats</span>
          <span className="px-2 py-0.5 rounded-full bg-accent-500/10 text-accent-400 text-[10px] font-bold uppercase tracking-widest border border-accent-500/20">Read-Only</span>
        </div>
        <Link to="/" className="text-sm font-semibold text-surface-400 hover:text-white transition-colors">
          Créer votre propre analyse
        </Link>
      </header>

      <div className="flex-1 relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes as any}
            edgeTypes={edgeTypes as any}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            onNodeClick={(event, node) => {
               if (data.results && data.results[node.id]) {
                 setSelectedResultNode({
                   id: node.id,
                   type: node.type || '',
                   title: getNodeLabel(node.id),
                   result: data.results[node.id].result
                 });
               }
            }}
            className="bg-surface-950"
          >
            <Background color="#1e293b" gap={24} size={1.5} />
            <Controls showInteractive={false} className="!bg-surface-800/90 !border !border-white/[0.08] !rounded-xl !shadow-2xl [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-surface-300 [&>button:hover]:!bg-white/10 [&>button]:!rounded-lg" />
            <MiniMap
              nodeStrokeColor="#ffffff"
              nodeColor="#0f172a"
              maskColor="rgba(15,23,42,0.6)"
              className="!bg-surface-900/90 !border !border-white/[0.1] !rounded-xl !shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden backdrop-blur-md"
              style={{ right: 20, bottom: 20 }}
            />
          </ReactFlow>
        </ReactFlowProvider>
        
        {/* Results Panel overlay */}
        {data.results && (
          <div className="absolute top-4 right-4 w-[320px] max-h-[calc(100vh-100px)] overflow-auto z-20 rounded-2xl border border-white/[0.08] bg-surface-900/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] pointer-events-auto">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-bold text-surface-100 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Pipeline Complété
              </h3>
              <p className="text-[11px] text-surface-400 mt-1">Cliquez sur un nœud ou utilisez les boutons ci-dessous pour voir les résultats.</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(data.results).filter(([k]) => k !== '_global').map(([nodeId, res]: [string, any]) => {
                if (!res || res.status !== 'success' || res.result === undefined) return null;
                return (
                  <div key={nodeId} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                    <span className="text-xs font-bold text-surface-200">{getNodeLabel(nodeId)}</span>
                    <button
                      onClick={() => setSelectedResultNode({
                        id: nodeId,
                        type: data.nodes.find((n:any) => n.id === nodeId)?.type || '',
                        title: getNodeLabel(nodeId),
                        result: res.result
                      })}
                      className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1.5 rounded bg-accent-500/10 text-accent-400 hover:bg-accent-500 hover:text-white transition-colors"
                    >
                      Voir
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
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
