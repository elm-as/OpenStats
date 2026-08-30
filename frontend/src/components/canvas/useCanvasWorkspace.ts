import { useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';

export interface OpenStatsWorkspace {
  format: 'openstats_project';
  version: '1.0.0';
  exportedAt: string;
  metadata: {
    title: string;
    description?: string;
    nodeCount: number;
    edgeCount: number;
  };
  graph: {
    nodes: Node[];
    edges: Edge[];
  };
  pipelineResults?: any;
}

interface UseCanvasWorkspaceProps {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  pipelineResults?: any;
  setPipelineResults?: (results: any) => void;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  onTakeSnapshot?: () => void;
  fitView?: (options?: any) => void;
}

export function useCanvasWorkspace({
  nodes,
  setNodes,
  edges,
  setEdges,
  pipelineResults,
  setPipelineResults,
  onSuccess,
  onError,
  onTakeSnapshot,
  fitView,
}: UseCanvasWorkspaceProps) {
  // Exporter l'espace de travail en fichier .openstats
  const exportWorkspace = useCallback(
    (title: string = 'Projet_OpenStats') => {
      try {
        const workspaceData: OpenStatsWorkspace = {
          format: 'openstats_project',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          metadata: {
            title,
            nodeCount: nodes.length,
            edgeCount: edges.length,
          },
          graph: {
            nodes,
            edges,
          },
          pipelineResults: pipelineResults || null,
        };

        const jsonStr = JSON.stringify(workspaceData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `${title.toLowerCase().replace(/[^a-z0-9_-]/gi, '_')}.openstats`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        onSuccess?.(`Espace de travail exporté sous '${filename}'`);
      } catch (err: any) {
        onError?.(`Erreur lors de l'export du projet: ${err.message || err}`);
      }
    },
    [nodes, edges, pipelineResults, onSuccess, onError]
  );

  // Importer un fichier .openstats
  const importWorkspaceFromFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (data.format !== 'openstats_project') {
          throw new Error("Format de fichier non reconnu. Veuillez sélectionner un fichier valide '.openstats'.");
        }

        if (!data.graph || !Array.isArray(data.graph.nodes) || !Array.isArray(data.graph.edges)) {
          throw new Error('Données de graphe invalides ou corrompues dans le fichier.');
        }

        onTakeSnapshot?.();

        setNodes(data.graph.nodes);
        setEdges(data.graph.edges);

        if (data.pipelineResults && setPipelineResults) {
          setPipelineResults(data.pipelineResults);
        }

        setTimeout(() => {
          fitView?.({ duration: 600 });
        }, 80);

        onSuccess?.(`Projet '${data.metadata?.title || file.name}' restauré avec succès (${data.graph.nodes.length} nœuds)`);
      } catch (err: any) {
        onError?.(`Échec de chargement: ${err.message || err}`);
      }
    },
    [setNodes, setEdges, setPipelineResults, onTakeSnapshot, fitView, onSuccess, onError]
  );

  return {
    exportWorkspace,
    importWorkspaceFromFile,
  };
}
