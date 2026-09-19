"""
Extraction des résumés statistiques avancés pour les modèles entraînés :
équations OLS, Odds Ratios pour Logit, métadonnées d'arbres, priors LDA.
"""

from __future__ import annotations

import logging
from typing import Any
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)


def _extract_val(container: Any, idx: int, default: float = 0.0) -> float:
    """Extrait une valeur scalaire de manière sûre depuis une Series pandas ou un ndarray numpy."""
    if container is None:
        return default
    try:
        if hasattr(container, "iloc"):
            return float(container.iloc[idx])
        elif hasattr(container, "__getitem__"):
            return float(container[idx])
    except Exception:
        pass
    return default


def _extract_ci(conf_int_obj: Any, row: int, col: int, default: float = 0.0) -> float:
    """Extrait une borne d'intervalle de confiance (2D) de manière sûre."""
    if conf_int_obj is None:
        return default
    try:
        if hasattr(conf_int_obj, "iloc"):
            return float(conf_int_obj.iloc[row, col])
        elif hasattr(conf_int_obj, "__getitem__"):
            return float(conf_int_obj[row][col])
    except Exception:
        pass
    return default


def extract_regression_ols_summary(model, X_train: pd.DataFrame, y_train: pd.Series) -> tuple[dict[str, Any] | None, list[str]]:
    """Extrait l'équation et le tableau de coefficients OLS via statsmodels."""
    warnings: list[str] = []
    try:
        import statsmodels.api as sm

        if isinstance(model, Pipeline):
            preprocessor = model.named_steps.get("preprocessor")
            if preprocessor is not None:
                transformed_data = preprocessor.transform(X_train)
                # Si transform() retourne une matrice sparse
                if hasattr(transformed_data, "toarray"):
                    transformed_data = transformed_data.toarray()
                X_sm = pd.DataFrame(
                    transformed_data,
                    columns=[n.split("__")[-1] for n in preprocessor.get_feature_names_out()],
                    index=y_train.index,
                )
            else:
                X_sm = X_train.copy()
                X_sm.index = y_train.index
        else:
            X_sm = X_train.copy()
            X_sm.index = y_train.index

        X_sm_const = sm.add_constant(X_sm, has_constant="add")
        ols_model = sm.OLS(y_train, X_sm_const).fit()
        # Estimation avec erreurs-types robustes à l'hétéroscédasticité (White / HC1 standard Stata)
        try:
            ols_robust = ols_model.get_robustcov_results(cov_type="HC1")
        except Exception:
            ols_robust = ols_model

        feature_names_ols = list(X_sm.columns)
        conf_int = ols_model.conf_int()
        p_val_0 = _extract_val(ols_model.pvalues, 0)
        p_val_rob_0 = _extract_val(ols_robust.pvalues, 0)

        coefs = [{
            "variable": "Constante (β₀)",
            "coefficient": round(_extract_val(ols_model.params, 0), 6),
            "std_error": round(_extract_val(ols_model.bse, 0), 6),
            "robust_std_error": round(_extract_val(ols_robust.bse, 0), 6),
            "t_statistic": round(_extract_val(ols_model.tvalues, 0), 4),
            "robust_t_statistic": round(_extract_val(ols_robust.tvalues, 0), 4),
            "p_value": round(p_val_0, 6),
            "robust_p_value": round(p_val_rob_0, 6),
            "ci_lower": round(_extract_ci(conf_int, 0, 0), 6),
            "ci_upper": round(_extract_ci(conf_int, 0, 1), 6),
            "significant": bool(p_val_0 < 0.05),
            "robust_significant": bool(p_val_rob_0 < 0.05),
        }]

        for i, fname in enumerate(feature_names_ols):
            idx = i + 1
            p_val_i = _extract_val(ols_model.pvalues, idx)
            p_val_rob_i = _extract_val(ols_robust.pvalues, idx)
            coefs.append({
                "variable": fname,
                "coefficient": round(_extract_val(ols_model.params, idx), 6),
                "std_error": round(_extract_val(ols_model.bse, idx), 6),
                "robust_std_error": round(_extract_val(ols_robust.bse, idx), 6),
                "t_statistic": round(_extract_val(ols_model.tvalues, idx), 4),
                "robust_t_statistic": round(_extract_val(ols_robust.tvalues, idx), 4),
                "p_value": round(p_val_i, 6),
                "robust_p_value": round(p_val_rob_i, 6),
                "ci_lower": round(_extract_ci(conf_int, idx, 0), 6),
                "ci_upper": round(_extract_ci(conf_int, idx, 1), 6),
                "significant": bool(p_val_i < 0.05),
                "robust_significant": bool(p_val_rob_i < 0.05),
            })

        equation_parts = [f"{coefs[0]['coefficient']:.4f}"]
        for c in coefs[1:]:
            sign = "+" if c["coefficient"] >= 0 else "-"
            equation_parts.append(f" {sign} {abs(c['coefficient']):.4f}·{c['variable']}")
        equation = f"Ŷ = {''.join(equation_parts)}"

        summary = {
            "type": "linear_regression",
            "coefficients": coefs,
            "equation": equation,
            "r2_adjusted": round(float(ols_model.rsquared_adj), 6),
            "f_statistic": round(float(ols_model.fvalue), 4) if hasattr(ols_model, "fvalue") and ols_model.fvalue is not None else None,
            "f_pvalue": round(float(ols_model.f_pvalue), 6) if hasattr(ols_model, "f_pvalue") and ols_model.f_pvalue is not None else None,
            "durbin_watson": round(float(sm.stats.stattools.durbin_watson(ols_model.resid)), 4),
            "n_observations": int(ols_model.nobs),
            "df_model": int(ols_model.df_model),
            "df_residuals": int(ols_model.df_resid),
            "aic": round(float(ols_model.aic), 4),
            "bic": round(float(ols_model.bic), 4),
        }
        return summary, warnings
    except Exception as e:
        logger.warning("Impossible d'extraire le résumé OLS: %s", e)
        return None, warnings


