import React from 'react';
import { Database, LineChart, Brain, FileOutput, Eraser, BarChart2, Network, Type, Activity, Layers, Wand2, PlayCircle, PieChart } from 'lucide-react';

export default function Sidebar() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar glass-panel">
      <h1>🎨 Dayana Canvas</h1>
      <div className="description" style={{marginBottom: '20px', color: 'var(--text-muted)', fontSize: '14px'}}>
        Glissez et déposez des blocs d'analyse pour créer votre pipeline de données.
      </div>

      <div className="dndnode dataset" onDragStart={(event) => onDragStart(event, 'dataset')} draggable>
        <Database size={20} color="var(--node-dataset)" /> Base de Données
      </div>
      
      <h3 style={{fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '15px', marginBottom: '5px'}}>Préparation</h3>
      <div className="dndnode typing" style={{borderColor: '#6366f1'}} onDragStart={(event) => onDragStart(event, 'typing')} draggable>
        <Type size={20} color="#6366f1" /> Types Statistiques
      </div>
      <div className="dndnode cleaning" style={{borderColor: '#f59e0b'}} onDragStart={(event) => onDragStart(event, 'cleaning')} draggable>
        <Eraser size={20} color="#f59e0b" /> Nettoyage
      </div>
      <div className="dndnode transform" style={{borderColor: '#ec4899'}} onDragStart={(event) => onDragStart(event, 'transform')} draggable>
        <Wand2 size={20} color="#ec4899" /> Transformation
      </div>
      
      <h3 style={{fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '15px', marginBottom: '5px'}}>Analyse</h3>
      <div className="dndnode analysis" style={{borderColor: '#10b981'}} onDragStart={(event) => onDragStart(event, 'analysis')} draggable>
        <BarChart2 size={20} color="#10b981" /> Exploration & Stats
      </div>
      <div className="dndnode tests" style={{borderColor: '#ef4444'}} onDragStart={(event) => onDragStart(event, 'tests')} draggable>
        <Activity size={20} color="#ef4444" /> Tests Statistiques
      </div>
      <div className="dndnode factorial" style={{borderColor: '#06b6d4'}} onDragStart={(event) => onDragStart(event, 'factorial')} draggable>
        <Layers size={20} color="#06b6d4" /> Factoriel & Clustering
      </div>
      
      <h3 style={{fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '15px', marginBottom: '5px'}}>Machine Learning</h3>
      <div className="dndnode ml" style={{borderColor: '#8b5cf6'}} onDragStart={(event) => onDragStart(event, 'ml')} draggable>
        <Network size={20} color="#8b5cf6" /> Modélisation (ML)
      </div>
      <div className="dndnode simulation" style={{borderColor: '#f97316'}} onDragStart={(event) => onDragStart(event, 'simulation')} draggable>
        <PlayCircle size={20} color="#f97316" /> Simulation & Scénarios
      </div>
      <div className="dndnode timeseries" onDragStart={(event) => onDragStart(event, 'timeseries')} draggable>
        <LineChart size={20} color="var(--node-timeseries)" /> Séries Temporelles
      </div>

      <h3 style={{fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '15px', marginBottom: '5px'}}>Visualisation & Export</h3>
      <div className="dndnode visualization" style={{borderColor: '#14b8a6'}} onDragStart={(event) => onDragStart(event, 'visualization')} draggable>
        <PieChart size={20} color="#14b8a6" /> Visualisation
      </div>
      
      <h3 style={{fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '15px', marginBottom: '5px'}}>IA & Export</h3>
      <div className="dndnode ai" onDragStart={(event) => onDragStart(event, 'ai')} draggable>
        <Brain size={20} color="var(--node-ai)" /> Moteur IA (dai)
      </div>
      <div className="dndnode output" onDragStart={(event) => onDragStart(event, 'output')} draggable>
        <FileOutput size={20} color="var(--node-output)" /> Rapport / Export
      </div>
    </aside>
  );
}
