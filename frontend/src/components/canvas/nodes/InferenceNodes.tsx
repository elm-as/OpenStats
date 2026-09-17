import React from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Stethoscope, Gauge, SlidersHorizontal, Equal, Hash } from 'lucide-react';
import {
  NodeShell,
  NodeLabel,
  NodeInput,
  NodeColumnSelect,
  CanvasNodeData,
  useNodeUpdate,
  useConnectedColumns,
} from './_shared';

/** Régression de comptage : Poisson, binomiale négative si surdispersion. */
export function CountModelNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#14b8a6" icon={Hash} title="Modèle de Comptage" hasInput badge="Poisson">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Pour une cible de dénombrement. Teste la surdispersion et bascule en binomiale négative
        si la variance dépasse la moyenne.
      </div>
      <div>
        <NodeLabel>Cible (comptage)</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- auto --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Covariables (virgules)</NodeLabel>
        <NodeInput name="covariates" placeholder="-- toutes --" value={(data.covariates as string) || ''} onChange={handleChange} />
      </div>
      <div>
        <NodeLabel>Exposition (optionnel)</NodeLabel>
        <NodeColumnSelect name="exposureCol" placeholder="-- aucune --" value={(data.exposureCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}

/** Vérifie les hypothèses d'une régression au lieu de les supposer. */
export function RegressionDiagnosticsNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={Stethoscope} title="Diagnostics de Régression" hasInput badge="Hypothèses">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Breusch-Pagan, Jarque-Bera, Ljung-Box, RESET de Ramsey et Durbin-Watson : chaque
        hypothèse en défaut est signalée avec sa conséquence.
      </div>
      <div>
        <NodeLabel>Cible</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- auto --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variables explicatives (virgules)</NodeLabel>
        <NodeInput name="featureCols" placeholder="-- toutes --" value={(data.featureCols as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

/** Puissance atteinte et plus petit effet détectable. */
export function PowerAnalysisNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#f59e0b" icon={Gauge} title="Puissance Statistique" hasInput badge="Puissance">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        « Non significatif » peut vouloir dire « échantillon trop petit ». Donne la puissance
        atteinte, l'effet minimal détectable et la taille requise.
      </div>
      <div>
        <NodeLabel>Groupe (2 modalités)</NodeLabel>
        <NodeColumnSelect name="groupCol" placeholder="-- auto --" value={(data.groupCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable mesurée</NodeLabel>
        <NodeColumnSelect name="valueCol" placeholder="-- auto --" value={(data.valueCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Puissance visée</NodeLabel>
        <NodeInput name="targetPower" placeholder="0.80" value={(data.targetPower as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

/** Effet selon le quantile de la cible, pas seulement sur la moyenne. */
export function QuantileRegressionNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#8b5cf6" icon={SlidersHorizontal} title="Régression Quantile" hasInput badge="Quantiles">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Un effet peut être nul au centre et fort dans les queues. Compare les coefficients
        d'un quantile à l'autre.
      </div>
      <div>
        <NodeLabel>Cible</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- auto --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variables explicatives (virgules)</NodeLabel>
        <NodeInput name="featureCols" placeholder="-- toutes --" value={(data.featureCols as string) || ''} onChange={handleChange} />
      </div>
      <div>
        <NodeLabel>Quantiles</NodeLabel>
        <NodeInput name="quantiles" placeholder="0.1, 0.25, 0.5, 0.75, 0.9" value={(data.quantiles as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}

/** TOST : démontrer une absence d'effet, pas seulement ne pas en trouver. */
export function EquivalenceTestNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#10b981" icon={Equal} title="Test d'Équivalence (TOST)" hasInput badge="Équivalence">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Un p &gt; 0,05 ne prouve pas l'absence d'effet. Le TOST teste si l'écart tient dans
        une marge que vous jugez négligeable.
      </div>
      <div>
        <NodeLabel>Groupe (2 modalités)</NodeLabel>
        <NodeColumnSelect name="groupCol" placeholder="-- auto --" value={(data.groupCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable mesurée</NodeLabel>
        <NodeColumnSelect name="valueCol" placeholder="-- auto --" value={(data.valueCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Marge d'équivalence (unités)</NodeLabel>
        <NodeInput name="margin" placeholder="-- 0,2 écart-type --" value={(data.margin as string) || ''} onChange={handleChange} />
      </div>
    </NodeShell>
  );
}