def extract_logistic_summary(
    model,
    X_train: pd.DataFrame,
    y_train: pd.Series,
    label_encoder: Any,
    feature_names: list[str],
) -> dict[str, Any]:
    """Extrait les Odds Ratios et statistiques du modèle Logit."""
    try:
        import statsmodels.api as sm

        if isinstance(model, Pipeline):
            preprocessor = model.named_steps.get("preprocessor")
            if preprocessor is not None:
                X_sm = pd.DataFrame(
                    preprocessor.transform(X_train),
                    columns=[n.split("__")[-1] for n in preprocessor.get_feature_names_out()],
                )
            else:
                X_sm = X_train.copy()
        else:
            X_sm = X_train.copy()

        X_sm_const = sm.add_constant(X_sm, has_constant="add")
        y_train_binary = y_train
        if label_encoder is not None and hasattr(label_encoder, "transform"):
            try:
                y_train_binary = label_encoder.transform(y_train)
            except Exception:
                pass

        # statsmodels Logit est exclusivement binaire
        unique_vals = np.unique(y_train_binary)
        if len(unique_vals) != 2:
            raise ValueError(f"Logit statsmodels nécessite exactement 2 classes (reçu: {len(unique_vals)})")

        if not set(unique_vals).issubset({0, 1}):
            y_train_binary = (pd.Series(y_train_binary) == unique_vals[1]).astype(int).to_numpy()

        logit_res = sm.Logit(y_train_binary, X_sm_const).fit(disp=0)
        conf_int = logit_res.conf_int()
        params_val = logit_res.params
        bse_val = logit_res.bse
        pvals = logit_res.pvalues

        odds_ratios = []
        for i, col_name in enumerate(X_sm_const.columns):
            beta = _extract_val(params_val, i)
            or_val = float(np.exp(beta))
            p_v = _extract_val(pvals, i)
            ci_low = float(np.exp(_extract_ci(conf_int, i, 0)))
            ci_high = float(np.exp(_extract_ci(conf_int, i, 1)))
            bse_i = _extract_val(bse_val, i)

            if col_name == "const":
                var_label = "Constante (β₀)"
                interp = "Niveau de base"
            else:
                var_label = col_name
                if or_val > 1.05:
                    pct = (or_val - 1) * 100
                    interp = f"Augmente la cote de {pct:.1f}% (+{pct:.1f}%)"
                elif or_val < 0.95:
                    pct = (1 - or_val) * 100
                    interp = f"Diminue la cote de {pct:.1f}% (-{pct:.1f}%)"
                else:
                    interp = "Effet neutre sur la cote"

            odds_ratios.append({
                "variable": var_label,
                "coefficient": round(beta, 4),
                "odds_ratio": round(or_val, 4),
                "std_error": round(bse_i, 4),
                "p_value": round(p_v, 6),
                "ci_lower_or": round(ci_low, 4),
                "ci_upper_or": round(ci_high, 4),
                "significant": bool(p_v < 0.05),
                "interpretation": interp,
            })

        pseudo_r2 = round(float(1 - (logit_res.llf / logit_res.llnull)), 4) if hasattr(logit_res, "llnull") and logit_res.llnull != 0 else None

        return {
            "type": "logistic_regression",
            "odds_ratios": odds_ratios,
            "pseudo_r2_mcfadden": pseudo_r2,
            "log_likelihood": round(float(logit_res.llf), 2),
            "n_observations": int(logit_res.nobs),
            "aic": round(float(logit_res.aic), 2),
        }
    except Exception as e:
        logger.info("statsmodels Logit non utilisé (ex: multiclasse ou singularité), fallback sklearn: %s", e)
        try:
            inner_clf = model.named_steps.get("model", model[-1]) if isinstance(model, Pipeline) else model
            if hasattr(inner_clf, "coef_"):
                coefs_sk = inner_clf.coef_[0] if inner_clf.coef_.ndim > 1 else inner_clf.coef_
                intercept_sk = float(inner_clf.intercept_[0]) if hasattr(inner_clf, "intercept_") else 0.0
                odds_ratios = [{
                    "variable": "Constante (β₀)",
                    "coefficient": round(intercept_sk, 4),
                    "odds_ratio": round(float(np.exp(intercept_sk)), 4),
                    "interpretation": "Niveau de base",
                    "significant": True,
                }]
                for fname, beta in zip(feature_names, coefs_sk):
                    or_val = float(np.exp(beta))
                    interp = f"Augmente la cote ({or_val:.2f}x)" if or_val > 1 else f"Diminue la cote ({or_val:.2f}x)"
                    odds_ratios.append({
                        "variable": fname,
                        "coefficient": round(float(beta), 4),
                        "odds_ratio": round(or_val, 4),
                        "interpretation": interp,
                        "significant": True,
                    })
                return {"type": "logistic_regression", "odds_ratios": odds_ratios}
        except Exception:
            pass
        return {}


