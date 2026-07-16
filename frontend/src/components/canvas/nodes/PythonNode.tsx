import { NodeProps, Node } from '@xyflow/react';
import { TerminalSquare } from 'lucide-react';
import { CanvasNodeData, NodeShell, useNodeUpdate } from './_shared';

export function PythonNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const update = useNodeUpdate(id, data);

  return (
    <NodeShell
      id={id}
      data={data}
      color="#f59e0b" // amber-500
      icon={TerminalSquare}
      title="Code Python Hybride"
      hasInput
      hasOutput
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-surface-400 mb-1">Script Python</label>
          <p className="text-[10px] text-surface-500 mb-2">
            La DataFrame en entrée est nommée <code>df</code>.
            Modifiez ou assignez <code>df</code> (ex: <code>df['new_col'] = df['col1'] * 2</code>).
            Les bibliothèques <code>pd</code> et <code>np</code> sont disponibles.
          </p>
          <textarea
            name="code"
            value={(data.code as string) || ''}
            onChange={update}
            placeholder="df['nouvelle_colonne'] = df['A'] + df['B']"
            className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:outline-none focus:border-accent-400 focus:ring-1 focus:ring-accent-400/50 font-mono"
            rows={5}
          />
        </div>
      </div>
    </NodeShell>
  );
}
