import React from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Activity, TrendingUp, Layers, GitCompare } from 'lucide-react';
import {
  NodeShell,
  NodeLabel,
  NodeColumnSelect,
  NodeSelect,
  CanvasNodeData,
  useNodeUpdate,
  useConnectedColumns,
} from './_shared';

export function SurvivalNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#ec4899" icon={Activity} title="Analyse de Survie (Kaplan-Meier)" hasInput badge="Survie">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Estimation de la courbe de survie et modèle de Cox à risques proportionnels.
      </div>
      <div>
        <NodeLabel>Variable de Temps/Durée</NodeLabel>
        <NodeColumnSelect name="durationCol" placeholder="-- Durée --" value={(data.durationCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Marqueur d'Événement (0/1)</NodeLabel>
        <NodeColumnSelect name="eventCol" placeholder="-- Événement binaire --" value={(data.eventCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}

export function CausalNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#06b6d4" icon={GitCompare} title="Inférence Causale (DiD / 2SLS)" hasInput badge="Causal">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Attribution causale du traitement (Diff-in-Diff) et variables instrumentales (2SLS).
      </div>
      <div>
        <NodeLabel>Méthode d'Inférence</NodeLabel>
        <NodeSelect name="method" value={(data.method as string) || 'did'} onChange={handleChange}>
          <option value="did">Diff-in-Diff (DiD)</option>
          <option value="iv2sls">Variables Instrumentales (2SLS)</option>
        </NodeSelect>
      </div>
      <div>
        <NodeLabel>Variable Traitement (0/1)</NodeLabel>
        <NodeColumnSelect name="treatmentCol" placeholder="-- Traitement --" value={(data.treatmentCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable Résultat (Y)</NodeLabel>
        <NodeColumnSelect name="outcomeCol" placeholder="-- Outcome Y --" value={(data.outcomeCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}

export function ManifoldNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  return (
    <NodeShell id={id} data={data} color="#8b5cf6" icon={Layers} title="Projection t-SNE & DBSCAN" hasInput badge="Manifold">
      <div className="text-surface-400 text-[11px] leading-relaxed">
        Réduction non-linéaire de dimension t-SNE 2D combinée avec clustering par densité DBSCAN.
      </div>
    </NodeShell>
  );
}

export function GarchNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#f59e0b" icon={TrendingUp} title="Volatilité GARCH(1,1)" hasInput badge="Volatilité">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Modélisation de la variance conditionnelle temporelle de séries financières ou hautement volatiles.
      </div>
      <div>
        <NodeLabel>Série numérique</NodeLabel>
        <NodeColumnSelect name="valueCol" placeholder="-- Variable --" value={(data.valueCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}
