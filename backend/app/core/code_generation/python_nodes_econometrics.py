"""
Traduction des noeuds d'econometrie, series temporelles et causalite en Python.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_cols, py_literal
from app.core.code_generation.python_nodes_prep import columns_helper, target_helper

PANDAS = "import pandas as pd"
PLT = "import matplotlib.pyplot as plt"
SM = "import statsmodels.api as sm"


def emit_stationarity(params: dict[str, Any]) -> CodeBlock:
    cols = columns_helper(params, "columns")
    subset = (
        py_cols(cols)
        if cols
        else "list(df.select_dtypes(include='number').columns)[:10]"
    )
    return CodeBlock(
        imports=[PANDAS, "from statsmodels.tsa.stattools import adfuller, kpss"],
        body=[
            "# Tests de stationnarite (ADF et KPSS)",
            f"for col in {subset}:",
            "    _s = pd.to_numeric(df[col], errors='coerce').dropna()",
            "    if len(_s) < 12:",
            "        continue",
            "    _adf = adfuller(_s, autolag='AIC')[1]",
            "    _kpss = kpss(_s, regression='ct', nlags='auto')[1]",
            (
                "    _verdict = 'stationnaire' if (_adf < 0.05 and _kpss > 0.05)"
                " else 'non stationnaire'"
            ),
            (
                "    print(f'{col:20s} ADF p={_adf:.4f}  KPSS p={_kpss:.4f}  ->"
                " {_verdict}')"
            ),
        ],
    )


def emit_cointegration(params: dict[str, Any]) -> CodeBlock:
    cols = columns_helper(params, "columns")
    subset = (
        py_cols(cols)
        if cols
        else "list(df.select_dtypes(include='number').columns)[:5]"
    )
    return CodeBlock(
        imports=[
            PANDAS,
            "from statsmodels.tsa.vector_ar.vecm import coint_johansen",
        ],
        body=[
            "# Test de cointegration de Johansen",
            f"_cols = {subset}",
            "_data = df[_cols].apply(pd.to_numeric, errors='coerce').dropna()",
            "if _data.shape[1] >= 2 and len(_data) > 20:",
            "    _res = coint_johansen(_data, det_order=0, k_ar_diff=1)",
            "    for i, stat in enumerate(_res.lr1):",
            (
                "        print(f'r <= {i} : trace={stat:.3f}  seuil"
                " 5%={_res.cvt[i, 1]:.3f}')"
            ),
            "else:",
            (
                "    print('Cointegration : au moins 2 series et 20 observations"
                " requises.')"
            ),
        ],
    )


def emit_timeseries(params: dict[str, Any]) -> CodeBlock:
    value = target_helper(params)
    date_col = params.get("date_col") or params.get("dateCol")
    steps = int(params.get("forecast_steps", 10) or 10)
    if not value:
        return CodeBlock(
            body=["# Prevision : aucune variable a prevoir configuree."],
            note="serie manquante",
        )
    body = ["# Prevision temporelle (ARIMA)"]
    if date_col:
        body += [
            (
                f"_serie = df.set_index(pd.to_datetime(df[{py_literal(str(date_col))}]))"
                f"[{py_literal(value)}].dropna().sort_index()"
            )
        ]
    else:
        body += [
            f"_serie = pd.to_numeric(df[{py_literal(value)}], errors='coerce').dropna()"
        ]
    body += [
        (
            "# Ordre choisi par AIC, a d fixe par test de racine unitaire (cf."
            " moteur de l'application)"
        ),
        "_d = 0",
        "_test = _serie.copy()",
        "while _d < 2 and adfuller(_test, autolag='AIC')[1] >= 0.05:",
        "    _test = _test.diff().dropna(); _d += 1",
        "_best, _best_aic = (1, _d, 1), float('inf')",
        "_cap = max(1, min(3, (len(_serie) - _d) // 10))",
        "for _p in range(_cap + 1):",
        "    for _q in range(_cap + 1):",
        "        if _p == 0 and _q == 0:",
        "            continue",
        "        try:",
        "            _fit = ARIMA(_serie, order=(_p, _d, _q)).fit()",
        "        except Exception:",
        "            continue",
        "        if _fit.aic < _best_aic:",
        "            _best_aic, _best = _fit.aic, (_p, _d, _q)",
        "print('Ordre retenu :', _best)",
        "_model = ARIMA(_serie, order=_best).fit()",
        f"_prev = _model.get_forecast(steps={steps})",
        "print(_prev.summary_frame())",
    ]
    return CodeBlock(
        imports=[
            PANDAS,
            "from statsmodels.tsa.arima.model import ARIMA",
            "from statsmodels.tsa.stattools import adfuller",
        ],
        body=body,
    )


def emit_multivariate_timeseries(params: dict[str, Any]) -> CodeBlock:
    cols = columns_helper(params, "value_cols", "columns")
    steps = int(params.get("forecast_steps", 10) or 10)
    subset = (
        py_cols(cols)
        if cols
        else "list(df.select_dtypes(include='number').columns)[:5]"
    )
    return CodeBlock(
        imports=[PANDAS, "from statsmodels.tsa.api import VAR"],
        body=[
            "# Modele vectoriel autoregressif (VAR)",
            f"_data = df[{subset}].apply(pd.to_numeric, errors='coerce').dropna()",
            "_stat = _data.diff().dropna()  # differenciation prealable",
            (
                "_model = VAR(_stat).fit(maxlags=min(4, len(_stat) // 10 or 1),"
                " ic='aic')"
            ),
            "print(_model.summary())",
            (
                "print(_model.forecast(_stat.values[-_model.k_ar:],"
                f" steps={steps}))"
            ),
        ],
    )


def emit_survival(params: dict[str, Any]) -> CodeBlock:
    duration = params.get("durationCol") or params.get("duration_col")
    event = params.get("eventCol") or params.get("event_col")
    if not duration or not event:
        return CodeBlock(
            body=[
                "# Analyse de survie : colonnes duree/evenement non"
                " configurees."
            ],
            note="colonnes duree/evenement manquantes",
        )
    return CodeBlock(
        imports=[PANDAS, PLT, "from lifelines import KaplanMeierFitter"],
        body=[
            "# Analyse de survie (Kaplan-Meier)",
            (
                f"_sub = df[[{py_literal(str(duration))},"
                f" {py_literal(str(event))}]]"
                ".dropna()"
            ),
            "_km = KaplanMeierFitter()",
            (
                f"_km.fit(_sub[{py_literal(str(duration))}],"
                f" event_observed=_sub[{py_literal(str(event))}])"
            ),
            "print(_km.median_survival_time_)",
            "_km.plot_survival_function()",
            "plt.title('Courbe de survie'); plt.tight_layout(); plt.show()",
        ],
    )


def emit_causal(params: dict[str, Any]) -> CodeBlock:
    treat = params.get("treatmentCol") or params.get("treatment_col")
    outcome = params.get("outcomeCol") or params.get("outcome_col")
    period = params.get("timeCol") or params.get("time_col")
    if not (treat and outcome and period):
        return CodeBlock(
            body=[
                "# Inference causale : colonnes"
                " traitement/resultat/periode non configurees."
            ],
            note="colonnes DiD manquantes",
        )
    return CodeBlock(
        imports=[PANDAS, SM],
        body=[
            "# Inference causale : difference des differences",
            (
                f"_sub = df[[{py_literal(str(outcome))}, {py_literal(str(treat))},"
                f" {py_literal(str(period))}]]"
                ".dropna().copy()"
            ),
            (
                f"_sub['_interaction'] = _sub[{py_literal(str(treat))}] *"
                f" _sub[{py_literal(str(period))}]"
            ),
            (
                f"_X = sm.add_constant(_sub[[{py_literal(str(treat))},"
                f" {py_literal(str(period))}, '_interaction']])"
            ),
            f"_did = sm.OLS(_sub[{py_literal(str(outcome))}], _X).fit()",
            "print(_did.summary())",
            "print('Effet causal (ATT) :', round(_did.params['_interaction'], 6))",
        ],
    )


def emit_hypothesis(params: dict[str, Any]) -> CodeBlock:
    group = params.get("groupCol") or params.get("group_col")
    value = target_helper(params) or params.get("valueCol")
    if not (group and value):
        return CodeBlock(
            body=["# Test d'hypothese : colonnes groupe/valeur non configurees."],
            note="colonnes de test manquantes",
        )
    return CodeBlock(
        imports=[PANDAS, "from scipy import stats"],
        body=[
            "# Comparaison de groupes",
            (
                f"_groupes = [g[{py_literal(str(value))}].dropna().values "
                f"for _, g in df[[{py_literal(str(group))},"
                f" {py_literal(str(value))}]]"
                ".dropna()"
                f".groupby({py_literal(str(group))}, observed=True)]"
            ),
            "_groupes = [g for g in _groupes if len(g) >= 3]",
            "if len(_groupes) == 2:",
            (
                "    _stat, _p = stats.ttest_ind(_groupes[0], _groupes[1],"
                " equal_var=False)"
            ),
            "    print(f'Test t de Welch : t={_stat:.4f}  p={_p:.4g}')",
            "elif len(_groupes) > 2:",
            "    _stat, _p = stats.f_oneway(*_groupes)",
            "    print(f'ANOVA : F={_stat:.4f}  p={_p:.4g}')",
            "else:",
            "    print('Pas assez de groupes exploitables.')",
        ],
    )
