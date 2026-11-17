import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ReactFlow, ReactFlowProvider, Background, MiniMap, Controls, Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, AlertCircle, Home } from 'lucide-react';
import { nodeTypes, edgeTypes } from '../components/canvas/CanvasFlow';
import CanvasResultModal from '../components/canvas/CanvasResultModal';
import { SharedResultsPanel } from '../components/canvas/SharedResultsPanel';
import { apiFetch } from '../lib/apiBase';

export default function SharedCanvasPage() {
  const { shareId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [selectedResultNode, setSelectedResultNode] = useState<{ id: string; type: string; title: string; result: any } | null>(null);

  useEffect(() => {
    async function fetchShared() {
      try {
        const res = await apiFetch(`/canvas/share/${shareId}`);
        const result = await res.json();
        if (result.success) setData(result.data);
        else setError(result.error || 'Impossible de charger ce lien partagé.');
      } catch {
        setError('Erreur réseau. Impossible de contacter le serveur.');
      } finally {
        setLoading(false);
      }
    }
    fetchShared();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center ui-t-muted" style={{ background: 'var(--ui-bg-app)' }}>
        <Loader2 className="animate-spin mb-3 ui-t-accent w-6 h-6" />
        <p className="text-xs">Chargement du workflow partagé…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 ui-t-muted" style={{ background: 'var(--ui-bg-app)' }}>
        <AlertCircle className="ui-t-danger mb-3 w-8 h-8" />
        <h2 className="text-base font-bold ui-t mb-1">Lien introuvable</h2>
        <p className="text-xs mb-4">{error}</p>
        <Link to="/" className="ui-btn ui-focusable">
          <Home className="w-4 h-4" /> Retour à l’accueil
        </Link>
      </div>
    );
  }

  const nodes: Node[] = data.nodes.map((n: any) => {
    const nodeRes = data.results && data.results[n.id];
    return {
      ...n,
      data: { ...n.data, runStatus: nodeRes?.status || 'success' },
      draggable: false,
      selectable: true,
    };
  });

  const edges: Edge[] = data.edges.map((e: any) => ({
    ...e,
    id: `e-${e.source}-${e.target}`,
    type: 'animatedDataEdge',
    data: { color: '#22b8cf', speed: '3s', speedOffset: '1.5s' },
  }));

  const getNodeLabel = (nodeId: string) => {
    const node = data.nodes.find((n: any) => n.id === nodeId);
    return node?.type || nodeId;
  };

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: 'var(--ui-bg-app)', color: 'var(--ui-text)' }}>
      <header
        className="h-11 flex items-center justify-between px-4 z-10 shrink-0"
        style={{ background: 'var(--ui-bg-panel)', borderBottom: '1px solid var(--ui-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-xs ui-t">OpenStats Studio</span>
          <span className="ui-tag ui-tag-accent uppercase">Lecture seule</span>
        </div>
        <Link to="/" className="ui-btn ui-focusable text-xs">
          Ouvrir l'espace de travail
        </Link>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 min-w-0 relative">
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes as any}
              edgeTypes={edgeTypes as any}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              onNodeClick={(_event, node) => {
                if (data.results && data.results[node.id]) {
                  setSelectedResultNode({
                    id: node.id,
                    type: node.type || '',
                    title: getNodeLabel(node.id),
                    result: data.results[node.id].result,
                  });
                }
              }}
              style={{ background: 'var(--ui-bg-app)' }}
            >
              <Background color="var(--ui-border-strong)" gap={24} size={1.2} />
              <Controls showInteractive={false} />
              <MiniMap maskColor="rgba(15,23,42,0.45)" style={{ right: 16, bottom: 16 }} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {data.results && (
          <SharedResultsPanel
            nodes={data.nodes}
            results={data.results}
            getNodeLabel={getNodeLabel}
            onSelectResult={setSelectedResultNode}
          />
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
