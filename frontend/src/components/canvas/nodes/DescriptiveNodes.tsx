import { NodeProps, Node } from '@xyflow/react';
import { BarChart2, PieChart, TrendingUp, AlertTriangle } from 'lucide-react';
import { CanvasNodeData, NodeShell, NodeLabel, NodeSelect, useNodeUpdate } from './_shared';

export function DescriptiveNumericNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#10b981" icon={BarChart2} title="Stats descriptives (numériques)" hasInput badge="Descriptif">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Moyenne, médiane, écart-type, asymétrie (skewness), kurtosis, quartiles.
      </div>
    </NodeShell>
  );
}

export function DescriptiveCategoricalNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#14b8a6" icon={PieChart} title="Stats descriptives (catégorielles)" hasInput badge="Descriptif">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Mode, fréquences, cardinalité, distribution des modalités.
      </div>
    </NodeShell>
  );
}

export function CorrelationNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#3b82f6" icon={TrendingUp} title="Matrice de corrélation" hasInput>
      <div>
        <NodeLabel>Méthode</NodeLabel>
        <NodeSelect name="method" value={(data.method as string) || 'pearson'} onChange={handleChange}>
          <option value="pearson">Pearson (linéaire, suppose normalité)</option>
          <option value="spearman">Spearman (rang, non-paramétrique)</option>
        </NodeSelect>
      </div>
    </NodeShell>
  );
}

export function VIFNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#f97316" icon={AlertTriangle} title="VIF (Multicolinéarité)" hasInput badge="Diagnostic">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Détection du Facteur d'Inflation de la Variance entre les variables explicatives. Seuil &gt; 5 = critique.
      </div>
    </NodeShell>
  );
}

export function BootstrapNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#a855f7" icon={TrendingUp} title="Bootstrap IC (0.95)" hasInput badge="Inférence">
      <div className="space-y-2">
        <div>
          <NodeLabel>Statistique</NodeLabel>
          <NodeSelect name="statistic" value={(data.statistic as string) || 'mean'} onChange={handleChange}>
            <option value="mean">Moyenne</option>
            <option value="median">Médiane</option>
            <option value="std">Écart-type</option>
          </NodeSelect>
        </div>
      </div>
    </NodeShell>
  );
}

export function OutliersNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#f97316" icon={AlertTriangle} title="Détection d'Anomalies" hasInput badge="Outliers">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Algorithme Isolation Forest pour identifier les observations aberrantes ou multidimensionnellement atypiques.
      </div>
    </NodeShell>
  );
}
