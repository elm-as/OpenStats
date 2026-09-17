"""
Traduction des noeuds du canvas en blocs de code Python.

Regle de fidelite : chaque bloc reproduit ce que le moteur de l'application
calcule reellement, avec les memes parametres. Quand un noeud est parametre
(actions de nettoyage, methode de correlation, cle de transformation), le code
genere lit ces parametres au lieu d'appliquer un traitement par defaut.

Chaque bloc declare ses imports : l'assembleur les emet en tete, ce qui supprime
les `NameError` du generateur historique.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_cols, py_literal

PANDAS = "import pandas as pd"
NUMPY = "import numpy as np"
PLT = "import matplotlib.pyplot as plt"
SNS = "import seaborn as sns"
SM = "import statsmodels.api as sm"


def loader(dataset_name: str) -> CodeBlock:
    """Chargement du jeu de donnees, selon l'extension reelle du fichier."""
    extension = dataset_name.rsplit(".", 1)[-1].lower() if "." in dataset_name else "csv"
    name = py_literal(dataset_name)

    if extension in ("xlsx", "xls"):
        call, extra = f"pd.read_excel({name})", "import openpyxl  # moteur de lecture Excel"
    elif extension == "parquet":
        call, extra = f"pd.read_parquet({name})", "import pyarrow  # moteur Parquet"
    elif extension == "json":
        call, extra = f"pd.read_json({name})", ""
    elif extension == "tsv":
        call, extra = f"pd.read_csv({name}, sep='\\t')", ""
    else:
        call, extra = f"pd.read_csv({name})", ""

    return CodeBlock(
        imports=[PANDAS] + ([extra] if extra else []),
        body=[
            "# Chargement du jeu de donnees",
            f"df = {call}",
            "print(f'Dataset : {df.shape[0]} lignes, {df.shape[1]} colonnes')",
        ],
    )


