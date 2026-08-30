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

export function HierarchicalClusteringNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const method = (data.method as string) || 'ward';

  return (
    <NodeShell id={id} data={data} color="#0ea5e9" icon={Radar} title="Clustering Hiérarchique (CAH)" hasInput badge="Dendrogramme">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Construction de la matrice de liaison, tracé du dendrogramme et découpage en clusters.
      </div>
      <div>
        <NodeLabel>Nombre de clusters (k)</NodeLabel>
        <NodeSelect name="k" value={String(data.k || 3)} onChange={handleChange}>
          <option value="2">2 clusters</option>
          <option value="3">3 clusters</option>
          <option value="4">4 clusters</option>
          <option value="5">5 clusters</option>
          <option value="6">6 clusters</option>
          <option value="7">7 clusters</option>
          <option value="8">8 clusters</option>
        </NodeSelect>
      </div>
      <div>
        <NodeLabel>Méthode d'agrégation</NodeLabel>
        <NodeSelect name="method" value={method} onChange={handleChange}>
          <option value="ward">Ward (variance minimale)</option>
          <option value="complete">Liaison complète (distance max)</option>
          <option value="average">Liaison moyenne (UPGMA)</option>
          <option value="single">Liaison simple (distance min)</option>
        </NodeSelect>
      </div>
      {method !== 'ward' && (
        <div>
          <NodeLabel>Métrique de distance</NodeLabel>
          <NodeSelect name="metric" value={(data.metric as string) || 'euclidean'} onChange={handleChange}>
            <option value="euclidean">Euclidienne</option>
            <option value="cityblock">Manhattan / Cityblock</option>
            <option value="cosine">Cosinus</option>
          </NodeSelect>
        </div>
      )}
    </NodeShell>
  );
}

