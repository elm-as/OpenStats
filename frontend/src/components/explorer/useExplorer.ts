import { useCallback, useEffect, useRef, useState } from 'react';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';
import type {
  Capabilities,
  ExplorationResult,
  ExplorerEvent,
  Finding,
  TraceStep,
} from './explorerTypes';

/**
 * Pilote une session d'exploration.
 *
 * L'exploration est diffusée en SSE : les découvertes et le raisonnement
 * arrivent au fil de l'eau, ce qui permet d'afficher la recherche pendant
 * qu'elle a lieu plutôt qu'un spinner suivi d'un pavé de résultats.
 */
export function useExplorer(datasetId: string | undefined) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [target, setTarget] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [liveFindings, setLiveFindings] = useState<Finding[]>([]);
  const [facts, setFacts] = useState<string[]>([]);
  const [result, setResult] = useState<ExplorationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'X-Client-Id': getAnonymousClientId() }),
    [],
  );

  /** Ce que l'explorateur peut faire ici — recalculé à chaque changement de cible. */
  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    const load = async () => {
      setLoadingCapabilities(true);
      try {
        const query = target ? `?target=${encodeURIComponent(target)}` : '';
        const response = await fetch(
          `${API_V1_BASE}/datasets/${datasetId}/explore/capabilities${query}`,
          { headers: headers() },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: Capabilities = await response.json();
        if (!cancelled) setCapabilities(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        if (!cancelled) setLoadingCapabilities(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [datasetId, target, headers]);

  const reset = useCallback(() => {
    setTrace([]);
    setLiveFindings([]);
    setFacts([]);
    setResult(null);
    setError(null);
    setElapsed(0);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const handleEvent = useCallback((event: ExplorerEvent) => {
    switch (event.type) {
      case 'context':
        setFacts(event.initial_facts);
        break;

      case 'probe_start':
        setTrace(prev => [
          ...prev,
          {
            key: event.key,
            label: event.label,
            explains: event.explains,
            triggeredBy: event.triggered_by,
            status: 'running',
          },
        ]);
        setElapsed(event.elapsed_sec);
        break;

      case 'finding':
        setLiveFindings(prev => [...prev, event.finding]);
        break;

      case 'probe_done':
        setTrace(prev =>
          prev.map(step =>
            step.key === event.key && step.status === 'running'
              ? {
                  ...step,
                  status: event.status,
                  durationMs: event.duration_ms,
                  nFindings: event.n_findings,
                  error: event.error,
                }
              : step,
          ),
        );
        setFacts(event.new_facts);
        setElapsed(event.elapsed_sec);
        break;

      case 'complete':
        setResult(event.result);
        setElapsed(event.result.elapsed_sec);
        break;

      case 'error':
        setError(event.error);
        break;
    }
  }, []);

  /** Lance l'exploration et consomme le flux SSE ligne par ligne. */
  const run = useCallback(
    async (budgetSec = 45) => {
      if (!datasetId || running) return;
      reset();
      setRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/explore/stream`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ target, budget_sec: budgetSec }),
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

          for (const chunk of chunks) {
            const line = chunk.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue; // keep-alive
            try {
              handleEvent(JSON.parse(line.slice(6)) as ExplorerEvent);
            } catch {
              // Un événement illisible ne doit pas interrompre le flux.
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Exploration interrompue');
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [datasetId, running, target, headers, reset, handleEvent],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  // Pendant la recherche on montre les découvertes brutes ; à la fin, la
  // liste classée et corrigée du FDR remplace l'affichage temps réel.
  const findings = result ? result.findings : liveFindings;

  return {
    capabilities,
    loadingCapabilities,
    target,
    setTarget,
    running,
    trace,
    findings,
    facts,
    result,
    error,
    elapsed,
    run,
    stop,
    reset,
  };
}