def extract_tree_summary(model, importance: list[dict]) -> dict[str, Any]:
    """Extrait les métadonnées de structure d'arbres et ensembles."""
    try:
        inner_m = model.named_steps.get("model", model[-1]) if isinstance(model, Pipeline) else model
        tree_info: dict[str, Any] = {
            "type": "tree_ensemble",
            "n_features": len(importance),
            "feature_importance_table": importance,
            "top_features": [f["feature"] for f in importance[:3]],
        }
        if hasattr(inner_m, "n_estimators"):
            tree_info["n_estimators"] = int(inner_m.n_estimators)
        if hasattr(inner_m, "max_depth"):
            tree_info["max_depth"] = inner_m.max_depth
        if hasattr(inner_m, "tree_"):
            tree_info["node_count"] = int(inner_m.tree_.node_count)
            tree_info["max_depth_effective"] = int(inner_m.tree_.max_depth)
        return tree_info
    except Exception as e:
        logger.warning("Erreur extraction métadonnées d'arbre: %s", e)
        return {}


def extract_lda_summary(model, importance: list[dict]) -> dict[str, Any]:
    """Extrait les métadonnées LDA."""
    try:
        inner_m = model.named_steps.get("model", model[-1]) if isinstance(model, Pipeline) else model
        if hasattr(inner_m, "means_"):
            return {
                "type": "lda",
                "priors": [round(float(p), 4) for p in getattr(inner_m, "priors_", [])],
                "explained_variance_ratio": [round(float(v), 4) for v in getattr(inner_m, "explained_variance_ratio_", [])],
                "feature_importance_table": importance,
            }
    except Exception:
        pass
    return {}
