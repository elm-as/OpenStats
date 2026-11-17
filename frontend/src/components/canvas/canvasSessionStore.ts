import type { Edge, Node } from '@xyflow/react';
import type { LogEntry } from './CanvasLogConsole';
import type { NodeResult } from './canvasGraphConfig';

export interface CanvasSessionSnapshot {
  nodes: Node[];
  edges: Edge[];
  pipelineResults: Record<string, NodeResult> | null;
  showResults: boolean;
  logs: LogEntry[];
  lastTemplateEncoded: string | null;
}

const snapshot: CanvasSessionSnapshot = {
  nodes: [],
  edges: [],
  pipelineResults: null,
  showResults: false,
  logs: [],
  lastTemplateEncoded: null,
};

/**
 * Conserve le graphe, les logs et les résultats du Canvas en mémoire
 * entre les changements d'onglets du ruban applicatif.
 */
export function getCanvasSessionSnapshot(): CanvasSessionSnapshot {
  return snapshot;
}

export function saveCanvasGraphState(nodes: Node[], edges: Edge[]): void {
  snapshot.nodes = nodes;
  snapshot.edges = edges;
}

export function saveCanvasPipelineState(
  pipelineResults: Record<string, NodeResult> | null,
  showResults: boolean,
): void {
  snapshot.pipelineResults = pipelineResults;
  snapshot.showResults = showResults;
}

export function saveCanvasLogs(logs: LogEntry[]): void {
  snapshot.logs = logs;
}

export function setCanvasLastTemplate(templateKey: string | null): void {
  snapshot.lastTemplateEncoded = templateKey;
}
