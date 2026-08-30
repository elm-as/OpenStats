"""
Module de préchargement synchrone des dépendances lourdes au démarrage du serveur.
Évite les erreurs de circular import concourantes (ex: sklearn.base.clone) lors des
exécutions multi-threadées de nœuds Canvas dans ThreadPoolExecutor.
"""

import sys
import logging

def preload_heavy_modules(logger: logging.Logger | None = None) -> None:
    """
    Pré-charge les principaux sous-modules scikit-learn, scipy, statsmodels et core
    sur le thread principal durant l'initialisation de Flask.
    """
    if logger:
        logger.info("Préchargement des modules ML/statistiques lourds pour le Canvas...")

    # 1. Scikit-Learn
    try:
        import sklearn
        import sklearn.base
        import sklearn.utils
        import sklearn.preprocessing
        import sklearn.decomposition
        import sklearn.linear_model
        import sklearn.ensemble
        import sklearn.tree
        import sklearn.neighbors
        import sklearn.svm
        import sklearn.cluster
        import sklearn.metrics
        import sklearn.pipeline
        import sklearn.impute
        import sklearn.compose
        import sklearn.model_selection
        import sklearn.discriminant_analysis
        import sklearn.exceptions
    except Exception as exc:
        if logger:
            logger.warning("Avertissement préchargement sklearn: %s", exc)

    # 2. Scipy & Statsmodels
    try:
        import scipy
        import scipy.stats
        import scipy.cluster
        import scipy.spatial
        import scipy.optimize
        import scipy.linalg
        import statsmodels.api
        import statsmodels.tsa.stattools
        import statsmodels.tsa.api
    except Exception as exc:
        if logger:
            logger.warning("Avertissement préchargement scipy/statsmodels: %s", exc)

    # 3. Core application modules
    try:
        import app.core.modeling
        import app.core.factor_analysis
        import app.core.timeseries
        import app.core.cleaning
        import app.core.analysis
    except Exception as exc:
        if logger:
            logger.warning("Avertissement préchargement app.core: %s", exc)

    if logger:
        logger.info("Préchargement des modules terminé avec succès.")
