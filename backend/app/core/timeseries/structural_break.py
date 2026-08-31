"""
Module de calcul du Test de Rupture Structurelle de Chow.

Permet de tester mathématiquement si les coefficients d'un modèle de régression
linéaire changent significativement avant et après une date ou un point de rupture tau.
Statistique F de Chow :
F = [ (RSS_c - (RSS_1 + RSS_2)) / k ] / [ (RSS_1 + RSS_2) / (N_1 + N_2 - 2k) ]
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

from app.core.timeseries.residual_diagnostics import _sf


def compute_chow_test(
    data: pd.DataFrame,
    target_col: str,
    feature_cols: list[str] | None = None,
    break_point: int | str | None = None,
    date_col: str | None = None,
) -> dict[str, Any]:
    """
    Exécute le test de Chow pour détecter une instabilité structurelle des paramètres.

    Args:
        data: DataFrame avec les données.
        target_col: Nom de la variable dépendante y.
        feature_cols: Liste des variables explicatives X (si None, toutes les numériques restantes).
        break_point: Index (int) ou valeur de date_col (str/int) définissant la scission.
                     Si None, un scan (Supremum Chow test) est effectué pour trouver le point optimal.
        date_col: Colonne temporelle pour repérer le break_point.

    Returns:
        Dictionnaire avec statistique F, p-valeur, break_point identifié, RSS, et conclusion.
    """
    if target_col not in data.columns:
        raise ValueError(f"Colonne cible '{target_col}' introuvable")

    working_df = data.copy()
    if date_col and date_col in working_df.columns:
        try:
            working_df = working_df.sort_values(by=date_col).reset_index(drop=True)
        except Exception:
            pass

    if not feature_cols:
        ignored = {target_col}
        if date_col:
            ignored.add(date_col)
        feature_cols = [c for c in working_df.select_dtypes(include=["number"]).columns if c not in ignored]

    if not feature_cols:
        raise ValueError("Au moins une variable explicative numérique est requise pour le test de Chow")

    clean_data = working_df[[target_col] + feature_cols].dropna().reset_index(drop=True)
    N = len(clean_data)
    k = len(feature_cols) + 1  # Nombre de paramètres avec constante

    if N < 2 * k + 4:
        raise ValueError(f"Taille d'échantillon insuffisante pour le test de Chow (min {2*k + 4} observations, reçu {N})")

    y = clean_data[target_col].values
    X = clean_data[feature_cols].values
    X_const = sm.add_constant(X)

    # 1. Régression globale contrainte (pooled)
    model_pooled = sm.OLS(y, X_const).fit()
    rss_pooled = float(np.sum(model_pooled.resid ** 2))

    # Helper interne pour évaluer un break point index
    def _evaluate_split(split_idx: int) -> tuple[float, float, float, float]:
        if split_idx < k or (N - split_idx) < k:
            return -1.0, 1.0, 0.0, 0.0

        y1, X1 = y[:split_idx], X_const[:split_idx]
        y2, X2 = y[split_idx:], X_const[split_idx:]

        try:
            m1 = sm.OLS(y1, X1).fit()
            m2 = sm.OLS(y2, X2).fit()
            rss1 = float(np.sum(m1.resid ** 2))
            rss2 = float(np.sum(m2.resid ** 2))
            rss_unconstrained = rss1 + rss2

            df1 = k
            df2 = N - 2 * k
            if rss_unconstrained <= 0 or df2 <= 0:
                return -1.0, 1.0, rss1, rss2

            numerator = (rss_pooled - rss_unconstrained) / df1
            denominator = rss_unconstrained / df2
            if numerator < 0:
                return 0.0, 1.0, rss1, rss2

            f_stat = numerator / denominator
            p_val = 1.0 - stats.f.cdf(f_stat, df1, df2)
            return float(f_stat), float(p_val), rss1, rss2
        except Exception:
            return -1.0, 1.0, 0.0, 0.0

    best_idx = None
    best_label = None

    if break_point is not None:
        if isinstance(break_point, int) and break_point < N and not (date_col and str(break_point) in working_df[date_col].astype(str).values):
            best_idx = break_point
        elif date_col and date_col in working_df.columns:
            matches = working_df[working_df[date_col].astype(str) == str(break_point)].index
            if len(matches) > 0:
                best_idx = int(matches[0])
            else:
                try:
                    best_idx = int(break_point)
                except Exception:
                    best_idx = N // 2
        else:
            try:
                best_idx = int(break_point)
            except Exception:
                best_idx = N // 2
    else:
        # Scan (Supremum Chow test) avec trimming 15%
        trim = max(k + 1, int(N * 0.15))
        max_f = -1.0
        for i in range(trim, N - trim):
            f_val, _, _, _ = _evaluate_split(i)
            if f_val > max_f:
                max_f = f_val
                best_idx = i

    if best_idx is None or best_idx < k or (N - best_idx) < k:
        best_idx = N // 2

    f_stat, p_val, rss1, rss2 = _evaluate_split(best_idx)

    # Récupération du label temporel correspondant
    if date_col and date_col in working_df.columns and best_idx < len(working_df):
        val = working_df.iloc[best_idx][date_col]
        if isinstance(val, (int, np.integer)) or (isinstance(val, float) and val.is_integer()):
            best_label = str(int(val))
        else:
            best_label = str(val)
    else:
        best_label = f"Observation #{best_idx}"

    is_significant = bool(p_val < 0.05)
    interpretation = (
        f"Rupture structurelle statistiquement significative à {best_label} (F={f_stat:.3f}, p={p_val:.4f}). "
        f"Les coefficients du modèle diffèrent avant et après cette période."
        if is_significant
        else f"Aucune rupture structurelle significative détectée à {best_label} (F={f_stat:.3f}, p={p_val:.4f}). "
        f"La relation linéaire demeure stable sur l'ensemble de la période."
    )

    return {
        "f_statistic": _sf(f_stat),
        "p_value": _sf(p_val),
        "break_index": best_idx,
        "break_label": best_label,
        "is_significant": is_significant,
        "sample_size": N,
        "n_features": len(feature_cols),
        "rss_pooled": _sf(rss_pooled),
        "rss_sub1": _sf(rss1),
        "rss_sub2": _sf(rss2),
        "interpretation": interpretation,
        "target_col": target_col,
        "feature_cols": feature_cols,
    }
