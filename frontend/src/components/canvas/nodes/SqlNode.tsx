import { NodeProps, Node } from '@xyflow/react';
import { Database } from 'lucide-react';
import { CanvasNodeData, NodeShell, useNodeUpdate } from './_shared';

export function SqlNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const update = useNodeUpdate(id, data);

  return (
    <NodeShell
      id={id}
      data={data}
      color="#3b82f6" // blue-500
      icon={Database}
      title="Requête SQL (DuckDB)"
      hasInput
      hasOutput
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1">Requête SQL</label>
          <p className="text-[10px] text-surface-500 mb-2">
            La table source s'appelle toujours <code>df</code>.
            Exemple: <code>SELECT * FROM df WHERE age &gt; 18</code>
          </p>
          <textarea
            name="query"
            value={(data.query as string) || ''}
            onChange={update}
            placeholder="SELECT * FROM df..."
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400/50 font-mono"
            rows={4}
          />
        </div>
      </div>
    </NodeShell>
  );
}
