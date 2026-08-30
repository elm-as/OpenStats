import { NodeProps, Node } from '@xyflow/react';
import { TrendingUp, Target } from 'lucide-react';
import { 
  CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeNumberInput,
  useNodeUpdate, useConnectedColumns, NodeColumnSelect, NodeToggle, NodeCollapsible, NodeSeedInput
} from './_shared';

export function RegressionNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';
  
  return (
    <NodeShell id={id} data={data} color="#8b5cf6" icon={TrendingUp} title="Régression" hasInput badge="ML">
      <div>
        <NodeLabel>Cible (variable numérique)</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- Variable Cible --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Algorithmes</NodeLabel>
        <NodeSelect name="models" value={(data.models as string) || 'auto'} onChange={handleChange}>
          <option value="auto">Compétitif (tous les 12 modèles)</option>
          <option value="linear_regression">Régression Linéaire (OLS)</option>
          <option value="ridge">Ridge (L2)</option>
          <option value="lasso">Lasso (L1)</option>
          <option value="elasticnet">ElasticNet</option>
          <option value="polynomial_regression">Régression Polynomiale</option>
          <option value="decision_tree">Arbre de Décision</option>
          <option value="random_forest">Random Forest</option>
          <option value="gradient_boosting">Gradient Boosting</option>
          <option value="xgboost">XGBoost</option>
          <option value="lightgbm">LightGBM</option>
          <option value="svr">SVR (SVM Régression)</option>
          <option value="knn">K-Plus Proches Voisins (KNN)</option>
        </NodeSelect>
      </div>
      <div className="flex items-center justify-between pt-1">
        <NodeToggle value={mode} onChange={handleChange} />
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? 'Paramétrable' : 'Défauts optimaux'}
        </span>
      </div>
      {isAdvanced && (
        <NodeCollapsible title="Données & Validation" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Test split (%)</NodeLabel>
              <NodeNumberInput name="testSize" placeholder="20" value={(data.testSize as string) || ''} onChange={handleChange} min={5} max={50} />
            </div>
            <div>
              <NodeLabel>CV Folds</NodeLabel>
              <NodeNumberInput name="cvFolds" placeholder="5" value={(data.cvFolds as string) || ''} onChange={handleChange} min={2} max={20} />
            </div>
          </div>
          <NodeSeedInput value={(data.seed as string) || ''} onChange={handleChange} />
        </NodeCollapsible>
      )}
      {isAdvanced && (
        <NodeCollapsible title="Hyperparamètres">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Max Depth</NodeLabel>
              <NodeNumberInput name="maxDepth" placeholder="auto" value={(data.maxDepth as string) || ''} onChange={handleChange} min={1} max={50} />
            </div>
            <div>
              <NodeLabel>Min Split</NodeLabel>
              <NodeNumberInput name="minSamplesSplit" placeholder="2" value={(data.minSamplesSplit as string) || ''} onChange={handleChange} min={2} max={100} />
            </div>
          </div>
          <div>
            <NodeLabel>Stratégie de split</NodeLabel>
            <NodeSelect name="splitStrategy" value={(data.splitStrategy as string) || 'auto'} onChange={handleChange}>
              <option value="auto">Auto (détection temporelle)</option>
              <option value="random">Aléatoire</option>
              <option value="time">Chronologique</option>
            </NodeSelect>
          </div>
        </NodeCollapsible>
      )}
    </NodeShell>
  );
}

