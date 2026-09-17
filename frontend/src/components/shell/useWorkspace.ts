import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { setCurrentDataset } from '../../store/slices/datasetSlice';
import { useListDatasetsQuery } from '../../store/api';
import type { DatasetSummary } from '../../types';

const STORAGE_KEY = 'openstats_active_dataset';

/**
 * Contexte de travail : le dataset actif suit l'utilisateur d'un écran à l'autre.
 *
 * Trois sources devaient jusqu'ici s'accorder — le paramètre d'URL, le store
 * Redux et le sélecteur local de chaque page. Ce hook en fait une seule :
 * l'URL reste maîtresse quand elle porte un `?dataset=`, sinon on reprend le
 * dernier dataset utilisé.
 */
export function useWorkspace() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading, isFetching, refetch } = useListDatasetsQuery();
  const datasets: DatasetSummary[] = useMemo(() => data?.datasets ?? [], [data]);

  const storeId = useAppSelector(state => state.dataset.currentDatasetId);
  const urlId = searchParams.get('dataset');

  const resolvedId = useMemo(() => {
    const exists = (id: string | null) => Boolean(id && datasets.some(d => d.id === id));
    if (exists(urlId)) return urlId;
    if (exists(storeId)) return storeId;

    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (exists(stored)) return stored;

    return datasets[0]?.id ?? null;
  }, [datasets, urlId, storeId]);

  const active = useMemo(
    () => datasets.find(d => d.id === resolvedId) ?? null,
    [datasets, resolvedId],
  );

  // Aligne le store et le stockage local sur l'identifiant résolu.
  useEffect(() => {
    if (!resolvedId || resolvedId === storeId) return;
    dispatch(setCurrentDataset(resolvedId));
    try {
      localStorage.setItem(STORAGE_KEY, resolvedId);
    } catch {
      /* stockage indisponible : le contexte reste valable pour la session */
    }
  }, [resolvedId, storeId, dispatch]);

  /** Change de dataset en conservant l'écran courant. */
  const selectDataset = useCallback(
    (id: string) => {
      dispatch(setCurrentDataset(id));
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignoré */
      }
      if (urlId !== null) {
        const next = new URLSearchParams(searchParams);
        next.set('dataset', id);
        setSearchParams(next, { replace: true });
      }
    },
    [dispatch, searchParams, setSearchParams, urlId],
  );

  /** Navigue vers un écran en emportant le dataset actif. */
  const openWith = useCallback(
    (path: string) => {
      navigate(resolvedId ? `${path}?dataset=${encodeURIComponent(resolvedId)}` : path);
    },
    [navigate, resolvedId],
  );

  return {
    datasets,
    active,
    activeId: resolvedId,
    isLoading,
    isFetching,
    refetch,
    selectDataset,
    openWith,
    pathname: location.pathname,
  };
}
