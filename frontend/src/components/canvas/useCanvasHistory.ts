import { useState, useCallback, useEffect, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 30;

export function useCanvasHistory(
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  edges: Edge[],
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
) {
  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);
  const isPerformingAction = useRef(false);

  // Enregistrer un snapshot dans l'historique
  const takeSnapshot = useCallback(
    (currentNodes: Node[] = nodes, currentEdges: Edge[] = edges) => {
      if (isPerformingAction.current) return;
      setPast(prev => {
        const next = [...prev, { nodes: currentNodes, edges: currentEdges }];
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
      });
      setFuture([]);
    },
    [nodes, edges]
  );

  // Annuler (Undo)
  const undo = useCallback(() => {
    if (past.length === 0) return;

    isPerformingAction.current = true;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setFuture(prev => [{ nodes, edges }, ...prev]);
    setPast(newPast);

    setNodes(previous.nodes);
    setEdges(previous.edges);

    setTimeout(() => {
      isPerformingAction.current = false;
    }, 50);
  }, [past, nodes, edges, setNodes, setEdges]);

  // Rétablir (Redo)
  const redo = useCallback(() => {
    if (future.length === 0) return;

    isPerformingAction.current = true;
    const next = future[0];
    const newFuture = future.slice(1);

    setPast(prev => [...prev, { nodes, edges }]);
    setFuture(newFuture);

    setNodes(next.nodes);
    setEdges(next.edges);

    setTimeout(() => {
      isPerformingAction.current = false;
    }, 50);
  }, [future, nodes, edges, setNodes, setEdges]);

  // Écouteur global de raccourcis clavier Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ne pas intercepter si l'utilisateur écrit dans un input ou textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    takeSnapshot,
  };
}
