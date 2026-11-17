import type { Edge, Node } from '@xyflow/react';
import { apiFetch } from '../../../lib/apiBase';

export interface SimulationFeatureRange {
  min: number;
  mean: number;
  max: number;
}

export async function fetchSimulationFeatureRanges(
  dsId: string,
): Promise<Record<string, SimulationFeatureRange> | null> {
  try {
    const response = await apiFetch(`/datasets/${dsId}/model/feature-ranges`);
    if (!response.ok) return null;
    const result = await response.json();
    return result.ranges || {};
  } catch {
    return null;
  }
}

export async function runSimulationPrediction(
  dsId: string,
  features: Record<string, number>,
): Promise<any> {
  const response = await apiFetch(`/datasets/${dsId}/model/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Erreur de prédiction');
  }
  return response.json();
}

export interface BackwardsContext {
  dsId: string | null;
  excludedCols: Set<string>;
  typingNodeId: string | null;
  dynamicCols: Set<string>;
}

function collectDynamicColumns(node: Node, dynamicCols: Set<string>): void {
  const res = node.data?.runResult as Record<string, any> | undefined;
  if (!res) return;
  if (res.residuals || res.fitted_values) {
    dynamicCols.add('_fitted_values');
    dynamicCols.add('_residuals');
  }
  if (res.forecast || res.predictions) dynamicCols.add('_forecast');
  if (res.clusters || res.cluster_labels || res.n_clusters) dynamicCols.add('_cluster');
  if (Array.isArray(res.columns)) res.columns.forEach((c: string) => dynamicCols.add(c));
  if (Array.isArray(res.records) && res.records.length > 0) {
    Object.keys(res.records[0]).forEach(c => dynamicCols.add(c));
  }
}

function parseExcludedList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function inspectUpstreamNode(
  node: Node,
  targetId: string,
  state: BackwardsContext,
): boolean {
  if (node.id !== targetId) collectDynamicColumns(node, state.dynamicCols);
  if (node.type === 'typing') {
    state.typingNodeId = node.id;
    if (node.id !== targetId) {
      parseExcludedList(node.data?.excludedColumns).forEach(c => state.excludedCols.add(c));
    }
  }
  if (node.type === 'dataset' && node.data?.file) {
    state.dsId = node.data.file as string;
    return true;
  }
  return false;
}

/**
 * Remonte le graphe depuis un nœud cible pour déterminer le dataset source,
 * les colonnes exclues et les colonnes générées en amont.
 */
export function resolveUpstreamContext(
  id: string,
  allNodes: Node[],
  allEdges: Edge[],
): BackwardsContext {
  let currentId: string | null = id;
  const visited = new Set<string>();
  const state: BackwardsContext = {
    dsId: null,
    excludedCols: new Set<string>(),
    typingNodeId: null,
    dynamicCols: new Set<string>(),
  };

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = allNodes.find(n => n.id === currentId);
    if (node && inspectUpstreamNode(node, id, state)) break;
    const parentEdge = allEdges.find(e => e.target === currentId);
    currentId = parentEdge ? parentEdge.source : null;
  }

  return state;
}

/** Construit la table de correspondance colonne → type lisible. */
export function resolveColumnTypes(dataset: any): Record<string, string> {
  const columnTypes: Record<string, string> = {};
  const dictionary = dataset?.profile?.dictionary;
  if (!Array.isArray(dictionary)) return columnTypes;

  const dtypes = dataset?.profile?.dtypes || {};
  for (const entry of dictionary) {
    const colName = typeof entry === 'string' ? entry : entry.nom_brut;
    const dtype = String(dtypes[colName] || '');
    const statType = typeof entry === 'object' ? entry.type_statistique : null;
    columnTypes[colName] =
      statType ||
      (/^(float|int)\d*$/.test(dtype)
        ? 'numérique'
        : /^(object|string|category)$/.test(dtype)
          ? 'catégoriel'
          : /^datetime/.test(dtype)
            ? 'temporel'
            : /^bool/.test(dtype)
              ? 'binaire'
              : dtype || '?');
  }
  return columnTypes;
}