export function ClassificationNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);
  const mode = (data.mode as string) || 'auto';
  const isAdvanced = mode === 'advanced';
  
  return (
    <NodeShell id={id} data={data} color="#8b5cf6" icon={Target} title="Classification" hasInput badge="ML">
      <div>
        <NodeLabel>Cible (variable catégorielle)</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- Variable Cible --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
      <div>
        <NodeLabel>Algorithmes</NodeLabel>
        <NodeSelect name="models" value={(data.models as string) || 'auto'} onChange={handleChange}>
          <option value="auto">Compétitif (tous les 11 modèles)</option>
          <option value="logistic_regression">Régression Logistique</option>
          <option value="decision_tree">Arbre de Décision</option>
          <option value="random_forest">Random Forest</option>
          <option value="gradient_boosting">Gradient Boosting</option>
          <option value="adaboost">AdaBoost</option>
          <option value="xgboost">XGBoost</option>
          <option value="lightgbm">LightGBM</option>
          <option value="svm">Support Vector Machine (SVM)</option>
          <option value="knn">K-Plus Proches Voisins (KNN)</option>
          <option value="lda">Analyse Discriminante Linéaire (LDA)</option>
          <option value="qda">Analyse Discriminante Quadratique (QDA)</option>
        </NodeSelect>
      </div>
      <div className="flex items-center justify-between pt-1">
        <NodeToggle value={mode} onChange={handleChange} />
        <span className="text-[9px] text-surface-600">
          {isAdvanced ? 'Paramétrable' : 'Défauts optimaux'}
        </span>
      </div>
      {isAdvanced && (
        <NodeCollapsible title="Données & Validation" defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Test split (%)</NodeLabel>
              <NodeNumberInput name="testSize" placeholder="20" value={(data.testSize as string) || ''} onChange={handleChange} min={5} max={50} />
            </div>
            <div>
              <NodeLabel>CV Folds</NodeLabel>
              <NodeNumberInput name="cvFolds" placeholder="5" value={(data.cvFolds as string) || ''} onChange={handleChange} min={2} max={20} />
            </div>
          </div>
          <div>
            <NodeLabel>Métrique d'optimisation</NodeLabel>
            <NodeSelect name="metric" value={(data.metric as string) || 'f1_weighted'} onChange={handleChange}>
              <option value="f1_weighted">F1 (pondéré)</option>
              <option value="accuracy">Accuracy</option>
              <option value="roc_auc">ROC AUC</option>
              <option value="precision">Precision</option>
              <option value="recall">Recall</option>
            </NodeSelect>
          </div>
          <NodeSeedInput value={(data.seed as string) || ''} onChange={handleChange} />
        </NodeCollapsible>
      )}
      {isAdvanced && (
        <NodeCollapsible title="Hyperparamètres">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <NodeLabel>Max Depth</NodeLabel>
              <NodeNumberInput name="maxDepth" placeholder="auto" value={(data.maxDepth as string) || ''} onChange={handleChange} min={1} max={50} />
            </div>
            <div>
              <NodeLabel>Min Split</NodeLabel>
              <NodeNumberInput name="minSamplesSplit" placeholder="2" value={(data.minSamplesSplit as string) || ''} onChange={handleChange} min={2} max={100} />
            </div>
          </div>
          <div>
            <NodeLabel>Stratégie de split</NodeLabel>
            <NodeSelect name="splitStrategy" value={(data.splitStrategy as string) || 'auto'} onChange={handleChange}>
              <option value="auto">Auto (détection temporelle)</option>
              <option value="random">Aléatoire (stratifié)</option>
              <option value="time">Chronologique</option>
            </NodeSelect>
          </div>
        </NodeCollapsible>
      )}
    </NodeShell>
  );
}

export function ExplainabilityNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { columns } = useConnectedColumns(id);

  return (
    <NodeShell id={id} data={data} color="#8b5cf6" icon={Target} title="Explicabilité SHAP" hasInput badge="XAI">
      <div className="text-surface-400 text-[11px] leading-relaxed mb-2">
        Calcul des valeurs SHAP (Tree/Kernel Explainer) pour l'importance et l'impact local des variables.
      </div>
      <div>
        <NodeLabel>Variable Cible</NodeLabel>
        <NodeColumnSelect name="targetCol" placeholder="-- Variable Cible --" value={(data.targetCol as string) || ''} onChange={handleChange} columns={columns} />
      </div>
    </NodeShell>
  );
}
