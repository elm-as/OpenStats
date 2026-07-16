import React, { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play } from 'lucide-react';

import Sidebar from './Sidebar';
import { 
  DatasetNode, TimeSeriesNode, AINode, OutputNode, CleaningNode, AnalysisNode, MLNode,
  TypingNode, TestsNode, FactorialNode, TransformNode, SimulationNode, VisualizationNode 
} from './CustomNodes';

const initialNodes = [
  {
    id: '1',
    type: 'dataset',
    position: { x: 250, y: 150 },
    data: { file: 'sales_data.csv' },
  },
];

const nodeTypes = {
  dataset: DatasetNode,
  cleaning: CleaningNode,
  analysis: AnalysisNode,
  ml: MLNode,
  timeseries: TimeSeriesNode,
  ai: AINode,
  output: OutputNode,
  typing: TypingNode,
  tests: TestsNode,
  factorial: FactorialNode,
  transform: TransformNode,
  simulation: SimulationNode,
  visualization: VisualizationNode,
};

let id = 2;
const getId = () => `${id++}`;

function DnDFlow() {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      
      const newNode = {
        id: getId(),
        type,
        position,
        data: { },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance],
  );

  const handleRun = async () => {
    // Collect graph data and send to backend
    const pipeline = {
      nodes: nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map(e => ({ source: e.source, target: e.target }))
    };
    
    try {
      const response = await fetch('/api/v1/canvas/run_pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pipeline)
      });
      const result = await response.json();
      console.log("Result:", result);
      if (result.success) {
        const summary = Object.entries(result.results)
          .map(([id, r]) => `Nœud ${id}: ${r.status} ${r.message || r.error || ''}`)
          .join('\n');
        alert(`✓ Pipeline exécuté (${result.node_count} nœuds)\n\n${summary}`);
      } else {
        alert("Erreur:\n" + (result.error || "Inconnue"));
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de connexion au backend. Vérifiez que dcanvas est bien lancé.");
    }
  };

  return (
    <div className="canvas-layout">
      <Sidebar />
      <div className="reactflow-wrapper" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#1e293b" gap={20} size={2} />
          <Controls />
          <MiniMap nodeStrokeColor="#fff" nodeColor="#1e293b" maskColor="rgba(0,0,0,0.2)" />
        </ReactFlow>
        
        <button className="run-btn" onClick={handleRun}>
          <Play fill="currentColor" size={20} /> Exécuter le Workflow
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <DnDFlow />
    </ReactFlowProvider>
  );
}
