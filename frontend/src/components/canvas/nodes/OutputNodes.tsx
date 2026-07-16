import { NodeProps, Node } from '@xyflow/react';
import { Brain, Sparkles, Zap, FileOutput } from 'lucide-react';
import { CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeInput, useNodeUpdate } from './_shared';

export function AINode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#a855f7" icon={Brain} title="Assistant IA" hasInput>
      <div>
        <NodeLabel>Prompt d'instruction</NodeLabel>
        <NodeInput name="prompt" placeholder="Analyser les tendances..." value={(data.prompt as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

export function ExtensionNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#a855f7" icon={Sparkles} title="Extension IA (script)" hasInput>
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Script Python personnalisé généré par l'IA pour un besoin spécifique.
      </div>
      <div>
        <NodeLabel>Instruction</NodeLabel>
        <NodeInput name="prompt" placeholder="Calculer un indice de Gini..." value={(data.prompt as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

export function InsightsNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#a855f7" icon={Zap} title="Insights narratifs" hasInput badge="IA">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Transforme les résultats numériques en interprétations actionnables hiérarchisées par sévérité.
      </div>
    </NodeShell>
  );
}

export function OutputNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={FileOutput} title="Rapport / Export" hasInput hasOutput={false}>
      <div>
        <NodeLabel>Format de sortie</NodeLabel>
        <NodeSelect name="format" value={(data.format as string) || 'pdf'} onChange={handleChange}>
          <option value="pdf">Document PDF</option>
          <option value="docx">Document Word (DOCX)</option>
          <option value="pptx">Présentation PowerPoint</option>
          <option value="html">Rapport HTML interactif</option>
          <option value="csv">Export CSV</option>
        </NodeSelect>
      </div>
    </NodeShell>
  );
}
