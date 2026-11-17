import { apiFetch } from '../../lib/apiBase';
import type { ExplorationResult, ExplorerEvent, Finding, TraceStep } from './explorerTypes';

export interface ExplorerSessionState {
  target: string | null;
  budget: number;
  running: boolean;
  trace: TraceStep[];
  liveFindings: Finding[];
  facts: string[];
  result: ExplorationResult | null;
  error: string | null;
  elapsed: number;
}

const DEFAULT_EXPLORER: ExplorerSessionState = {
  target: null,
  budget: 45,
  running: false,
  trace: [],
  liveFindings: [],
  facts: [],
  result: null,
  error: null,
  elapsed: 0,
};

const sessions = new Map<string, ExplorerSessionState>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export function subscribeExplorerStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getExplorerSnapshot(datasetId?: string): ExplorerSessionState {
  if (!datasetId) return DEFAULT_EXPLORER;
  return sessions.get(datasetId) ?? DEFAULT_EXPLORER;
}

export function updateExplorerSession(
  datasetId: string,
  patch: Partial<ExplorerSessionState>,
): void {
  const current = sessions.get(datasetId) ?? DEFAULT_EXPLORER;
  sessions.set(datasetId, { ...current, ...patch });
  notify();
}

export function resetExplorerSession(datasetId: string): void {
  updateExplorerSession(datasetId, {
    trace: [],
    liveFindings: [],
    facts: [],
    result: null,
    error: null,
    elapsed: 0,
  });
}

export function stopExplorerSession(datasetId: string): void {
  controllers.get(datasetId)?.abort();
  controllers.delete(datasetId);
  updateExplorerSession(datasetId, { running: false });
}

function handleExplorerEvent(datasetId: string, event: ExplorerEvent): void {
  const cur = sessions.get(datasetId) ?? DEFAULT_EXPLORER;
  if (event.type === 'context') {
    sessions.set(datasetId, { ...cur, facts: event.initial_facts });
  } else if (event.type === 'probe_start') {
    const step: TraceStep = {
      key: event.key,
      label: event.label,
      explains: event.explains,
      triggeredBy: event.triggered_by,
      status: 'running',
    };
    sessions.set(datasetId, { ...cur, trace: [...cur.trace, step], elapsed: event.elapsed_sec });
  } else if (event.type === 'finding') {
    sessions.set(datasetId, { ...cur, liveFindings: [...cur.liveFindings, event.finding] });
  } else if (event.type === 'probe_done') {
    const trace = cur.trace.map(s => (s.key === event.key && s.status === 'running'
      ? { ...s, status: event.status, durationMs: event.duration_ms, nFindings: event.n_findings, error: event.error }
      : s));
    sessions.set(datasetId, { ...cur, trace, facts: event.new_facts, elapsed: event.elapsed_sec });
  } else if (event.type === 'complete') {
    sessions.set(datasetId, { ...cur, result: event.result, elapsed: event.result.elapsed_sec });
  } else if (event.type === 'error') {
    sessions.set(datasetId, { ...cur, error: event.error });
  }
  notify();
}

function dispatchChunks(datasetId: string, chunks: string[]): void {
  for (const chunk of chunks) {
    const line = chunk.split('\n').find(l => l.startsWith('data: '));
    if (!line) continue;
    try {
      handleExplorerEvent(datasetId, JSON.parse(line.slice(6)) as ExplorerEvent);
    } catch {
      continue;
    }
  }
}

/**
 * Exécute l'explorateur adaptatif hors cycle de montage React pour conserver
 * les résultats lors des changements d'onglets.
 */
export async function runExplorerSession(datasetId: string, budgetSec: number): Promise<void> {
  const current = getExplorerSnapshot(datasetId);
  if (current.running) return;

  updateExplorerSession(datasetId, {
    trace: [],
    liveFindings: [],
    facts: [],
    result: null,
    error: null,
    elapsed: 0,
    running: true,
    budget: budgetSec,
  });

  const controller = new AbortController();
  controllers.set(datasetId, controller);

  try {
    const response = await apiFetch(`/datasets/${datasetId}/explore/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: current.target, budget_sec: budgetSec }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      dispatchChunks(datasetId, chunks);
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      updateExplorerSession(datasetId, {
        error: err instanceof Error ? err.message : 'Exploration interrompue',
      });
    }
  } finally {
    controllers.delete(datasetId);
    updateExplorerSession(datasetId, { running: false });
  }
}
