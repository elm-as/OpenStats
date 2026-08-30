import { useState, useEffect, useRef, useMemo } from 'react';
import { getAvailableAnalyses } from './PipelineTypes';

export function usePipelineSelection(profile: any) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<
    'auto' | 'forecast' | 'regression' | 'classification' | 'exploration'
  >('auto');
  const [smartFeedback, setSmartFeedback] = useState<string | null>(null);

  const [selectedAnalyses, setSelectedAnalyses] = useState<Set<string>>(
    new Set([
      'clean',
      'descriptive',
      'correlations',
      'stationarity',
      'cointegration',
      'timeseries_forecast',
      'timeseries_multivariate',
      'vif',
      'transform',
      'pca',
      'model',
      'explainability',
      'insights',
      'report',
    ])
  );
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const initializedRef = useRef(false);

  const allColumns = useMemo(() => {
    if (!profile) return [];
    const cols = new Set<string>();
    (profile.numeric_cols || []).forEach((c: string) => cols.add(c));
    (profile.categorical_cols || []).forEach((c: string) => cols.add(c));
    (profile.binary_cols || []).forEach((c: string) => cols.add(c));
    (profile.temporal_cols || []).forEach((c: string) => cols.add(c));
    (profile.discrete_cols || []).forEach((c: string) => cols.add(c));
    (profile.id_cols || []).forEach((c: string) => cols.add(c));
    return Array.from(cols);
  }, [profile]);

  const targetStatType = useMemo(() => {
    if (!selectedTarget || !profile) return null;
    return profile.column_types?.[selectedTarget] || 'numeric';
  }, [selectedTarget, profile]);

  const detectedProblem = useMemo(() => {
    if (selectedTaskType !== 'auto') return selectedTaskType;
    if (
      profile?.has_temporal &&
      selectedTarget &&
      targetStatType &&
      ['numeric', 'discrete', 'continu'].includes(targetStatType)
    ) {
      return 'forecast';
    }
    if (
      selectedTarget &&
      (targetStatType === 'binary' || profile?.binary_cols?.includes(selectedTarget))
    ) {
      return 'binary_classification';
    }
    if (selectedTarget && targetStatType === 'categorical') {
      return 'multiclass_classification';
    }
    if (selectedTarget) {
      return 'regression';
    }
    return profile?.problem_type || 'exploration';
  }, [selectedTaskType, profile, selectedTarget, targetStatType]);

  const handleSelectTarget = (col: string | null) => {
    if (!col) {
      setSelectedTarget(null);
      setSelectedTaskType('exploration');
      setSelectedAnalyses(
        new Set(['clean', 'descriptive', 'correlations', 'pca', 'manifold', 'insights', 'report'])
      );
      setSmartFeedback(
        "Mode Exploration activé : focalisé sur les statistiques descriptives, corrélations et l'analyse factorielle (ACP)."
      );
      return;
    }

    setSelectedTarget(col);
    const colType = profile?.column_types?.[col] || 'numeric';
    const isBin = profile?.binary_cols?.includes(col) || colType === 'binary';
    const isCat = profile?.categorical_cols?.includes(col) || colType === 'categorical';
    const isTemp = profile?.temporal_cols?.includes(col) || colType === 'temporal';
    const hasTimeStructure = Boolean(profile?.has_temporal && profile?.temporal_cols?.length > 0);

    if (isTemp) {
      setSelectedTaskType('forecast');
      setSmartFeedback(`La colonne '${col}' est temporelle. Elle servira d'axe temporel pour vos prévisions.`);
    } else if (isBin || isCat) {
      setSelectedTaskType('classification');
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'transform',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback(
        `Cible catégorielle détectée ('${col}'). Activation automatique du pipeline de Classification Supervisée.`
      );
    } else if (hasTimeStructure) {
      setSelectedTaskType('forecast');
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'stationarity',
          'cointegration',
          'timeseries_forecast',
          'timeseries_multivariate',
          'vif',
          'transform',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback(
        `Structure temporelle détectée avec '${profile?.temporal_cols?.[0]}'. Intégration de Stationnarité, Cointégration, ARIMA et VAR/VECM.`
      );
    } else {
      setSelectedTaskType('regression');
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'vif',
          'transform',
          'pca',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback(
        `Cible continue ('${col}') en coupe transversale. Configuration de la Régression ML, VIF et SHAP.`
      );
    }
  };

  const handleSelectTaskType = (
    mode: 'auto' | 'forecast' | 'regression' | 'classification' | 'exploration'
  ) => {
    setSelectedTaskType(mode);
    if (mode === 'forecast') {
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'stationarity',
          'cointegration',
          'timeseries_forecast',
          'timeseries_multivariate',
          'vif',
          'transform',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback('Mode Séries Temporelles sélectionné : stationnarité, cointégration et prévisions activées.');
    } else if (mode === 'classification') {
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'transform',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback('Mode Classification sélectionné : modèles logistiques, arbres et ROC/AUC.');
    } else if (mode === 'regression') {
      setSelectedAnalyses(
        new Set([
          'clean',
          'descriptive',
          'correlations',
          'vif',
          'transform',
          'pca',
          'model',
          'explainability',
          'insights',
          'report',
        ])
      );
      setSmartFeedback('Mode Régression sélectionné : régularisation Ridge/Lasso, Random Forest, VIF et résidus.');
    } else if (mode === 'exploration') {
      setSelectedAnalyses(
        new Set(['clean', 'descriptive', 'correlations', 'pca', 'manifold', 'insights', 'report'])
      );
      setSmartFeedback('Mode Exploration sans cible : réduction de dimensions (ACP) et clustering.');
    }
  };

  useEffect(() => {
    if (profile && !initializedRef.current) {
      if (profile.suggested_target) {
        handleSelectTarget(profile.suggested_target);
      } else {
        setSelectedTaskType('exploration');
      }
      const autoExcluded = [...(profile.id_cols || []), ...(profile.high_missing_cols || [])];
      if (autoExcluded.length > 0) {
        setExcludedColumns(autoExcluded);
      }
      initializedRef.current = true;
    }
  }, [profile]);

  const availableAnalyses = useMemo(
    () => getAvailableAnalyses(profile, selectedTarget),
    [profile, selectedTarget]
  );

  const toggleAnalysis = (key: string) => {
    setSelectedAnalyses(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPreset = (preset: 'all' | 'recommended' | 'minimal') => {
    if (preset === 'all') {
      setSelectedAnalyses(new Set(availableAnalyses.map(a => a.key)));
      setSmartFeedback('Tous les modules activés pour une analyse exhaustive.');
    } else if (preset === 'recommended') {
      setSelectedAnalyses(new Set(availableAnalyses.filter(a => a.recommended).map(a => a.key)));
      setSmartFeedback('Preset optimal recommandé par le moteur statistique appliqué.');
    } else if (preset === 'minimal') {
      setSelectedAnalyses(new Set(['clean', 'descriptive', 'model', 'insights']));
      setSmartFeedback('Pipeline minimal appliqué pour une exécution ultra-rapide.');
    }
  };

  return {
    selectedTarget,
    selectedTaskType,
    smartFeedback,
    selectedAnalyses,
    excludedColumns,
    allColumns,
    detectedProblem,
    availableAnalyses,
    handleSelectTarget,
    handleSelectTaskType,
    toggleAnalysis,
    applyPreset,
  };
}
