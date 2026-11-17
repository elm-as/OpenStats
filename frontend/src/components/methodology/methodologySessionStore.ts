import { apiFetch } from '../../lib/apiBase';
import type { MethodologyEvent, Remedy, Stage } from './methodologyTypes';

export interface RunOptions {
  target: string | null;
  maxIterations: number;
  allowAggressive: boolean;
}

export interface MethodologySessionState {
  stages: Stage[];
  running: boolean;
  done: boolean;
  error: string | null;
  applying: boolean;
  applyResult: string | null;
  target: string | null;
  maxIterations: number;
  allowAggressive: boolean;
}

const DEFAULT_SESSION: MethodologySessionState = {
  stages: [],
  running: false,
  done: false,
  error: null,
  applying: false,
  applyResult: null,
  target: null,
  maxIterations: 5,
  allowAggressive: true,
};

const sessions = new Map<string, MethodologySessionState>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(fn => fn());
}

export function subscribeMethodologyStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMethodologySnapshot(datasetId?: string): MethodologySessionState {
  if (!datasetId) return DEFAULT_SESSION;
  return sessions.get(datasetId) ?? DEFAULT_SESSION;
}

export function updateMethodologySession(
  datasetId: string,
  patch: Partial<MethodologySessionState>,
): void {
  const current = sessions.get(datasetId) ?? DEFAULT_SESSION;
  sessions.set(datasetId, { ...current, ...patch });
  notify();
}

export function resetMethodologySession(datasetId: string): void {
  updateMethodologySession(datasetId, {
    stages: [],
    done: false,
    error: null,
    applyResult: null,
  });
}

export function stopMethodologySession(datasetId: string): void {
  controllers.get(datasetId)?.abort();
  controllers.delete(datasetId);
  updateMethodologySession(datasetId, { running: false });
}

function applyChunks(datasetId: string, chunks: string[]): void {
  for (const chunk of chunks) {
    const line = chunk.split('\n').find(l => l.startsWith('data: '));
    if (!line) continue;
    try {
      const event = JSON.parse(line.slice(6)) as MethodologyEvent;
      const current = sessions.get(datasetId) ?? DEFAULT_SESSION;
      if (event.type === 'stage') {
        sessions.set(datasetId, { ...current, stages: [...current.stages, event.stage] });
      } else if (event.type === 'complete') {
        sessions.set(datasetId, { ...current, done: true });
      } else if (event.type === 'error') {
        sessions.set(datasetId, { ...current, error: event.error });
      }
      notify();
    } catch {
      continue;
    }
  }
}

/**
 * Exécute la méthodologie au niveau module pour que le flux SSE continue
 * et reste intact même si l'utilisateur change d'onglet.
 */
export async function runMethodologySession(
  datasetId: string,
  options: RunOptions,
): Promise<void> {
  const current = getMethodologySnapshot(datasetId);
  if (current.running) return;

  updateMethodologySession(datasetId, {
    stages: [],
    done: false,
    error: null,
    applyResult: null,
    running: true,
    target: options.target,
    maxIterations: options.maxIterations,
    allowAggressive: options.allowAggressive,
  });

  const controller = new AbortController();
  controllers.set(datasetId, controller);

  try {
    const response = await apiFetch(`/datasets/${datasetId}/methodology/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: options.target,
        max_iterations: options.maxIterations,
        allow_aggressive: options.allowAggressive,
      }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done: finished, value } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      applyChunks(datasetId, chunks);
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      updateMethodologySession(datasetId, {
        error: err instanceof Error ? err.message : 'Exécution interrompue',
      });
    }
  } finally {
    controllers.delete(datasetId);
    updateMethodologySession(datasetId, { running: false });
  }
}

export async function applyMethodologyRemedies(
  datasetId: string,
  remedies: Remedy[],
  params: { target: string | null; label?: string },
): Promise<unknown> {
  if (!remedies.length) return null;
  updateMethodologySession(datasetId, { applying: true, applyResult: null });
  try {
    const response = await apiFetch(`/datasets/${datasetId}/methodology/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        remedies,
        target: params.target,
        label: params.label,
        save_as_version: true,
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);

    const version = payload.version?.version_number;
    const count = payload.applied.filter((a: { ok: boolean }) => a.ok).length;
    updateMethodologySession(datasetId, {
      applyResult:
        `${count} correction(s) appliquée(s)`
        + (version ? ` — version ${version} enregistrée` : '')
        + ` — ${payload.shape.rows} lignes × ${payload.shape.columns} colonnes.`,
    });
    return payload;
  } catch (err) {
    updateMethodologySession(datasetId, {
      error: err instanceof Error ? err.message : 'Application impossible',
    });
    return null;
  } finally {
    updateMethodologySession(datasetId, { applying: false });
  }
}
