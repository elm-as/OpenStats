import { useCallback, useEffect, useRef, useState } from 'react';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';
import type { MethodologyEvent, Remedy, Stage } from './methodologyTypes';

export interface RunOptions {
  target: string | null;
  maxIterations: number;
  allowAggressive: boolean;
}

/**
 * Pilote une exécution de la méthodologie.
 *
 * Le flux SSE délivre une étape à la fois : l'écran se remplit au fur et à
 * mesure au lieu d'afficher un spinner puis un pavé.
 */
export function useMethodology(datasetId: string | undefined) {
  const [columns, setColumns] = useState<string[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const headers = useCallback(
    () => ({ 'Content-Type': 'application/json', 'X-Client-Id': getAnonymousClientId() }),
    [],
  );

  const reset = useCallback(() => {
    setStages([]);
    setError(null);
    setDone(false);
    setApplyResult(null);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const run = useCallback(
    async (options: RunOptions) => {
      if (!datasetId || running) return;
      reset();
      setRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/methodology/stream`, {
          method: 'POST',
          headers: headers(),
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

          for (const chunk of chunks) {
            const line = chunk.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue;
            let event: MethodologyEvent;
            try {
              event = JSON.parse(line.slice(6)) as MethodologyEvent;
            } catch {
              continue;
            }
            if (event.type === 'stage') {
              setStages(prev => [...prev, event.stage]);
            } else if (event.type === 'complete') {
              setDone(true);
            } else if (event.type === 'error') {
              setError(event.error);
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Exécution interrompue');
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [datasetId, running, headers, reset],
  );

  /** Applique les corrections retenues et enregistre une nouvelle version. */
  const applyRemedies = useCallback(
    async (remedies: Remedy[], target: string | null, label?: string) => {
      if (!datasetId || !remedies.length) return null;
      setApplying(true);
      setApplyResult(null);
      try {
        const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/methodology/apply`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ remedies, target, label, save_as_version: true }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);

        const version = payload.version?.version_number;
        setApplyResult(
          `${payload.applied.filter((a: { ok: boolean }) => a.ok).length} correction(s) appliquée(s)`
          + (version ? ` — version ${version} enregistrée` : '')
          + ` — ${payload.shape.rows} lignes × ${payload.shape.columns} colonnes.`,
        );
        return payload;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Application impossible');
        return null;
      } finally {
        setApplying(false);
      }
    },
    [datasetId, headers],
  );

  // Colonnes du dataset : le resume de la liste ne porte qu'un decompte,
  // les noms viennent du detail.
  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}`, { headers: headers() });
        if (!response.ok) return;
        const payload = await response.json();
        // `active_columns` est un décompte, pas une liste : les noms de colonnes
        // se trouvent dans le dictionnaire du profil.
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
  }, [datasetId, headers]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { columns, stages, running, done, error, run, stop, reset, applyRemedies, applying, applyResult };
}
