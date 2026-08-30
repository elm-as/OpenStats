import { useState } from 'react';
import {
  useGetTransformRecommendationsQuery,
  useGetTransformCatalogQuery,
  usePreviewTransformMutation,
  useApplyTransformsMutation,
  useGetDatasetQuery,
} from '../store/api';
import type { TransformRecommendation, TransformPreview } from '../types';
import {
  Wrench,
  AlertTriangle,
  Check,
  Eye,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Zap,
  Calculator,
} from 'lucide-react';
import ComputedVariableEditor from './ComputedVariableEditor';
import {
  RecommendationCard,
  PreviewCard,
  SelectedTransformsBar,
  AppliedLogsView,
} from './transform/TransformSubComponents';

interface Props {
  datasetId: string;
  onTransformApplied?: () => void;
}

export default function TransformPanel({ datasetId, onTransformApplied }: Props) {
  const { data: recsData, refetch: refetchRecs } = useGetTransformRecommendationsQuery(datasetId);
  const { data: catalogData } = useGetTransformCatalogQuery(datasetId);
  const { data: datasetInfo } = useGetDatasetQuery(datasetId);
  const [previewTransform] = usePreviewTransformMutation();
  const [applyTransforms, { isLoading: isApplying }] = useApplyTransformsMutation();

  const [preview, setPreview] = useState<TransformPreview | null>(null);
  const [, setPreviewLoading] = useState(false);
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

  // Grouper les recommandations par catégorie
  const grouped: Record<string, TransformRecommendation[]> = {};
  for (const r of recommendations) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const categoryLabels: Record<string, string> = {
    distribution: 'Distribution (asymétrie, normalité)',
    outliers: 'Valeurs aberrantes',
    scale: 'Échelles différentes',
    correlation: 'Corrélation / Multicolinéarité',
    timeseries: 'Séries temporelles',
  };

  const handlePreview = async (column: string, transform: string) => {
    setPreviewLoading(true);
    try {
      const result = await previewTransform({ id: datasetId, column, transform }).unwrap();
      setPreview(result);
    } catch {
      setPreview(null);
    }
    setPreviewLoading(false);
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-600" />
            Transformations de données
          </h3>
          <div className="flex bg-gray-100 p-1 rounded-lg w-max">
            <button
              onClick={() => setMode('transform')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'transform'
                  ? 'bg-white shadow-sm text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Transformations
            </button>
            <button
              onClick={() => setMode('compute')}
              className={`px-3 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                mode === 'compute'
                  ? 'bg-white shadow-sm text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calculator className="w-3 h-3" />
              Calculer
            </button>
          </div>
        </div>

        {mode === 'transform' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setManualMode(!manualMode)}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Zap className="w-4 h-4" />
              {manualMode ? 'Recommandations' : 'Mode manuel'}
            </button>
            <button
              onClick={() => refetchRecs()}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <RotateCcw className="w-4 h-4" /> Actualiser
            </button>
          </div>
        )}
      </div>

      {mode === 'compute' && (
        <ComputedVariableEditor
          datasetId={datasetId}
          columns={datasetCols}
          onComputed={() => {
            if (onTransformApplied) onTransformApplied();
          }}
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
            <div className="card">
              <h4 className="font-semibold text-gray-900 mb-3">
                Appliquer une transformation manuellement
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Colonne</label>
                  <input
                    type="text"
                    value={manualCol}
                    onChange={e => setManualCol(e.target.value)}
                    placeholder="Nom de la colonne"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transformation</label>
                  <select
                    value={manualTransform}
                    onChange={e => setManualTransform(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    title="Transformation"
                  >
                    <option value="">Choisir...</option>
                    {catalog.map(c => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={() =>
                      manualCol && manualTransform && handlePreview(manualCol, manualTransform)
                    }
                    disabled={!manualCol || !manualTransform}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" /> Aperçu
                  </button>
                  <button
                    onClick={() =>
                      manualCol && manualTransform && toggleSelected(manualCol, manualTransform)
                    }
                    disabled={!manualCol || !manualTransform}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              </div>
            </div>
          )}

          {preview && <PreviewCard preview={preview} catalog={catalog} />}

          {!manualMode && (
            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <div className="card text-center py-8 text-gray-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="font-medium">Aucune transformation recommandée</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Vos données semblent propres et bien distribuées.
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, recs]) => {
                  const isExpanded = expandedCategory === category || expandedCategory === null;
                  return (
                    <div key={category} className="card">
                      <button
                        onClick={() =>
                          setExpandedCategory(expandedCategory === category ? '' : category)
                        }
                        className="w-full flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">
                            {categoryLabels[category] || category}
                          </h4>
                          <span className="badge text-xs bg-gray-100 text-gray-600">
                            {recs.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-3">
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
                    </div>
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
