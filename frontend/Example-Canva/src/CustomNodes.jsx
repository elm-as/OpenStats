import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Database, LineChart, Brain, FileOutput, Eraser, BarChart2, Network, Type, Activity, Layers, Wand2, PlayCircle, PieChart } from 'lucide-react';

export function DatasetNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid var(--node-dataset)' }}>
      <div className="header">
        <Database size={18} color="var(--node-dataset)" /> Dataset
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fichier source (CSV/Parquet)</label>
        <input type="text" placeholder="/path/to/data.csv" defaultValue={data.file || ""} />
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function CleaningNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #f59e0b' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Eraser size={18} color="#f59e0b" /> Nettoyage
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Action</label>
        <select defaultValue={data.action || "drop_nulls"}>
          <option value="drop_nulls">Supprimer les valeurs nulles</option>
          <option value="fill_mean">Remplacer par la moyenne</option>
          <option value="drop_duplicates">Supprimer les doublons</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function AnalysisNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #10b981' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <BarChart2 size={18} color="#10b981" /> Exploration & Stats
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Type d'analyse</label>
        <select defaultValue={data.analysisType || "descriptive"}>
          <option value="descriptive">Statistiques descriptives</option>
          <option value="correlation_pearson">Corrélation (Pearson)</option>
          <option value="correlation_spearman">Corrélation (Spearman)</option>
          <option value="vif">VIF (Multicolinéarité)</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function MLNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #8b5cf6' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Network size={18} color="#8b5cf6" /> Machine Learning
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Algorithme</label>
        <select defaultValue={data.model || "linear_regression"}>
          <optgroup label="Régression">
            <option value="linear_regression">Régression Linéaire</option>
            <option value="ridge">Ridge</option>
            <option value="lasso">Lasso</option>
            <option value="elasticnet">ElasticNet</option>
            <option value="svr">SVR</option>
            <option value="rf_regression">Random Forest (Reg)</option>
            <option value="gb_regression">Gradient Boosting (Reg)</option>
          </optgroup>
          <optgroup label="Classification">
            <option value="logistic_regression">Régression Logistique</option>
            <option value="svm">SVM</option>
            <option value="rf_classification">Random Forest (Class)</option>
            <option value="gb_classification">Gradient Boosting (Class)</option>
            <option value="knn">KNN</option>
            <option value="lda">LDA</option>
          </optgroup>
        </select>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cible (Target)</label>
        <input type="text" placeholder="Ex: Survived" defaultValue={data.targetCol || ""} />
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function TimeSeriesNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid var(--node-timeseries)' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <LineChart size={18} color="var(--node-timeseries)" /> Séries Temporelles
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Modèle</label>
        <select defaultValue={data.model || "arima"}>
          <option value="arima">ARIMA</option>
          <option value="sarima">SARIMA</option>
          <option value="holt">Holt-Winters</option>
          <option value="var">VAR (Multivarié)</option>
        </select>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Colonne Date</label>
        <input type="text" placeholder="Date" defaultValue={data.dateCol || ""} />
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Variable à prédire</label>
        <input type="text" placeholder="Sales" defaultValue={data.targetCol || ""} />
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function AINode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid var(--node-ai)' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Brain size={18} color="var(--node-ai)" /> Action IA (dai)
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Prompt</label>
        <input type="text" placeholder="Analyser les données..." defaultValue={data.prompt || ""} />
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function OutputNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid var(--node-output)' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <FileOutput size={18} color="var(--node-output)" /> Rapport / Export
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Format</label>
        <select defaultValue={data.format || "html"}>
          <option value="html">HTML Graphique</option>
          <option value="pdf">Document PDF</option>
          <option value="csv">Fichier CSV (Export)</option>
        </select>
      </div>
    </div>
  );
}

export function TypingNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #6366f1' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Type size={18} color="#6366f1" /> Types Statistiques
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Détection automatique et correction</label>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Corrige les erreurs de type (ex: Pclass en discret/catégoriel).
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function TestsNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #ef4444' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Activity size={18} color="#ef4444" /> Tests Statistiques
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Test à effectuer</label>
        <select defaultValue={data.testType || "compare_means"}>
          <option value="compare_means">Comparaison de moyennes (T-test/ANOVA)</option>
          <option value="independence">Indépendance (Chi-carré/Fisher)</option>
          <option value="correlation">Corrélation (Pearson/Spearman p-value)</option>
          <option value="stationarity">Stationnarité (ADF/KPSS)</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function FactorialNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #06b6d4' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Layers size={18} color="#06b6d4" /> Factoriel & Clustering
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Méthode</label>
        <select defaultValue={data.method || "pca"}>
          <optgroup label="Analyse Factorielle">
            <option value="pca">ACP (Composantes Principales)</option>
            <option value="ca">AFC (Correspondances)</option>
            <option value="mca">ACM (Correspondances Multiples)</option>
          </optgroup>
          <optgroup label="Clustering">
            <option value="kmeans">K-Means</option>
            <option value="dbscan">DBSCAN</option>
            <option value="hierarchical">Classification Ascendante Hiérarchique</option>
          </optgroup>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function TransformNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #ec4899' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <Wand2 size={18} color="#ec4899" /> Transformation
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Action</label>
        <select defaultValue={data.action || "standardize"}>
          <option value="standardize">Standardisation (Z-score)</option>
          <option value="normalize">Normalisation (Min-Max)</option>
          <option value="log">Transformation Logarithmique</option>
          <option value="boxcox">Transformation Box-Cox</option>
          <option value="diff">Différenciation (Séries temporelles)</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function SimulationNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #f97316' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <PlayCircle size={18} color="#f97316" /> Simulation & Scénarios
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Type</label>
        <select defaultValue={data.simulationType || "prediction"}>
          <option value="prediction">Prédiction unitaire</option>
          <option value="monte_carlo">Simulation de Monte Carlo</option>
          <option value="sensitivity">Analyse de sensibilité</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function VisualizationNode({ data }) {
  return (
    <div className="custom-node glass-panel" style={{ borderTop: '4px solid #14b8a6' }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="header">
        <PieChart size={18} color="#14b8a6" /> Visualisation
      </div>
      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Type de graphique</label>
        <select defaultValue={data.chartType || "scatter"}>
          <option value="scatter">Nuage de points (Scatter)</option>
          <option value="bar">Diagramme à barres</option>
          <option value="line">Courbe d'évolution</option>
          <option value="pie">Camembert (Pie)</option>
          <option value="boxplot">Boîte à moustaches (Boxplot)</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
