import { useState } from 'react';
import { useTrainModelsMutation, useGetDatasetQuery } from '../store/api';
import type { ModelResults } from '../types';
import { Brain, Trophy, Zap, Target, AlertCircle, BarChart3 } from 'lucide-react';
import { FeatureImportance, ConfusionMatrix, ROCCurve, ResidualsPlot } from './viz';
import { Card, Badge, Button, Section, StatusBadge } from './ui';

interface Props {
  datasetId: string;
}

export default function ModelingPanel({ datasetId }: Props) {
  const { data: dataset } = useGetDatasetQuery(datasetId);
  const [trainModels, { isLoading }] = useTrainModelsMutation();
  const [results, setResults] = useState<ModelResults | null>(null);
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [splitStrategy, setSplitStrategy] = useState<'auto' | 'random' | 'time'>('auto');
  const [temporalColumn, setTemporalColumn] = useState('');

  const columns = dataset?.profile.dictionary.map((d) => d.nom_brut) || [];
  const temporalCols = dataset?.profile.dictionary
    .filter((d) => d.type_statistique === 'temporel' || /date|annee|année|year|time/i.test(d.nom_brut))
    .map((d) => d.nom_brut) || [];

  const AVAILABLE_MODELS = [
    { key: 'linear_regression', label: 'Régression Linéaire', type: 'regression' },
    { key: 'ridge', label: 'Ridge (L2)', type: 'regression' },
    { key: 'lasso', label: 'Lasso (L1)', type: 'regression' },
    { key: 'random_forest', label: 'Random Forest', type: 'both' },
    { key: 'gradient_boosting', label: 'Gradient Boosting', type: 'both' },
    { key: 'xgboost', label: 'XGBoost', type: 'both' },
    { key: 'knn', label: 'KNN', type: 'both' },
    { key: 'svm', label: 'SVM', type: 'both' },
    { key: 'logistic_regression', label: 'Régression Logistique', type: 'classification' },
    { key: 'decision_tree', label: 'Arbre de Décision', type: 'both' },
    { key: 'lda', label: 'LDA', type: 'classification' },
    { key: 'adaboost', label: 'AdaBoost', type: 'both' },
  ];

  const handleTrain = async () => {
    if (!targetColumn) return;
    try {
      const res = await trainModels({
        id: datasetId,
        target_column: targetColumn,
        models: selectedModels.length > 0 ? selectedModels : undefined,
        split_strategy: splitStrategy,
        temporal_column: splitStrategy === 'time' ? (temporalColumn || undefined) : undefined,
      }).unwrap();
      setResults(res);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="section">
      <div>
        <h2 className="text-strong">Modélisation prédictive</h2>
        <p className="text-muted text-sm mt-1">
          Entraînement compétitif multi-algorithmes avec optimisation automatique
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <h3 className="text-strong mb-4 flex items-center gap-2">
          <Brain className="w-4 h-4 text-accent-400" /> Configuration
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
              Variable cible (Y)
            </label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              title="Variable cible"
            >
              <option value="">Sélectionner la variable à prédire…</option>
              {columns.map((col) => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-2 uppercase tracking-wider">
              Algorithmes <span className="text-faint normal-case">(vide = tous)</span>
            </label>
            <div className="grid-auto-fit-sm">
              {AVAILABLE_MODELS.map((m) => {
                const selected = selectedModels.includes(m.key);
                return (
                  <label
                    key={m.key}
                    className={`flex items-center gap-2 text-xs cursor-pointer px-2.5 py-1.5 rounded-lg border transition-colors ${
                      selected
                        ? 'bg-accent-500/10 border-accent-500/40 text-accent-200'
                        : 'bg-white/[0.02] border-white/8 text-default hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModels([...selectedModels, m.key]);
                        } else {
                          setSelectedModels(selectedModels.filter((k) => k !== m.key));
                        }
                      }}
                      className="accent-accent-500 !w-3.5 !h-3.5"
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Stratégie de split
              </label>
              <select
                value={splitStrategy}
                onChange={(e) => setSplitStrategy(e.target.value as 'auto' | 'random' | 'time')}
                title="Stratégie de split"
              >
                <option value="auto">Auto (recommandé)</option>
                <option value="random">Aléatoire</option>
                <option value="time">Temporel (chronologique)</option>
              </select>
            </div>

            {splitStrategy === 'time' && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Colonne temporelle
                </label>
                <select
                  value={temporalColumn}
                  onChange={(e) => setTemporalColumn(e.target.value)}
                  title="Colonne temporelle"
                >
                  <option value="">Détection auto</option>
                  {temporalCols.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <Button
            onClick={handleTrain}
            disabled={isLoading || !targetColumn}
            loading={isLoading}
            icon={<Brain className="w-4 h-4" />}
          >
            {isLoading ? 'Entraînement en cours…' : "Lancer l'entraînement"}
          </Button>
        </div>
      </Card>

      {/* Résultats */}
      {results && (
        <>
          {results.diagnostics?.quality_flag === 'critical' && (
            <Card className="!bg-red-500/5 !border-red-500/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-red-300 font-semibold">Alerte qualité modèle</h3>
                  <p className="text-default text-sm mt-1">{results.diagnostics.message}</p>
                </div>
              </div>
            </Card>
          )}

          {results.data_split?.strategy && (
            <Card variant="flat" className="!bg-accent-500/5 !border-accent-500/20">
              <p className="text-default text-sm">
                Split utilisé :{' '}
                <Badge variant="info">
                  {results.data_split.strategy === 'time' ? 'Temporel' : 'Aléatoire'}
                </Badge>
                {results.data_split.temporal_column && (
                  <span className="text-muted ml-2">colonne : <code className="text-accent-300 font-mono text-xs">{results.data_split.temporal_column}</code></span>
                )}
              </p>
              {results.data_split.train_time_range?.start && results.data_split.test_time_range?.end && (
                <p className="text-xs text-muted mt-1">
                  Train : {results.data_split.train_time_range.start.slice(0, 10)} → {results.data_split.train_time_range.end?.slice(0, 10)} | Test : {results.data_split.test_time_range.start?.slice(0, 10)} → {results.data_split.test_time_range.end?.slice(0, 10)}
                </p>
              )}
            </Card>
          )}

          {/* Classement */}
          <Section
            title={`Classement des modèles`}
            subtitle={`${results.task_type === 'regression' ? 'Régression' : 'Classification'} — ${results.ranking.length} modèles entraînés`}
            icon={<Trophy className="w-4 h-4 text-amber-400" />}
          >
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th className="text-center w-12">#</th>
                    <th>Modèle</th>
                    {results.task_type === 'regression' ? (
                      <>
                        <th className="text-right">R²</th>
                        <th className="text-right">RMSE</th>
                        <th className="text-right">MAE</th>
                      </>
                    ) : (
                      <>
                        <th className="text-right">Accuracy</th>
                        <th className="text-right">F1</th>
                        <th className="text-right">AUC</th>
                      </>
                    )}
                    <th className="text-right">CV Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.ranking.map((r) => (
                    <tr key={r.model_key} className={r.rank === 1 ? '!bg-amber-500/5' : ''}>
                      <td className="text-center">
                        {r.rank === 1 ? <Trophy className="w-4 h-4 text-amber-400 mx-auto" /> : <span className="text-muted">{r.rank}</span>}
                      </td>
                      <td className="font-medium text-strong">{r.model_name}</td>
                      {results.task_type === 'regression' ? (
                        <>
                          <td className="text-right num">{fmtMetric(r.metrics.r2 as number)}</td>
                          <td className="text-right num">{fmtMetric(r.metrics.rmse as number)}</td>
                          <td className="text-right num">{fmtMetric(r.metrics.mae as number)}</td>
                        </>
                      ) : (
                        <>
                          <td className="text-right num">{fmtMetric(r.metrics.accuracy as number)}</td>
                          <td className="text-right num">{fmtMetric(r.metrics.f1_weighted as number)}</td>
                          <td className="text-right num">{fmtMetric(r.metrics.auc_roc as number)}</td>
                        </>
                      )}
                      <td className="text-right num text-muted">{r.cv_scores.mean.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Matrice de confusion / ROC */}
          {results.task_type === 'classification' && results.ranking[0] && (() => {
            const best: any = results.ranking[0];
            const cm = best.confusion_matrix as number[][] | undefined;
            const cmLabels = best.class_labels as string[] | undefined;
            const roc = best.roc_curve as { fpr: number[]; tpr: number[]; auc?: number } | undefined;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cm && cmLabels && (
                  <Card>
                    <h3 className="text-strong mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-accent-400" /> Matrice de confusion
                    </h3>
                    <ConfusionMatrix matrix={cm} labels={cmLabels} normalize />
                  </Card>
                )}
                {roc && (
                  <Card>
                    <h3 className="text-strong mb-3">Courbe ROC</h3>
                    <ROCCurve curves={[{ name: best.model_name, ...roc }]} />
                  </Card>
                )}
              </div>
            );
          })()}

          {/* Régression : résidus */}
          {results.task_type === 'regression' && results.ranking[0] && (() => {
            const best: any = results.ranking[0];
            const preds = best.test_predictions as number[] | undefined;
            const actuals = best.test_actuals as number[] | undefined;
            if (!preds || !actuals || preds.length === 0) return null;
            const residuals = actuals.map((a, i) => a - preds[i]);
            return (
              <Card>
                <h3 className="text-strong mb-3">Résidus vs prédictions ({best.model_name})</h3>
                <ResidualsPlot fitted={preds} residuals={residuals} />
              </Card>
            );
          })()}

          {/* Feature Importance */}
          {results.ranking[0]?.feature_importance?.length > 0 && (
            <Card>
              <h3 className="text-strong mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-400" />
                Importance des variables — <span className="text-muted font-normal">{results.ranking[0].model_name}</span>
              </h3>
              <FeatureImportance
                features={results.ranking[0].feature_importance.map(f => ({
                  feature: f.feature,
                  importance: f.importance,
                }))}
                topN={15}
              />
            </Card>
          )}

          {/* SHAP */}
          {results.shap?.global_importance && results.shap.global_importance.length > 0 && (
            <Card>
              <h3 className="text-strong mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" /> Explicabilité SHAP
              </h3>
              <FeatureImportance
                features={results.shap.global_importance.map(s => ({
                  feature: s.feature,
                  importance: s.mean_shap,
                }))}
                topN={15}
                showSign
                xLabel="Impact SHAP moyen"
              />
            </Card>
          )}

          {/* Erreurs */}
          {results.failed.length > 0 && (
            <Card className="!bg-red-500/5 !border-red-500/30">
              <h3 className="text-red-300 font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Modèles en échec
              </h3>
              <ul className="space-y-1">
                {results.failed.map((f, i) => (
                  <li key={i} className="text-sm text-default flex items-center gap-2">
                    <StatusBadge status="error" label={f.model_name} />
                    <span className="text-muted text-xs">{f.error}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function fmtMetric(val: number | undefined): string {
  if (val == null) return '—';
  return val.toFixed(4);
}
