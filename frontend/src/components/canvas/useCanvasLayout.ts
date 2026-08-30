import { useCallback } from 'react';
import { Node, Edge } from '@xyflow/react';

interface LayoutOptions {
  horizontalSpacing?: number;
  verticalSpacing?: number;
  startX?: number;
  startY?: number;
}

export function useCanvasLayout() {
  const computeAutoLayout = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      options: LayoutOptions = {}
    ): Node[] => {
      if (nodes.length === 0) return nodes;

      const {
        horizontalSpacing = 320,
        verticalSpacing = 160,
        startX = 80,
        startY = 80,
      } = options;

      const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
      const childrenMap = new Map<string, string[]>();
      const inDegree = new Map<string, number>();

      nodes.forEach(n => {
        childrenMap.set(n.id, []);
        inDegree.set(n.id, 0);
      });

      edges.forEach(e => {
        if (childrenMap.has(e.source) && inDegree.has(e.target)) {
          childrenMap.get(e.source)!.push(e.target);
          inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
        }
      });

      // Calcul des niveaux hiérarchiques (ranks)
      const rankMap = new Map<string, number>();
      const queue: string[] = [];

      nodes.forEach(n => {
        if ((inDegree.get(n.id) || 0) === 0) {
          rankMap.set(n.id, 0);
          queue.push(n.id);
        }
      });

      // Si tous les nœuds sont en cycle ou pas de racine, affecter le premier
      if (queue.length === 0 && nodes.length > 0) {
        rankMap.set(nodes[0].id, 0);
        queue.push(nodes[0].id);
      }

      while (queue.length > 0) {
        const currId = queue.shift()!;
        const currRank = rankMap.get(currId) || 0;
        const children = childrenMap.get(currId) || [];

        children.forEach(childId => {
          const nextRank = Math.max(rankMap.get(childId) ?? 0, currRank + 1);
          rankMap.set(childId, nextRank);
          queue.push(childId);
        });
      }

      // Nœuds isolés sans arêtes
      nodes.forEach(n => {
        if (!rankMap.has(n.id)) {
          rankMap.set(n.id, 0);
        }
      });

      // Regrouper les nœuds par niveau (colonne)
      const columns = new Map<number, string[]>();
      nodes.forEach(n => {
        const r = rankMap.get(n.id) || 0;
        if (!columns.has(r)) columns.set(r, []);
        columns.get(r)!.push(n.id);
      });

      // Calculer les coordonnées finales
      const newNodes: Node[] = [];

      columns.forEach((nodeIds, colIndex) => {
        const totalHeight = nodeIds.length * verticalSpacing;
        const offsetY = Math.max(0, (500 - totalHeight) / 2);

        nodeIds.forEach((nodeId, rowIndex) => {
          const original = nodeMap.get(nodeId);
          if (original) {
            newNodes.push({
              ...original,
              position: {
                x: startX + colIndex * horizontalSpacing,
                y: startY + offsetY + rowIndex * verticalSpacing,
              },
            });
          }
        });
      });

      return newNodes;
    },
    []
  );

  return { computeAutoLayout };
}
