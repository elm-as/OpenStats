import { NodeProps, Node } from '@xyflow/react';
import { FileBarChart } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect,
  useNodeUpdate, useConnectedColumns, NodeColumnSelect, NodeMultiColumnInput 
} from './_shared';

const CHART_TYPES = [
  { value: 'auto', label: 'Auto (selon les donnees)' },
  { value: 'scatter', label: 'Nuage de points' },
  { value: 'bubble', label: 'Bulle (Bubble chart)' },
  { value: 'bar', label: 'Diagramme a barres' },
  { value: 'line', label: 'Courbe d\'evolution' },
  { value: 'multi_line', label: 'Courbes multiples (series combinees)' },
  { value: 'pie', label: 'Camembert' },
  { value: 'boxplot', label: 'Boite a moustaches' },
  { value: 'histogram', label: 'Histogramme' },
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'stacked_bar', label: 'Barres empilees' },
  { value: 'radar', label: 'Radar (Toile d\'araignee)' },
] as const;

export function VisualizationNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const chartType = (data.chartType as string) || 'auto';

  const needsMultiY = chartType === 'multi_line' || chartType === 'stacked_bar' || chartType === 'radar';
  const needsSingleY = chartType === 'scatter' || chartType === 'bubble' || chartType === 'bar' || chartType === 'line' || chartType === 'boxplot' || chartType === 'histogram' || chartType === 'heatmap';
  const needsNoAxes = chartType === 'pie' || chartType === 'auto';

  return (
    <NodeShell id={id} data={data} color="#14b8a6" icon={FileBarChart} title="Visualisation" hasInput>
      <div>
        <NodeLabel>Type de graphique</NodeLabel>
        <NodeSelect name="chartType" value={chartType} onChange={handleChange}>
          {CHART_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </NodeSelect>
      </div>

      <div>
        <NodeLabel>Titre (optionnel)</NodeLabel>
        <input
          className="w-full bg-[#0b1121] border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 outline-none focus:border-cyan-500 transition-colors placeholder-gray-600"
          name="title"
          placeholder="Titre du graphique..."
          value={(data.title as string) || ''}
          onChange={handleChange}
        />
      </div>

      {needsMultiY && (
        <div>
          <NodeLabel>Variables Y (series superposees)</NodeLabel>
          <NodeMultiColumnInput
            name="yCols"
            placeholder="Selectionner les colonnes..."
            value={(data.yCols as string) || ''}
            onChange={handleChange}
            columns={columns}
          />
        </div>
      )}

      {needsSingleY && (
        <div>
          <NodeLabel>Axe Y</NodeLabel>
          <NodeColumnSelect
            name="yCol"
            placeholder="-- Variable Y --"
            value={(data.yCol as string) || ''}
            onChange={handleChange}
            columns={columns}
          />
        </div>
      )}

      {(needsSingleY || needsMultiY) && (
        <div>
          <NodeLabel>Axe X</NodeLabel>
          <NodeColumnSelect
            name="xCol"
            placeholder="-- Variable X (optionnel) --"
            value={(data.xCol as string) || ''}
            onChange={handleChange}
            columns={columns}
          />
        </div>
      )}

      {(chartType === 'scatter' || chartType === 'bubble' || chartType === 'bar' || chartType === 'line' || chartType === 'heatmap') && (
        <div>
          <NodeLabel>Couleur / Grouper par</NodeLabel>
          <NodeColumnSelect
            name="colorCol"
            placeholder="-- Variable Couleur --"
            value={(data.colorCol as string) || ''}
            onChange={handleChange}
            columns={columns}
          />
        </div>
      )}

      {chartType === 'bubble' && (
        <div>
          <NodeLabel>Taille des bulles</NodeLabel>
          <NodeColumnSelect
            name="sizeCol"
            placeholder="-- Variable Taille --"
            value={(data.sizeCol as string) || ''}
            onChange={handleChange}
            columns={columns}
          />
        </div>
      )}

      {(chartType === 'bar' || chartType === 'pie' || chartType === 'radar') && (
        <div>
          <NodeLabel>Limite (Top N)</NodeLabel>
          <NodeSelect name="topN" value={(data.topN as string) || '20'} onChange={handleChange}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="0">Tout</option>
          </NodeSelect>
        </div>
      )}

      <div>
        <NodeLabel>Agregation</NodeLabel>
        <NodeSelect name="aggregation" value={(data.aggregation as string) || 'none'} onChange={handleChange}>
          <option value="none">Aucune (donnees brutes)</option>
          <option value="mean">Moyenne</option>
          <option value="sum">Somme</option>
          <option value="count">Comptage</option>
          <option value="median">Mediane</option>
        </NodeSelect>
      </div>

      <div className="flex items-center space-x-2 mt-2">
        <input
          type="checkbox"
          id={`logScale-${id}`}
          name="logScale"
          checked={!!data.logScale}
          onChange={(e) => {
            const event = {
              target: { name: 'logScale', value: e.target.checked }
            } as any;
            handleChange(event);
          }}
          className="rounded border-gray-600 bg-[#0b1121] text-cyan-500 focus:ring-cyan-500"
        />
        <label htmlFor={`logScale-${id}`} className="text-xs text-gray-400 cursor-pointer">
          Echelle logarithmique (Axe Y)
        </label>
      </div>
    </NodeShell>
  );
}
