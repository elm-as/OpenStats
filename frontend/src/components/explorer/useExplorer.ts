import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { apiFetch } from '../../lib/apiBase';
import type { Capabilities } from './explorerTypes';
import {
  getExplorerSnapshot,
  resetExplorerSession,
  runExplorerSession,
  stopExplorerSession,
  subscribeExplorerStore,
  updateExplorerSession,
} from './explorerSessionStore';

/**
 * Pilote une session d'exploration adossée au store de session :
 * changer d'onglet conserve les découvertes et la trace d'exécution.
 */
export function useExplorer(datasetId: string | undefined) {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [capError, setCapError] = useState<string | null>(null);

  const session = useSyncExternalStore(
    subscribeExplorerStore,
    () => getExplorerSnapshot(datasetId),
    () => getExplorerSnapshot(undefined),
  );

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    const load = async () => {
      setLoadingCapabilities(true);
      try {
        const query = session.target ? `?target=${encodeURIComponent(session.target)}` : '';
        const response = await apiFetch(`/datasets/${datasetId}/explore/capabilities${query}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: Capabilities = await response.json();
        if (!cancelled) {
          setCapabilities(data);
          setCapError(null);
        }
      } catch (err) {
        if (!cancelled) setCapError(err instanceof Error ? err.message : 'Chargement impossible');
      } finally {
        if (!cancelled) setLoadingCapabilities(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [datasetId, session.target]);

  const setTarget = useCallback((target: string | null) => {
    if (datasetId) updateExplorerSession(datasetId, { target });
  }, [datasetId]);

  const setBudget = useCallback((budget: number) => {
    if (datasetId) updateExplorerSession(datasetId, { budget });
  }, [datasetId]);

  const reset = useCallback(() => {
    if (datasetId) resetExplorerSession(datasetId);
  }, [datasetId]);

  const stop = useCallback(() => {
    if (datasetId) stopExplorerSession(datasetId);
  }, [datasetId]);

  const run = useCallback(
    (budgetSec = session.budget) => (datasetId ? runExplorerSession(datasetId, budgetSec) : Promise.resolve()),
    [datasetId, session.budget],
  );

  const findings = session.result ? session.result.findings : session.liveFindings;

  return {
    capabilities,
    loadingCapabilities,
    target: session.target,
    setTarget,
    budget: session.budget,
    setBudget,
    running: session.running,
    trace: session.trace,
    findings,
    facts: session.facts,
    result: session.result,
    error: session.error ?? capError,
    elapsed: session.elapsed,
    run,
    stop,
    reset,
  };
}
