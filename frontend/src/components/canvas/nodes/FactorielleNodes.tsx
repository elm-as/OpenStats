import { NodeProps, Node } from '@xyflow/react';
import { Layers, Grid3X3, Radar } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect, 
  useNodeUpdate, useConnectedColumns, NodeColumnSelect 
} from './_shared';

export function PCANode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#06b6d4" icon={Layers} title="ACP" hasInput badge="Factoriel">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Analyse en Composantes Principales : valeurs propres, cercle des corrélations, biplot.
      </div>
      <div>
        <NodeLabel>Nb composantes</NodeLabel>
        <NodeSelect name="nComponents" value={(data.nComponents as string) || 'auto'} onChange={handleChange}>
          <option value="auto">Auto (Kaiser)</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="5">5</option>
        </NodeSelect>
      </div>
    </NodeShell>
  );
}

export function CANode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  
  return (
    <NodeShell id={id} data={data} color="#06b6d4" icon={Grid3X3} title="AFC" hasInput badge="Factoriel">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Analyse Factorielle des Correspondances (tableau de contingence).
      </div>
      <div>
        <NodeLabel>Variable en ligne</NodeLabel>
        <NodeColumnSelect name="rowCol" placeholder="-- Variable Ligne --" value={(data.rowCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable en colonne</NodeLabel>
        <NodeColumnSelect name="colCol" placeholder="-- Variable Colonne --" value={(data.colCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}

export function MCANode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#06b6d4" icon={Layers} title="ACM" hasInput badge="Factoriel">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Analyse des Correspondances Multiples. Nuage des modalités, η², contributions.
      </div>
    </NodeShell>
  );
}

export function ClusteringNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#06b6d4" icon={Radar} title="Clustering" hasInput badge="Non-supervisé">
      <div>
        <NodeLabel>Algorithme</NodeLabel>
        <NodeSelect name="method" value={(data.method as string) || 'kmeans'} onChange={handleChange}>
          <option value="kmeans">K-Means</option>
          <option value="dbscan">DBSCAN</option>
          <option value="hierarchical">CAH (Hiérarchique)</option>
        </NodeSelect>
      </div>
    </NodeShell>
  );
}
