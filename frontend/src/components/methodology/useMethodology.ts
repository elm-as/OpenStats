import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { apiFetch } from '../../lib/apiBase';
import type { Remedy } from './methodologyTypes';
import {
  applyMethodologyRemedies,
  getMethodologySnapshot,
  resetMethodologySession,
  runMethodologySession,
  stopMethodologySession,
  subscribeMethodologyStore,
  updateMethodologySession,
  type RunOptions,
} from './methodologySessionStore';

export type { RunOptions };

/**
 * Pilote une exécution de la méthodologie en s'appuyant sur un store de session
 * persistant : changer d'onglet n'interrompt ni n'efface l'analyse en cours.
 */
export function useMethodology(datasetId: string | undefined) {
  const [columns, setColumns] = useState<string[]>([]);
  const session = useSyncExternalStore(
    subscribeMethodologyStore,
    () => getMethodologySnapshot(datasetId),
    () => getMethodologySnapshot(undefined),
  );

  const run = useCallback(
    (options: RunOptions) => (datasetId ? runMethodologySession(datasetId, options) : Promise.resolve()),
    [datasetId],
  );

  const stop = useCallback(() => {
    if (datasetId) stopMethodologySession(datasetId);
  }, [datasetId]);

  const reset = useCallback(() => {
    if (datasetId) resetMethodologySession(datasetId);
  }, [datasetId]);

  const setTarget = useCallback((target: string | null) => {
    if (datasetId) updateMethodologySession(datasetId, { target });
  }, [datasetId]);

  const setMaxIterations = useCallback((maxIterations: number) => {
    if (datasetId) updateMethodologySession(datasetId, { maxIterations });
  }, [datasetId]);

  const setAllowAggressive = useCallback((allowAggressive: boolean) => {
    if (datasetId) updateMethodologySession(datasetId, { allowAggressive });
  }, [datasetId]);

  const applyRemedies = useCallback(
    async (remedies: Remedy[], target: string | null, label?: string) => {
      if (!datasetId) return null;
      return applyMethodologyRemedies(datasetId, remedies, { target, label });
    },
    [datasetId],
  );

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await apiFetch(`/datasets/${datasetId}`);
        if (!response.ok) return;
        const payload = await response.json();
        const fromProfile: string[] = (payload.profile?.dictionary ?? [])
          .map((entry: { nom_brut?: string }) => entry?.nom_brut)
          .filter((name: unknown): name is string => typeof name === 'string' && name.length > 0);
        const explicit = Array.isArray(payload.active_columns) ? payload.active_columns : [];
        const excluded = new Set<string>(
          Array.isArray(payload.excluded_columns) ? payload.excluded_columns : [],
        );
        const names = (explicit.length ? explicit : fromProfile).filter(
          (name: string) => !excluded.has(name),
        );
        if (!cancelled) setColumns(names);
      } catch {
        /* la liste de colonnes reste vide : le selecteur de cible sera desactive */
      }
    })();

    return () => { cancelled = true; };
  }, [datasetId]);

  return {
    columns,
    stages: session.stages,
    running: session.running,
    done: session.done,
    error: session.error,
    applying: session.applying,
    applyResult: session.applyResult,
    target: session.target,
    maxIterations: session.maxIterations,
    allowAggressive: session.allowAggressive,
    setTarget,
    setMaxIterations,
    setAllowAggressive,
    run,
    stop,
    reset,
    applyRemedies,
  };
}
