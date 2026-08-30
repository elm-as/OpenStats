import { useState, useCallback, useEffect, useRef } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import { useSearchParams } from 'react-router-dom';

const initialNodes: Node[] = [];
let idCounter = 1;
const getNextId = () => `node_${idCounter++}`;

interface UseCanvasGraphProps {
  onResetPipeline: () => void;
}

export function useCanvasGraph({ onResetPipeline }: UseCanvasGraphProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [, setLastDroppedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const onNodeDataChange = useCallback(
    (nodeId: string, key: string, value: string) => {
      setNodes(nds =>
        nds.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, [key]: value },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const onNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes(nds => nds.filter(n => n.id !== nodeId));
      setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  const getConnectedDatasetId = useCallback(
    (nodeId: string): string | null => {
      let currentId = nodeId;
      const visited = new Set<string>();

      while (currentId) {
        if (visited.has(currentId)) return null;
        visited.add(currentId);

        const node = nodes.find(n => n.id === currentId);
        if (node?.type === 'dataset' && node.data?.file) {
          return node.data.file as string;
        }

        const parentEdge = edges.find(e => e.target === currentId);
        if (!parentEdge) return null;
        currentId = parentEdge.source;
      }
      return null;
    },
    [nodes, edges]
  );

  const lastTemplateRef = useRef<string | null>(null);

  useEffect(() => {
    const datasetId = searchParams.get('dataset');
    const templateEncoded = searchParams.get('template');

    if (templateEncoded && templateEncoded !== lastTemplateRef.current) {
      lastTemplateRef.current = templateEncoded;
      try {
        const payload = JSON.parse(decodeURIComponent(templateEncoded));
        if (payload.nodes) {
          const templateNodes = payload.nodes.map((n: any) => ({
            ...n,
            data: {
              ...n.data,
              onChange: onNodeDataChange,
              onDelete: onNodeDelete,
              getConnectedDatasetId,
            },
          }));
          const templateEdges = (payload.edges || []).map((e: any) => ({
            ...e,
            type: 'animatedDataEdge',
          }));
          const maxId = templateNodes.reduce((max: number, n: any) => {
            const num = parseInt(n.id.replace('node_', ''), 10);
            return isNaN(num) ? max : Math.max(max, num);
          }, 0);
          idCounter = Math.max(idCounter, maxId + 1);
          setNodes(templateNodes);
          setEdges(templateEdges);
        }
      } catch (e) {
        console.error('Erreur de décodage du template Canvas:', e);
      }
      return;
    }

    if (datasetId && nodes.length === 0) {
      const newNode: Node = {
        id: 'ds_from_dashboard',
        type: 'dataset',
        position: { x: 100, y: 200 },
        data: {
          importMode: 'existing',
          file: datasetId,
          onChange: onNodeDataChange,
          onDelete: onNodeDelete,
          getConnectedDatasetId,
        },
      };
      setNodes([newNode]);
      idCounter = Math.max(idCounter, 2);
    }
  }, [searchParams, getConnectedDatasetId, onNodeDataChange, onNodeDelete, setEdges, setNodes, nodes.length]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds => {
        let color = '#38bdf8';
        let speed = '2.5s';
        let speedOffset = '1.25s';

        setNodes(currentNodes => {
          const sourceNode = currentNodes.find(n => n.id === params.source);
          if (sourceNode) {
            if (
              ['dataset', 'cleaning', 'transform', 'computeVariable', 'typing'].includes(
                sourceNode.type as string
              )
            ) {
              color = '#38bdf8';
              speed = '2s';
              speedOffset = '1s';
            } else if (
              [
                'descriptiveNumeric',
                'descriptiveCategorical',
                'correlation',
                'vif',
                'pca',
                'ca',
                'mca',
                'clustering',
              ].includes(sourceNode.type as string)
            ) {
              color = '#8b5cf6';
              speed = '3s';
              speedOffset = '1.5s';
            } else if (
              [
                'regression',
                'classification',
                'timeseries',
                'multivariateTimeseries',
                'simulation',
              ].includes(sourceNode.type as string)
            ) {
              color = '#10b981';
              speed = '1.5s';
              speedOffset = '0.75s';
            } else {
              color = '#f59e0b';
              speed = '2.5s';
              speedOffset = '1.25s';
            }
          }
          return currentNodes;
        });

        return addEdge(
          {
            ...params,
            type: 'animatedDataEdge',
            data: { color, speed, speedOffset },
          },
          eds
        );
      }),
    [setEdges, setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = getNextId();
      const newNode: Node = {
        id: newNodeId,
        type,
        position,
        data: {
          onChange: onNodeDataChange,
          onDelete: onNodeDelete,
          getConnectedDatasetId,
        },
      };

      setLastDroppedId(newNodeId);
      setTimeout(() => setLastDroppedId(null), 500);
      setNodes(nds => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, onNodeDataChange, onNodeDelete, getConnectedDatasetId]
  );

  const loadTemplate = useCallback(
    (templateNodes: Node[], templateEdges: Edge[]) => {
      const injectedNodes = templateNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          onChange: onNodeDataChange,
          onDelete: onNodeDelete,
          getConnectedDatasetId,
        },
      }));

      const maxId = templateNodes.reduce((max, n) => {
        const num = parseInt(n.id.replace('node_', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      idCounter = maxId + 1;

      setNodes(injectedNodes);
      setEdges(templateEdges);
      onResetPipeline();
    },
    [setNodes, setEdges, onNodeDataChange, onNodeDelete, getConnectedDatasetId, onResetPipeline]
  );

  return {
    reactFlowWrapper,
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    reactFlowInstance,
    setReactFlowInstance,
    onConnect,
    onDragOver,
    onDrop,
    loadTemplate,
  };
}
