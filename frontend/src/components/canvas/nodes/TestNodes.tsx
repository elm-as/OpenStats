import { NodeProps, Node } from '@xyflow/react';
import { GitCompare, Link2, Grid3X3, Activity } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, 
  useNodeUpdate, useConnectedColumns, NodeColumnSelect, NodeMultiColumnInput 
} from './_shared';

function isNumericType(t: string): boolean {
  const n = (t || '').toLowerCase();
  return n === 'numerique' || n === 'continu' || n === 'discret' || /^(float|int)\d*$/.test(n);
}

function isCategoricalType(t: string): boolean {
  const n = (t || '').toLowerCase();
  return n === 'categoriel' || n === 'catégoriel_nominal' || n === 'binaire' || n === 'object' || n === 'category' || n === 'string';
}

export function TestCompareMeansNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns, columnTypes } = useConnectedColumns(id);
  const numericCols = columns.filter(c => isNumericType(columnTypes[c] || ''));
  
  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={GitCompare} title="Comparaison de moyennes" hasInput badge="Test">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        T-test / Mann-Whitney / ANOVA / Kruskal-Wallis (sélection automatique).
      </div>
      <div className="text-[9px] text-surface-600 bg-black/20 rounded px-2 py-1 mb-3">
        Prérequis : 1 variable de groupement + 1 variable numérique
      </div>
      <div>
        <NodeLabel>Variable de groupement</NodeLabel>
        <NodeColumnSelect name="groupCol" placeholder="-- Variable groupe --" value={(data.groupCol as string) || ''} onChange={handleChange} columns={columns} columnTypes={columnTypes} />
      </div>
      <div>
        <NodeLabel>Variable numérique</NodeLabel>
        <NodeColumnSelect name="valueCol" placeholder="-- Variable valeur --" value={(data.valueCol as string) || ''} onChange={handleChange} columns={numericCols} columnTypes={columnTypes} />
      </div>
    </NodeShell>
  );
}

export function TestCorrelationNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns, columnTypes } = useConnectedColumns(id);
  const numericCols = columns.filter(c => isNumericType(columnTypes[c] || ''));
  
  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={Link2} title="Test de corrélation" hasInput badge="Test">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Significativité Pearson / Spearman (p-value).
      </div>
      <div className="text-[9px] text-surface-600 bg-black/20 rounded px-2 py-1 mb-3">
        Prérequis : 2 variables numériques
      </div>
      <div>
        <NodeLabel>Variable 1</NodeLabel>
        <NodeColumnSelect name="col1" placeholder="-- Variable 1 --" value={(data.col1 as string) || ''} onChange={handleChange} columns={numericCols} columnTypes={columnTypes} />
      </div>
      <div>
        <NodeLabel>Variable 2</NodeLabel>
        <NodeColumnSelect name="col2" placeholder="-- Variable 2 --" value={(data.col2 as string) || ''} onChange={handleChange} columns={numericCols} columnTypes={columnTypes} />
      </div>
    </NodeShell>
  );
}

export function TestIndependenceNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns, columnTypes } = useConnectedColumns(id);
  const catCols = columns.filter(c => isCategoricalType(columnTypes[c] || ''));
  
  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={Grid3X3} title="Test d'indépendance" hasInput badge="Test">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Chi-carré / Fisher (variables catégorielles).
      </div>
      <div className="text-[9px] text-surface-600 bg-black/20 rounded px-2 py-1 mb-3">
        Prérequis : 2 variables catégorielles ou discrètes
      </div>
      <div>
        <NodeLabel>Variable 1</NodeLabel>
        <NodeColumnSelect name="col1" placeholder="-- Variable 1 --" value={(data.col1 as string) || ''} onChange={handleChange} columns={catCols} columnTypes={columnTypes} />
      </div>
      <div>
        <NodeLabel>Variable 2</NodeLabel>
        <NodeColumnSelect name="col2" placeholder="-- Variable 2 --" value={(data.col2 as string) || ''} onChange={handleChange} columns={catCols} columnTypes={columnTypes} />
      </div>
    </NodeShell>
  );
}

export function TestStationarityNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns, columnTypes } = useConnectedColumns(id);
  const numericCols = columns.filter(c => isNumericType(columnTypes[c] || ''));
  
  return (
    <NodeShell id={id} data={data} color="#ef4444" icon={Activity} title="Test de stationnarité" hasInput badge="Test">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        ADF + KPSS combinés. Conclusion automatique sur l'ordre d'intégration.
      </div>
      <div className="text-[9px] text-surface-600 bg-black/20 rounded px-2 py-1 mb-3">
        Prérequis : 1 variable numérique
      </div>
      <div>
        <NodeLabel>Variables à tester (séparées par une virgule)</NodeLabel>
        <NodeMultiColumnInput name="cols" placeholder="Toutes (auto)" value={(data.cols as string) || ''} onChange={handleChange} columns={numericCols} />
      </div>
    </NodeShell>
  );
}
