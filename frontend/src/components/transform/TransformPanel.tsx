import { useState } from 'react';
import {
  useGetTransformRecommendationsQuery,
  useGetTransformCatalogQuery,
  usePreviewTransformMutation,
  useApplyTransformsMutation,
  useGetDatasetQuery,
} from '../../store/api';
import type { TransformRecommendation, TransformPreview } from '../../types';
import {
  Wrench,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Zap,
  Calculator,
  CheckCircle2,
} from 'lucide-react';
import ComputedVariableEditor from './ComputedVariableEditor';
import {
  RecommendationCard,
  PreviewCard,
  SelectedTransformsBar,
  AppliedLogsView,
} from './TransformSubComponents';

interface Props {
  datasetId: string;
  onTransformApplied?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  distribution: 'Distribution (asymétrie, normalité)',
  outliers: 'Valeurs extrêmes',
  scale: 'Échelles différentes',
  correlation: 'Corrélation / Multicolinéarité',
  timeseries: 'Séries temporelles',
};

export default function TransformPanel({ datasetId, onTransformApplied }: Props) {
  const { data: recsData, refetch: refetchRecs } = useGetTransformRecommendationsQuery(datasetId);
  const { data: catalogData } = useGetTransformCatalogQuery(datasetId);
  const { data: datasetInfo } = useGetDatasetQuery(datasetId);
  const [previewTransform] = usePreviewTransformMutation();
  const [applyTransforms, { isLoading: isApplying }] = useApplyTransformsMutation();

  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [selectedTransforms, setSelectedTransforms] = useState<
    { column: string; transform: string; params?: Record<string, unknown> }[]
  >([]);
  const [appliedLogs, setAppliedLogs] = useState<unknown[] | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualCol, setManualCol] = useState('');
  const [manualTransform, setManualTransform] = useState('');
  const [mode, setMode] = useState<'transform' | 'compute'>('transform');

  const recommendations = recsData?.recommendations || [];
  const catalog = catalogData?.transforms || [];
  const datasetCols = datasetInfo?.profile?.dtypes ? Object.keys(datasetInfo.profile.dtypes) : [];

  const grouped: Record<string, TransformRecommendation[]> = {};
  for (const r of recommendations) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const handlePreview = async (column: string, transform: string) => {
    try {
      const result = await previewTransform({ id: datasetId, column, transform }).unwrap();
      setPreview(result);
    } catch {
      setPreview(null);
    }
  };

  const toggleSelected = (column: string, transform: string) => {
    const key = `${column}::${transform}`;
    setSelectedTransforms(prev => {
      const exists = prev.find(t => `${t.column}::${t.transform}` === key);
      if (exists) return prev.filter(t => `${t.column}::${t.transform}` !== key);
      return [...prev, { column, transform }];
    });
  };

  const isSelected = (column: string, transform: string) =>
    selectedTransforms.some(t => t.column === column && t.transform === transform);

  const handleApply = async (inplace: boolean) => {
    if (selectedTransforms.length === 0) return;
    try {
      const result = await applyTransforms({
        id: datasetId,
        transforms: selectedTransforms,
        inplace,
      }).unwrap();
      setAppliedLogs(result.logs);
      if (inplace) {
        setSelectedTransforms([]);
        refetchRecs();
        onTransformApplied?.();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-3">
      <div className="ui-panel px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
            Transformations
          </span>
          <span className="ui-sep" aria-hidden />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode('transform')}
              className={`ui-btn text-xs ${mode === 'transform' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              Recommandations &amp; transformations
            </button>
            <button
              onClick={() => setMode('compute')}
              className={`ui-btn text-xs ${mode === 'compute' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <Calculator className="w-3 h-3" />
              Variable calculée
            </button>
          </div>
        </div>

        {mode === 'transform' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setManualMode(!manualMode)}
              className="ui-btn ui-focusable text-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              {manualMode ? 'Recommandations' : 'Mode manuel'}
            </button>
            <button
              onClick={() => refetchRecs()}
              className="ui-btn ui-btn-ghost ui-focusable text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Actualiser
            </button>
          </div>
        )}
      </div>

      {mode === 'compute' && (
        <ComputedVariableEditor
          datasetId={datasetId}
          columns={datasetCols}
          onComputed={() => onTransformApplied?.()}
        />
      )}

      {mode === 'transform' && (
        <>
          {selectedTransforms.length > 0 && (
            <SelectedTransformsBar
              selectedTransforms={selectedTransforms}
              catalog={catalog}
              isApplying={isApplying}
              onApply={handleApply}
              onToggleSelected={toggleSelected}
            />
          )}

          {manualMode && (
            <div className="ui-panel p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="ui-label block mb-1">Colonne</label>
                  <select
                    value={manualCol}
                    onChange={e => setManualCol(e.target.value)}
                    className="ui-select w-full"
                    title="Colonne"
                  >
                    <option value="">Choisir…</option>
                    {datasetCols.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
                <div>
                  <label className="ui-label block mb-1">Transformation</label>
                  <select
                    value={manualTransform}
                    onChange={e => setManualTransform(e.target.value)}
                    className="ui-select w-full"
                    title="Transformation"
                  >
                    <option value="">Choisir…</option>
                    {catalog.map(c => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => manualCol && manualTransform && handlePreview(manualCol, manualTransform)}
                    disabled={!manualCol || !manualTransform}
                    className="ui-btn ui-focusable text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> Aperçu
                  </button>
                  <button
                    onClick={() => manualCol && manualTransform && toggleSelected(manualCol, manualTransform)}
                    disabled={!manualCol || !manualTransform}
                    className="ui-btn ui-btn-primary ui-focusable text-xs"
                  >
                    <Check className="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}

          {preview && <PreviewCard preview={preview} catalog={catalog} />}

          {!manualMode && (
            <div className="space-y-2.5">
              {recommendations.length === 0 ? (
                <div className="ui-panel p-6 text-center ui-t-muted text-xs flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--ui-success)' }} />
                  <p className="font-semibold" style={{ color: 'var(--ui-text)' }}>
                    Aucune transformation requise
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, recs]) => {
                  const isExpanded = expandedCategory === category || expandedCategory === null;
                  return (
                    <section key={category} className="ui-panel overflow-hidden">
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === category ? '' : category)}
                        className="ui-panel-header w-full"
                        style={{ border: 0, cursor: 'pointer' }}
                      >
                        <span className="flex items-center gap-2" style={{ color: 'var(--ui-text)' }}>
                          {CATEGORY_LABELS[category] || category}
                          <span className="ui-tag ui-num">{recs.length}</span>
                        </span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ui-t-faint" /> : <ChevronDown className="w-3.5 h-3.5 ui-t-faint" />}
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 space-y-2" style={{ borderTop: '1px solid var(--ui-border)' }}>
                          {recs.map(rec => (
                            <RecommendationCard
                              key={`${rec.column}::${rec.issue}`}
                              rec={rec}
                              catalog={catalog}
                              isSelected={isSelected}
                              onToggle={toggleSelected}
                              onPreview={handlePreview}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })
              )}
            </div>
          )}

          {appliedLogs && (
            <AppliedLogsView logs={appliedLogs} onClose={() => setAppliedLogs(null)} />
          )}
        </>
      )}
    </div>
  );
}