def _columns(params: dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        value = params.get(key)
        if isinstance(value, list) and value:
            return [str(v) for v in value]
        if isinstance(value, str) and value:
            return [value]
    return []


def _target(params: dict[str, Any]) -> str | None:
    for key in ("targetCol", "target_col", "target", "value_col", "valueCol"):
        value = params.get(key)
        if isinstance(value, str) and value:
            return value
    return None


def emit(node_type: str, params: dict[str, Any], dataset_name: str) -> CodeBlock:
    """Bloc de code Python pour un noeud. `supported=False` si non traduisible."""
    handler = _HANDLERS.get(node_type)
    if handler is None:
        return CodeBlock(
            body=[
                f"# NON TRADUIT : le noeud '{node_type}' n'a pas d'equivalent Python.",
                f"raise NotImplementedError({py_literal(f'Noeud non traduit : {node_type}')})",
            ],
            supported=False,
            note=f"aucune traduction Python pour '{node_type}'",
        )
    return handler(params)


# ── Preparation ──────────────────────────────────────────────────────────

def _typing(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[PANDAS], body=[
        "# Inference et conversion des types",
        "df = df.infer_objects()",
        "for col in df.select_dtypes(include=['object', 'string']).columns:",
        "    df[col] = df[col].astype('category')",
        "print(df.dtypes)",
    ])


def _cleaning(params: dict[str, Any]) -> CodeBlock:
    """Reproduit `_exec_clean` : seules les actions demandees sont appliquees."""
    actions = params.get("actions", [])
    if isinstance(actions, str):
        actions = [a.strip() for a in actions.split(",") if a.strip()]
    actions = [str(a) for a in actions]

    body = [f"# Nettoyage — actions du pipeline : {', '.join(actions) or 'aucune'}"]

    if "remove_duplicates" in actions:
        body += [
            "_avant = len(df)",
            "df = df.drop_duplicates()",
            "print(f'Doublons retires : {_avant - len(df)}')",
        ]

    for action, key, label in (
        ("drop_high_missing_cols", "high_missing_cols", "colonnes trop lacunaires"),
        ("drop_constant_cols", "constant_cols", "colonnes constantes"),
    ):
        if action in actions:
            cols = _columns(params, key)
            body += [
                f"_a_retirer = [c for c in {py_cols(cols)} if c in df.columns]",
                "df = df.drop(columns=_a_retirer)",
                f"print(f'{label} retirees : {{_a_retirer}}')",
            ]

    if "impute_missing" in actions:
        body += [
            "# Imputation : mediane pour les numeriques, mode pour les qualitatives",
            "_impute = 0",
            "for col in df.columns:",
            "    if df[col].isna().any():",
            "        if pd.api.types.is_numeric_dtype(df[col]):",
            "            _valeur = df[col].median()",
            "        else:",
            "            _mode = df[col].mode()",
            "            _valeur = _mode.iloc[0] if not _mode.empty else 'missing'",
            "        _impute += int(df[col].isna().sum())",
            "        df[col] = df[col].fillna(_valeur)",
            "print(f'Valeurs imputees : {_impute}')",
        ]

    if len(body) == 1:
        body.append("print('Aucune action de nettoyage configuree.')")
    body.append("print(f'Apres nettoyage : {df.shape[0]} lignes, {df.shape[1]} colonnes')")
    return CodeBlock(imports=[PANDAS], body=body)


def _transform(params: dict[str, Any]) -> CodeBlock:
    """Applique les transformations declarees, en reproduisant le catalogue."""
    transforms = params.get("transforms")
    if not isinstance(transforms, list) or not transforms:
        key = params.get("transform") or params.get("method")
        cols = _columns(params, "columns", "column")
        transforms = [{"column": c, "transform": key} for c in cols] if key and cols else []

    if not transforms:
        return CodeBlock(imports=[PANDAS], body=[
            "# Aucune transformation configuree sur ce noeud.",
            "print('Transformations : rien a appliquer.')",
        ])

    imports = [PANDAS, NUMPY]
    body = ["# Transformations - repliquent exactement app/core/transformations_apply.py"]
    unknown: list[str] = []

    for item in transforms:
        if not isinstance(item, dict):
            continue
        column = item.get("column")
        key = str(item.get("transform") or item.get("key") or "")
        if not column:
            continue
        params_item = item.get("params") or {}
        lines, needed = _transform_lines(str(column), key, params_item)
        if lines is None:
            unknown.append(key)
            continue
        imports.extend(needed)
        body.append(f"# {column} : {key}")
        body.extend(lines)

    if unknown:
        body.append(
            f"# Transformations sans equivalent genere, NON appliquees : {sorted(set(unknown))}")
    body.append("print(df.describe().T)")

    return CodeBlock(
        imports=imports, body=body,
        supported=not unknown,
        note=(f"transformations non traduites : {sorted(set(unknown))}" if unknown else ""),
    )


def _transform_lines(column: str, key: str,
                     params: dict[str, Any]) -> tuple[list[str] | None, list[str]]:
    """Lignes reproduisant une transformation du catalogue, plus ses imports.

    Les decalages appliques par le moteur aux series negatives (log, log1p,
    sqrt, boxcox) sont reproduits a l'identique : sans eux, le script produit
    des NaN la ou l'application produit des valeurs.
    """
    c = py_literal(column)
    s = f"df[{c}]"

    simple = {
        "square": f"{s} ** 2",
        "reciprocal": f"1.0 / {s}.replace(0, np.nan)",
        "standardize": f"({s} - {s}.mean()) / ({s}.std() if {s}.std() != 0 else 1)",
        "minmax": (f"({s} - {s}.min()) / (({s}.max() - {s}.min()) "
                   f"if ({s}.max() - {s}.min()) != 0 else 1)"),
        "robust_scale": (f"({s} - {s}.median()) / "
                         f"(({s}.quantile(0.75) - {s}.quantile(0.25)) "
                         f"if ({s}.quantile(0.75) - {s}.quantile(0.25)) != 0 else 1)"),
        "diff2": f"{s}.diff().diff()",
        "rank": f"{s}.rank(method='average', na_option='keep')",
    }
    if key in simple:
        return [f"df[{c}] = {simple[key]}"], []

    # Transformations parametrees
    if key == "diff":
        order = int(params.get("order", 1) or 1)
        return [f"df[{c}] = {s}.diff(periods={order})"], []
    if key == "seasonal_diff":
        period = int(params.get("period", 12) or 12)
        return [f"df[{c}] = {s}.diff(periods={period})"], []
    if key == "lag":
        lag = int(params.get("lag", 1) or 1)
        return [f"df[{c}] = {s}.shift(periods={lag})"], []
    if key == "pct_change":
        periods = int(params.get("periods", 1) or 1)
        return [f"df[{c}] = {s}.pct_change(periods={periods})"], []
    if key == "rolling_mean":
        window = int(params.get("window", 3) or 3)
        min_periods = int(params.get("min_periods", 1) or 1)
        return [f"df[{c}] = {s}.rolling(window={window}, min_periods={min_periods}).mean()"], []
    if key == "rolling_std":
        window = int(params.get("window", 3) or 3)
        min_periods = int(params.get("min_periods", 2) or 2)
        return [f"df[{c}] = {s}.rolling(window={window}, min_periods={min_periods}).std()"], []
    if key == "winsorize":
        lower = float(params.get("lower", 0.01) or 0.01)
        upper = float(params.get("upper", 0.99) or 0.99)
        return [f"df[{c}] = {s}.clip(lower={s}.quantile({lower}), upper={s}.quantile({upper}))"], []

    # Transformations a decalage conditionnel
    if key in ("log", "log1p", "sqrt"):
        condition = f"({s} <= 0).any()" if key == "log" else f"({s} < 0).any()"
        offset = "abs(_min)" if key == "sqrt" else "abs(_min) + 1"
        function = {"log": "np.log10", "log1p": "np.log1p", "sqrt": "np.sqrt"}[key]
        return ([
            f"_min = {s}.min()",
            f"_shift = ({offset}) if {condition} else 0",
            f"df[{c}] = {function}({s} + _shift)",
        ], [])

    if key == "boxcox":
        return ([
            f"_vals = {s}.dropna()",
            "_shift = (abs(_vals.min()) + 1) if (_vals <= 0).any() else 0",
            "_out, _lam = boxcox((_vals + _shift).values)",
            f"df[{c}] = pd.Series(np.nan, index=df.index)",
            f"df.loc[_vals.index, {c}] = _out",
            "print(f'  lambda Box-Cox = {_lam:.6f}')",
        ], ["from scipy.stats import boxcox"])

    if key == "yeo_johnson":
        return ([
            f"_vals = {s}.dropna()",
            "_out, _lam = yeojohnson(_vals.values)",
            f"df[{c}] = pd.Series(np.nan, index=df.index)",
            f"df.loc[_vals.index, {c}] = _out",
            "print(f'  lambda Yeo-Johnson = {_lam:.6f}')",
        ], ["from scipy.stats import yeojohnson"])

    if key == "detrend":
        return ([
            f"_vals = {s}.dropna()",
            f"df[{c}] = pd.Series(np.nan, index=df.index)",
            f"df.loc[_vals.index, {c}] = detrend(_vals.values, type='linear')",
        ], ["from scipy.signal import detrend"])

    return None, []


# ── Description ──────────────────────────────────────────────────────────

def _descriptive_numeric(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(imports=[PANDAS], body=[
        "# Statistiques descriptives (variables numeriques)",
        f"_num = {subset}",
        "_desc = _num.describe().T",
        "_desc['skewness'] = _num.skew()",
        "_desc['kurtosis'] = _num.kurtosis()",
        "print(_desc)",
    ])


def _descriptive_categorical(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(exclude='number')"
    return CodeBlock(imports=[PANDAS], body=[
        "# Statistiques descriptives (variables qualitatives)",
        f"for col in {subset}.columns:",
        "    print(f'--- {col} ---')",
        "    print(df[col].value_counts(dropna=False).head(20))",
    ])


def _correlation(params: dict[str, Any]) -> CodeBlock:
    method = str(params.get("method", "pearson"))
    cols = _columns(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(imports=[PANDAS, PLT, SNS], body=[
        f"# Matrice de correlation ({method})",
        f"_corr = {subset}.corr(method={py_literal(method)})",
        "print(_corr)",
        "plt.figure(figsize=(9, 7))",
        "sns.heatmap(_corr, annot=True, fmt='.2f', cmap='coolwarm', center=0)",
        f"plt.title({py_literal(f'Matrice de correlation ({method})')})",
        "plt.tight_layout()",
        "plt.show()",
    ])


def _vif(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[PANDAS, SM, "from statsmodels.stats.outliers_influence import variance_inflation_factor"],
        body=[
            "# Facteurs d'inflation de la variance (multicolinearite)",
            "_num = df.select_dtypes(include='number').dropna()",
            "_design = sm.add_constant(_num)",
            "_vif = pd.DataFrame({",
            "    'variable': _design.columns,",
            "    'VIF': [variance_inflation_factor(_design.values, i) for i in range(_design.shape[1])],",
            "})",
            "print(_vif[_vif['variable'] != 'const'].sort_values('VIF', ascending=False))",
        ])


# ── Analyses ─────────────────────────────────────────────────────────────

def _pca(params: dict[str, Any]) -> CodeBlock:
    n_components = int(params.get("n_components", 2) or 2)
    cols = _columns(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(
        imports=[PANDAS, PLT, "from sklearn.decomposition import PCA",
                 "from sklearn.preprocessing import StandardScaler"],
        body=[
            "# Analyse en composantes principales",
            f"_X = {subset}.dropna()",
            "_Xs = StandardScaler().fit_transform(_X)",
            f"_pca = PCA(n_components={n_components})",
            "_scores = _pca.fit_transform(_Xs)",
            "print('Variance expliquee :', _pca.explained_variance_ratio_)",
            "plt.figure(figsize=(7, 6))",
            "plt.scatter(_scores[:, 0], _scores[:, 1], alpha=0.6)",
            "plt.xlabel('CP1'); plt.ylabel('CP2'); plt.title('Projection ACP')",
            "plt.tight_layout(); plt.show()",
        ])


def _manifold(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[PANDAS, PLT, "from sklearn.manifold import TSNE",
                 "from sklearn.preprocessing import StandardScaler"],
        body=[
            "# Projection non lineaire (t-SNE)",
            "_X = df.select_dtypes(include='number').dropna()",
            "_perplexity = min(30, max(5, len(_X) // 4))",
            "_emb = TSNE(n_components=2, perplexity=_perplexity, init='pca', random_state=0)"
            ".fit_transform(StandardScaler().fit_transform(_X))",
            "plt.figure(figsize=(7, 6))",
            "plt.scatter(_emb[:, 0], _emb[:, 1], alpha=0.6)",
            "plt.title('Projection t-SNE'); plt.tight_layout(); plt.show()",
        ])


def _cluster(params: dict[str, Any]) -> CodeBlock:
    k = int(params.get("n_clusters", params.get("k", 3)) or 3)
    return CodeBlock(
        imports=[PANDAS, "from sklearn.cluster import KMeans",
                 "from sklearn.preprocessing import StandardScaler",
                 "from sklearn.metrics import silhouette_score"],
        body=[
            f"# Classification non supervisee (K-Means, k={k})",
            "_X = df.select_dtypes(include='number').dropna()",
            "_Xs = StandardScaler().fit_transform(_X)",
            f"_km = KMeans(n_clusters={k}, n_init=10, random_state=0).fit(_Xs)",
            "df.loc[_X.index, 'cluster'] = _km.labels_",
            "print('Silhouette :', round(silhouette_score(_Xs, _km.labels_), 4))",
            "print(df['cluster'].value_counts())",
        ])


def _regression(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Regression : aucune variable cible configuree."],
                         note="cible manquante")
    features = _columns(params, "features", "columns")
    selection = (f"df[{py_cols(features)}]" if features
                 else f"df.select_dtypes(include='number').drop(columns=[{py_literal(target)}], errors='ignore')")
    return CodeBlock(
        imports=[PANDAS, SM, "from sklearn.model_selection import cross_val_score",
                 "from sklearn.ensemble import RandomForestRegressor"],
        body=[
            f"# Regression sur {target}",
            f"_frame = pd.concat([{selection}, df[[{py_literal(target)}]]], axis=1).dropna()",
            f"_y = _frame[{py_literal(target)}]",
            f"_X = _frame.drop(columns=[{py_literal(target)}])",
            "_ols = sm.OLS(_y, sm.add_constant(_X)).fit()",
            "print(_ols.summary())",
            "_rf = RandomForestRegressor(n_estimators=200, random_state=0)",
            "print('R2 validation croisee :', cross_val_score(_rf, _X, _y, cv=5, scoring='r2').mean().round(4))",
        ])


def _classification(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Classification : aucune variable cible configuree."],
                         note="cible manquante")
    features = _columns(params, "features", "columns")
    selection = (f"df[{py_cols(features)}]" if features
                 else f"df.select_dtypes(include='number').drop(columns=[{py_literal(target)}], errors='ignore')")
    return CodeBlock(
        imports=[PANDAS, "from sklearn.ensemble import RandomForestClassifier",
                 "from sklearn.model_selection import train_test_split",
                 "from sklearn.metrics import classification_report, roc_auc_score"],
        body=[
            f"# Classification de {target}",
            f"_frame = pd.concat([{selection}, df[[{py_literal(target)}]]], axis=1).dropna()",
            f"_y = _frame[{py_literal(target)}].astype('category').cat.codes",
            f"_X = _frame.drop(columns=[{py_literal(target)}])",
            "_Xtr, _Xte, _ytr, _yte = train_test_split(_X, _y, test_size=0.25, random_state=0, stratify=_y)",
            "_clf = RandomForestClassifier(n_estimators=200, random_state=0).fit(_Xtr, _ytr)",
            "print(classification_report(_yte, _clf.predict(_Xte)))",
            "if _y.nunique() == 2:",
            "    print('AUC :', round(roc_auc_score(_yte, _clf.predict_proba(_Xte)[:, 1]), 4))",
        ])


def _explainability(params: dict[str, Any]) -> CodeBlock:
    target = _target(params)
    if not target:
        return CodeBlock(body=["# Explicabilite : aucune variable cible configuree."],
                         note="cible manquante")
    return CodeBlock(
        imports=[PANDAS, PLT, "import shap", "from sklearn.ensemble import RandomForestRegressor"],
        body=[
            f"# Explicabilite SHAP pour {target}",
            f"_frame = df.select_dtypes(include='number').dropna()",
            f"_y = _frame[{py_literal(target)}]",
            f"_X = _frame.drop(columns=[{py_literal(target)}], errors='ignore')",
            "_model = RandomForestRegressor(n_estimators=150, random_state=0).fit(_X, _y)",
            "_values = shap.TreeExplainer(_model).shap_values(_X)",
            "shap.summary_plot(_values, _X, show=False)",
            "plt.tight_layout(); plt.show()",
        ])


# ── Series temporelles ───────────────────────────────────────────────────

def _stationarity(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
    subset = py_cols(cols) if cols else "list(df.select_dtypes(include='number').columns)[:10]"
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
            "    _verdict = 'stationnaire' if (_adf < 0.05 and _kpss > 0.05) else 'non stationnaire'",
            "    print(f'{col:20s} ADF p={_adf:.4f}  KPSS p={_kpss:.4f}  -> {_verdict}')",
        ])


def _cointegration(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "columns")
    subset = py_cols(cols) if cols else "list(df.select_dtypes(include='number').columns)[:5]"
    return CodeBlock(
        imports=[PANDAS, "from statsmodels.tsa.vector_ar.vecm import coint_johansen"],
        body=[
            "# Test de cointegration de Johansen",
            f"_cols = {subset}",
            "_data = df[_cols].apply(pd.to_numeric, errors='coerce').dropna()",
            "if _data.shape[1] >= 2 and len(_data) > 20:",
            "    _res = coint_johansen(_data, det_order=0, k_ar_diff=1)",
            "    for i, stat in enumerate(_res.lr1):",
            "        print(f'r <= {i} : trace={stat:.3f}  seuil 5%={_res.cvt[i, 1]:.3f}')",
            "else:",
            "    print('Cointegration : au moins 2 series et 20 observations requises.')",
        ])


def _timeseries(params: dict[str, Any]) -> CodeBlock:
    value = _target(params)
    date_col = params.get("date_col") or params.get("dateCol")
    steps = int(params.get("forecast_steps", 10) or 10)
    if not value:
        return CodeBlock(body=["# Prevision : aucune variable a prevoir configuree."],
                         note="serie manquante")
    body = ["# Prevision temporelle (ARIMA)"]
    if date_col:
        body += [f"_serie = df.set_index(pd.to_datetime(df[{py_literal(str(date_col))}]))"
                 f"[{py_literal(value)}].dropna().sort_index()"]
    else:
        body += [f"_serie = pd.to_numeric(df[{py_literal(value)}], errors='coerce').dropna()"]
    body += [
        "# Ordre choisi par AIC, a d fixe par test de racine unitaire (cf. moteur de l'application)",
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
        imports=[PANDAS, "from statsmodels.tsa.arima.model import ARIMA",
                 "from statsmodels.tsa.stattools import adfuller"],
        body=body)


def _multivariate_timeseries(params: dict[str, Any]) -> CodeBlock:
    cols = _columns(params, "value_cols", "columns")
    steps = int(params.get("forecast_steps", 10) or 10)
    subset = py_cols(cols) if cols else "list(df.select_dtypes(include='number').columns)[:5]"
    return CodeBlock(
        imports=[PANDAS, "from statsmodels.tsa.api import VAR"],
        body=[
            "# Modele vectoriel autoregressif (VAR)",
            f"_data = df[{subset}].apply(pd.to_numeric, errors='coerce').dropna()",
            "_stat = _data.diff().dropna()  # differenciation prealable",
            "_model = VAR(_stat).fit(maxlags=min(4, len(_stat) // 10 or 1), ic='aic')",
            "print(_model.summary())",
            f"print(_model.forecast(_stat.values[-_model.k_ar:], steps={steps}))",
        ])


def _survival(params: dict[str, Any]) -> CodeBlock:
    duration = params.get("durationCol") or params.get("duration_col")
    event = params.get("eventCol") or params.get("event_col")
    if not duration or not event:
        return CodeBlock(body=["# Analyse de survie : colonnes duree/evenement non configurees."],
                         note="colonnes duree/evenement manquantes")
    return CodeBlock(
        imports=[PANDAS, PLT, "from lifelines import KaplanMeierFitter"],
        body=[
            "# Analyse de survie (Kaplan-Meier)",
            f"_sub = df[[{py_literal(str(duration))}, {py_literal(str(event))}]].dropna()",
            "_km = KaplanMeierFitter()",
            f"_km.fit(_sub[{py_literal(str(duration))}], event_observed=_sub[{py_literal(str(event))}])",
            "print(_km.median_survival_time_)",
            "_km.plot_survival_function()",
            "plt.title('Courbe de survie'); plt.tight_layout(); plt.show()",
        ])


def _causal(params: dict[str, Any]) -> CodeBlock:
    treat = params.get("treatmentCol") or params.get("treatment_col")
    outcome = params.get("outcomeCol") or params.get("outcome_col")
    period = params.get("timeCol") or params.get("time_col")
    if not (treat and outcome and period):
        return CodeBlock(body=["# Inference causale : colonnes traitement/resultat/periode non configurees."],
                         note="colonnes DiD manquantes")
    return CodeBlock(imports=[PANDAS, SM], body=[
        "# Inference causale : difference des differences",
        f"_sub = df[[{py_literal(str(outcome))}, {py_literal(str(treat))}, {py_literal(str(period))}]].dropna().copy()",
        f"_sub['_interaction'] = _sub[{py_literal(str(treat))}] * _sub[{py_literal(str(period))}]",
        f"_X = sm.add_constant(_sub[[{py_literal(str(treat))}, {py_literal(str(period))}, '_interaction']])",
        f"_did = sm.OLS(_sub[{py_literal(str(outcome))}], _X).fit()",
        "print(_did.summary())",
        "print('Effet causal (ATT) :', round(_did.params['_interaction'], 6))",
    ])


def _hypothesis(params: dict[str, Any]) -> CodeBlock:
    group = params.get("groupCol") or params.get("group_col")
    value = _target(params) or params.get("valueCol")
    if not (group and value):
        return CodeBlock(body=["# Test d'hypothese : colonnes groupe/valeur non configurees."],
                         note="colonnes de test manquantes")
    return CodeBlock(imports=[PANDAS, "from scipy import stats"], body=[
        "# Comparaison de groupes",
        f"_groupes = [g[{py_literal(str(value))}].dropna().values "
        f"for _, g in df[[{py_literal(str(group))}, {py_literal(str(value))}]].dropna()"
        f".groupby({py_literal(str(group))}, observed=True)]",
        "_groupes = [g for g in _groupes if len(g) >= 3]",
        "if len(_groupes) == 2:",
        "    _stat, _p = stats.ttest_ind(_groupes[0], _groupes[1], equal_var=False)",
        "    print(f'Test t de Welch : t={_stat:.4f}  p={_p:.4g}')",
        "elif len(_groupes) > 2:",
        "    _stat, _p = stats.f_oneway(*_groupes)",
        "    print(f'ANOVA : F={_stat:.4f}  p={_p:.4g}')",
        "else:",
        "    print('Pas assez de groupes exploitables.')",
    ])


def _sql(params: dict[str, Any]) -> CodeBlock:
    query = str(params.get("query") or "SELECT * FROM df")
    return CodeBlock(imports=["import duckdb"], body=[
        "# Requete SQL via DuckDB",
        f"_requete = {py_literal(query)}",
        "df = duckdb.query(_requete).to_df()",
        "print(df.head())",
    ])


def _python(params: dict[str, Any]) -> CodeBlock:
    code = str(params.get("code") or "").strip()
    if not code:
        return CodeBlock(body=["# Noeud Python : aucun code fourni."])
    return CodeBlock(imports=[PANDAS, NUMPY],
                     body=["# Code Python personnalise (repris tel quel du canvas)"] + code.splitlines())


def _chart(params: dict[str, Any]) -> CodeBlock:
    x = params.get("x_col") or params.get("xCol")
    ys = _columns(params, "y_cols", "yCols", "y_col")
    kind = str(params.get("chart_type") or params.get("chartType") or "line")
    if not (x and ys):
        return CodeBlock(imports=[PLT], body=[
            "# Graphique : axes non configures.",
            "df.select_dtypes(include='number').hist(figsize=(11, 8)); plt.tight_layout(); plt.show()",
        ])
    mapping = {"line": "line", "bar": "bar", "scatter": "scatter", "area": "area"}
    return CodeBlock(imports=[PANDAS, PLT], body=[
        f"# Graphique {kind}",
        f"_plot = df.plot(kind={py_literal(mapping.get(kind, 'line'))}, "
        f"x={py_literal(str(x))}, y={py_cols(ys)}, figsize=(10, 5))",
        "plt.tight_layout(); plt.show()",
    ])


def _insights(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(imports=[PANDAS], body=[
        "# Synthese : reperes descriptifs et correlations dominantes",
        "print(df.describe(include='all').T)",
        "_num = df.select_dtypes(include='number')",
        "if _num.shape[1] >= 2:",
        "    _c = _num.corr().abs().unstack().sort_values(ascending=False)",
        "    _c = _c[_c < 0.999].drop_duplicates()",
        "    print('Liaisons les plus fortes :'); print(_c.head(10))",
    ])


def _output(params: dict[str, Any]) -> CodeBlock:
    fmt = str(params.get("format", "csv")).lower()
    if fmt in ("pdf", "docx", "pptx"):
        return CodeBlock(imports=[PANDAS], body=[
            f"# Export : le rapport {fmt.upper()} est produit par l'application.",
            "# Le script exporte ici les donnees et les statistiques equivalentes.",
            "df.to_csv('resultat.csv', index=False)",
            "df.describe().T.to_csv('statistiques.csv')",
            "print('Donnees exportees : resultat.csv, statistiques.csv')",
        ], note=f"le rendu {fmt.upper()} n'est pas reproductible hors application")
    return CodeBlock(imports=[PANDAS], body=[
        "# Export du jeu de donnees",
        "df.to_csv('resultat.csv', index=False)",
        "print('Exporte : resultat.csv')",
    ])


_HANDLERS = {
    "typing": _typing,
    "cleaning": _cleaning, "clean": _cleaning,
    "transform": _transform, "transform_recommend": _transform,
    "stationarization_transform": _transform,
    "descriptiveNumeric": _descriptive_numeric, "descriptive": _descriptive_numeric,
    "descriptiveCategorical": _descriptive_categorical,
    "correlation": _correlation, "correlations": _correlation,
    "vif": _vif,
    "pca": _pca, "manifold": _manifold, "cluster": _cluster, "clustering": _cluster,
    "regression": _regression, "classification": _classification, "model": _regression,
    "explainability": _explainability,
    "testStationarity": _stationarity, "stationarity": _stationarity,
    "timeseries_stationarity": _stationarity,
    "cointegration": _cointegration, "timeseries_cointegration": _cointegration,
    "timeseries": _timeseries, "timeseries_forecast": _timeseries,
    "multivariateTimeseries": _multivariate_timeseries,
    "timeseries_multivariate": _multivariate_timeseries,
    "survival": _survival, "causal": _causal, "hypothesis": _hypothesis,
    "sql": _sql, "python": _python, "chart": _chart,
    "insights": _insights, "output": _output, "report": _output,
}

SUPPORTED_NODE_TYPES = sorted(_HANDLERS)
