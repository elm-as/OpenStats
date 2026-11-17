import { CheckCircle2 } from 'lucide-react';

interface SharedResultsPanelProps {
  nodes: Array<{ id: string; type?: string }>;
  results: Record<string, any>;
  getNodeLabel: (nodeId: string) => string;
  onSelectResult: (node: { id: string; type: string; title: string; result: any }) => void;
}

export function SharedResultsPanel(props: SharedResultsPanelProps) {
  const { nodes, results, getNodeLabel, onSelectResult } = props;
  const entries = Object.entries(results).filter(([k]) => k !== '_global');
  if (entries.length === 0) return null;

  return (
    <aside
      className="ui-panel w-72 shrink-0 h-full overflow-auto ui-scroll flex flex-col"
      style={{
        borderRadius: 0,
        borderTop: 'none',
        borderBottom: 'none',
        borderRight: 'none',
      }}
    >
      <div
        className="px-3.5 py-2.5 flex items-center gap-2 shrink-0"
        style={{ borderBottom: '1px solid var(--ui-border)', background: 'var(--ui-bg-raised)' }}
      >
        <CheckCircle2 className="w-3.5 h-3.5 ui-t-success shrink-0" />
        <span className="text-xs font-bold ui-t">Résultats ({entries.length})</span>
      </div>
      <div className="divide-y divide-[var(--ui-border)]">
        {entries.map(([nodeId, res]: [string, any]) => {
          if (!res || res.status !== 'success' || res.result === undefined) return null;
          return (
            <div key={nodeId} className="px-3.5 py-2 flex items-center justify-between hover:bg-[var(--ui-bg-raised)]">
              <span className="text-xs font-medium ui-t truncate">{getNodeLabel(nodeId)}</span>
              <button
                onClick={() =>
                  onSelectResult({
                    id: nodeId,
                    type: nodes.find(n => n.id === nodeId)?.type || '',
                    title: getNodeLabel(nodeId),
                    result: res.result,
                  })
                }
                className="ui-btn text-[11px] h-7 shrink-0"
              >
                Voir
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
