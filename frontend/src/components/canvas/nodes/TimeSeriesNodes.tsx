import { NodeProps, Node } from '@xyflow/react';
import { LineChart, Shuffle } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeNumberInput,
  useNodeUpdate, useConnectedColumns, NodeColumnSelect, NodeMultiColumnInput,
  NodeToggle, NodeCollapsible, NodeSeedInput
} from './_shared';

export function TimeSeriesNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';
  
  return (
    <NodeShell id={id} data={data} color="#f59e0b" icon={LineChart} title="Séries temporelles" hasInput>
      <div>
        <NodeLabel>Colonne date</NodeLabel>
        <NodeColumnSelect name="dateCol" placeholder="-- Variable Date --" value={(data.dateCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable à prédire</NodeLabel>
        <NodeColumnSelect name="valueCol" placeholder="-- Variable à prédire --" value={(data.valueCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Modèle</NodeLabel>
        <NodeSelect name="model" value={(data.model as string) || 'auto'} onChange={handleChange}>
          <option value="auto">Auto (meilleur modèle)</option>
          <option value="arima">ARIMA</option>
          <option value="sarima">SARIMA</option>
          <option value="holt">Holt-Winters</option>
          <option value="naive">Naïve (baseline)</option>
        </NodeSelect>
      </div>
      <div>
        <NodeLabel>Horizon de prévision</NodeLabel>
        <NodeSelect name="forecastSteps" value={(data.forecastSteps as string) || '10'} onChange={handleChange}>
          <option value="5">5 pas</option>
          <option value="10">10 pas</option>
          <option value="20">20 pas</option>
          <option value="30">30 pas</option>
          <option value="50">50 pas</option>
        </NodeSelect>
      </div>
      <div className="flex items-center justify-between pt-1">
        <NodeToggle value={mode} onChange={handleChange} />
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? 'Paramétrable' : 'Défauts optimaux'}
        </span>
      </div>
      {isAdvanced && (
        <NodeCollapsible title="Paramètres avancés" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Ordre AR (p)</NodeLabel>
              <NodeNumberInput name="arOrder" placeholder="auto" value={(data.arOrder as string) || ''} onChange={handleChange} min={0} max={20} />
            </div>
            <div>
              <NodeLabel>Ordre I (d)</NodeLabel>
              <NodeNumberInput name="diffOrder" placeholder="auto" value={(data.diffOrder as string) || ''} onChange={handleChange} min={0} max={3} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Ordre MA (q)</NodeLabel>
              <NodeNumberInput name="maOrder" placeholder="auto" value={(data.maOrder as string) || ''} onChange={handleChange} min={0} max={20} />
            </div>
            <div>
              <NodeLabel>Période saisonnière</NodeLabel>
              <NodeNumberInput name="seasonalPeriod" placeholder="auto" value={(data.seasonalPeriod as string) || ''} onChange={handleChange} min={0} max={365} />
            </div>
          </div>
          <div>
            <NodeLabel>Niveau de confiance (%)</NodeLabel>
            <NodeNumberInput name="confidenceLevel" placeholder="95" value={(data.confidenceLevel as string) || ''} onChange={handleChange} min={50} max={99} />
          </div>
          <NodeSeedInput value={(data.seed as string) || ''} onChange={handleChange} />
        </NodeCollapsible>
      )}
    </NodeShell>
  );
}

export function MultivariateTimeSeriesNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';
  
  return (
    <NodeShell id={id} data={data} color="#f59e0b" icon={Shuffle} title="Séries temporelles multivariées" hasInput>
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        VAR / VECM / BVAR, causalité de Granger, cointégration, IRF, FEVD.
      </div>
      <div>
        <NodeLabel>Colonne date</NodeLabel>
        <NodeColumnSelect name="dateCol" placeholder="-- Variable Date --" value={(data.dateCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variables (séparées par virgule)</NodeLabel>
        <NodeMultiColumnInput name="valueCols" placeholder="ex: GDP, Inflation, Rate" value={(data.valueCols as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Variable cible (optionnel)</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- Variable cible (optionnel) --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Modèle</NodeLabel>
        <NodeSelect name="forcedModel" value={(data.forcedModel as string) || 'auto'} onChange={handleChange}>
          <option value="auto">Auto (meilleur)</option>
          <option value="var">VAR</option>
          <option value="vecm">VECM (cointégration)</option>
          <option value="bvar">BVAR (bayésien)</option>
          <option value="ardl">ARDL</option>
          <option value="pairwise_var">VAR par paires</option>
          <option value="varmax">VARMAX</option>
        </NodeSelect>
      </div>
      <div>
        <NodeLabel>Horizon de prévision</NodeLabel>
        <NodeSelect name="forecastSteps" value={(data.forecastSteps as string) || '10'} onChange={handleChange}>
          <option value="5">5 pas</option>
          <option value="10">10 pas</option>
          <option value="20">20 pas</option>
          <option value="30">30 pas</option>
        </NodeSelect>
      </div>
      <div className="flex items-center justify-between pt-1">
        <NodeToggle value={mode} onChange={handleChange} />
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? 'Paramétrable' : 'Défauts optimaux'}
        </span>
      </div>
      {isAdvanced && (
        <NodeCollapsible title="Paramètres avancés" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Max Lag</NodeLabel>
              <NodeNumberInput name="maxLag" placeholder="auto" value={(data.maxLag as string) || ''} onChange={handleChange} min={1} max={24} />
            </div>
            <div>
              <NodeLabel>IC criterion</NodeLabel>
              <NodeSelect name="icCriterion" value={(data.icCriterion as string) || 'aic'} onChange={handleChange}>
                <option value="aic">AIC</option>
                <option value="bic">BIC</option>
                <option value="hqic">HQIC</option>
                <option value="fpe">FPE</option>
              </NodeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Périodes IRF</NodeLabel>
              <NodeNumberInput name="irfPeriods" placeholder="10" value={(data.irfPeriods as string) || ''} onChange={handleChange} min={1} max={100} />
            </div>
            <div>
              <NodeLabel>Granger Max Lag</NodeLabel>
              <NodeNumberInput name="grangerMaxLag" placeholder="4" value={(data.grangerMaxLag as string) || ''} onChange={handleChange} min={1} max={24} />
            </div>
          </div>
          <div>
            <NodeLabel>Régime VAR</NodeLabel>
            <NodeSelect name="varDataMode" value={(data.varDataMode as string) || 'auto'} onChange={handleChange}>
              <option value="auto">Auto (selon stationnarité)</option>
              <option value="levels">Niveaux</option>
              <option value="diff">Différencié</option>
            </NodeSelect>
          </div>
          <div>
            <NodeLabel>Niveau de confiance (%)</NodeLabel>
            <NodeNumberInput name="confidenceLevel" placeholder="95" value={(data.confidenceLevel as string) || ''} onChange={handleChange} min={50} max={99} />
          </div>
          <div>
            <NodeLabel>Bootstrap IRF</NodeLabel>
            <NodeSelect name="bootstrapIrf" value={(data.bootstrapIrf as string) || 'false'} onChange={handleChange}>
              <option value="false">Non (analytique)</option>
              <option value="true">Oui (bootstrap)</option>
            </NodeSelect>
          </div>
          <NodeSeedInput value={(data.seed as string) || ''} onChange={handleChange} />
        </NodeCollapsible>
      )}
    </NodeShell>
  );
}
