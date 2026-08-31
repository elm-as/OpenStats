import { NodeProps, Node } from '@xyflow/react';
import { Wand2, Code2 } from 'lucide-react';
import {
  CanvasNodeData,
  NodeShell,
  NodeLabel,
  NodeInput,
  useNodeUpdate,
  useConnectedColumns,
  NodeMultiColumnInput,
} from './_shared';

export { TypingNode } from './TypingNode';
export { CleaningNode } from './CleaningNode';

const TRANSFORM_ACTIONS = [
  { key: 'standardize', label: 'Standardisation (Z-score)', group: 'Normalisation' },
  { key: 'normalize', label: 'Normalisation (Min-Max)', group: 'Normalisation' },
  { key: 'log', label: 'Transformation Logarithmique', group: 'Asymetrie' },
  { key: 'boxcox', label: 'Transformation Box-Cox', group: 'Asymetrie' },
  { key: 'sqrt', label: 'Racine carree', group: 'Asymetrie' },
  { key: 'winsorize', label: 'Winsorisation', group: 'Outliers' },
  { key: 'clip_iqr', label: 'Clip IQR', group: 'Outliers' },
  { key: 'lag', label: 'Retard temporel (Lag Xt-1)', group: 'Series temporelles' },
  { key: 'diff', label: 'Differenciation (ordre 1)', group: 'Series temporelles' },
  { key: 'diff2', label: 'Differenciation (ordre 2)', group: 'Series temporelles' },
  { key: 'rolling_mean', label: 'Moyenne mobile glissante', group: 'Series temporelles' },
  { key: 'pct_change', label: 'Taux de variation relatif', group: 'Series temporelles' },
] as const;

const TRANSFORM_GROUPS = [
  'Normalisation',
  'Asymetrie',
  'Outliers',
  'Series temporelles',
] as const;

export function TransformNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';

  const rawActions = data.actions;
  const actionsList: string[] = Array.isArray(rawActions)
    ? rawActions
    : typeof rawActions === 'string'
    ? rawActions.split(',').map(s => s.trim()).filter(Boolean)
    : [];
  const selectedActions = new Set(actionsList);

  const toggleAction = (key: string) => {
    const next = new Set(selectedActions);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    if (data.onChange) {
      data.onChange(id, 'actions', Array.from(next).join(','));
    }
  };

  const selectedCount = selectedActions.size;

  return (
    <NodeShell
      id={id}
      data={data}
      color="#ec4899"
      icon={Wand2}
      title="Transformation"
      hasInput
    >
      <div>
        <NodeLabel>Colonne(s) cible</NodeLabel>
        <NodeMultiColumnInput
          name="columns"
          placeholder="Toutes (auto)"
          value={(data.columns as string) || ''}
          onChange={handleChange}
          columns={columns}
        />
      </div>

      <div className="flex items-center justify-between">
        <NodeLabel>Operations</NodeLabel>
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? selectedCount + ' selectionnee(s)' : 'Auto'}
        </span>
      </div>

      {!isAdvanced && (
        <p className="text-surface-400 text-[11px] leading-relaxed">
          Recommandations automatiques selon le profil des colonnes selectionnees.
        </p>
      )}

      {isAdvanced && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {TRANSFORM_GROUPS.map(group => {
            const groupActions = TRANSFORM_ACTIONS.filter(a => a.group === group);
            return (
              <div key={group}>
                <span className="text-[9px] text-surface-600 uppercase tracking-wider font-semibold">
                  {group}
                </span>
                <div className="space-y-0.5 mt-1">
                  {groupActions.map(act => (
                    <label key={act.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedActions.has(act.key)}
                        onChange={() => toggleAction(act.key)}
                        className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-pink-500"
                      />
                      <span className="text-[11px] text-surface-300">{act.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="sr-only"
            checked={isAdvanced}
            onChange={e => {
              if (data.onChange) {
                data.onChange(id, 'mode', e.target.checked ? 'advanced' : 'auto');
              }
            }}
          />
          <div
            className={`w-8 h-4 rounded-full transition-colors ${
              isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            {isAdvanced ? 'Avance' : 'Auto'}
          </span>
        </label>
      </div>
    </NodeShell>
  );
}

export function ComputeVariableNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  return (
    <NodeShell
      id={id}
      data={data}
      color="#a855f7"
      icon={Code2}
      title="Variable calculee"
      hasInput
    >
      <div>
        <NodeLabel>Nom de la colonne</NodeLabel>
        <NodeInput
          name="newColumn"
          placeholder="ex: ratio_prix"
          value={(data.newColumn as string) || ''}
          onChange={handleChange}
        />
      </div>
      <div>
        <NodeLabel>Formule Python</NodeLabel>
        <NodeInput
          name="formula"
          placeholder="col1 / col2 * 100"
          value={(data.formula as string) || ''}
          onChange={handleChange}
        />
      </div>
    </NodeShell>
  );
}
