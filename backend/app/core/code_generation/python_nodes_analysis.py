"""
Traduction des noeuds d'analyse statistique descriptive et d'apprentissage statistique en Python.
"""

from __future__ import annotations

from typing import Any

from app.core.code_generation.emitter import CodeBlock, py_cols, py_literal
from app.core.code_generation.python_nodes_prep import columns_helper, target_helper

PANDAS = "import pandas as pd"
PLT = "import matplotlib.pyplot as plt"
SNS = "import seaborn as sns"
SM = "import statsmodels.api as sm"


def emit_descriptive_numeric(params: dict[str, Any]) -> CodeBlock:
    cols = columns_helper(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(
        imports=[PANDAS],
        body=[
            "# Statistiques descriptives (variables numeriques)",
            f"_num = {subset}",
            "_desc = _num.describe().T",
            "_desc['skewness'] = _num.skew()",
            "_desc['kurtosis'] = _num.kurtosis()",
            "print(_desc)",
        ],
    )


def emit_descriptive_categorical(params: dict[str, Any]) -> CodeBlock:
    cols = columns_helper(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(exclude='number')"
    return CodeBlock(
        imports=[PANDAS],
        body=[
            "# Statistiques descriptives (variables qualitatives)",
            f"for col in {subset}.columns:",
            "    print(f'--- {col} ---')",
            "    print(df[col].value_counts(dropna=False).head(20))",
        ],
    )


def emit_correlation(params: dict[str, Any]) -> CodeBlock:
    method = str(params.get("method", "pearson"))
    cols = columns_helper(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(
        imports=[PANDAS, PLT, SNS],
        body=[
            f"# Matrice de correlation ({method})",
            f"_corr = {subset}.corr(method={py_literal(method)})",
            "print(_corr)",
            "plt.figure(figsize=(9, 7))",
            "sns.heatmap(_corr, annot=True, fmt='.2f', cmap='coolwarm', center=0)",
            f"plt.title({py_literal(f'Matrice de correlation ({method})')})",
            "plt.tight_layout()",
            "plt.show()",
        ],
    )


def emit_vif(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[
            PANDAS,
            SM,
            "from statsmodels.stats.outliers_influence import variance_inflation_factor",
        ],
        body=[
            "# Facteurs d'inflation de la variance (multicolinearite)",
            "_num = df.select_dtypes(include='number').dropna()",
            "_design = sm.add_constant(_num)",
            "_vif = pd.DataFrame({",
            "    'variable': _design.columns,",
            (
                "    'VIF': [variance_inflation_factor(_design.values, i) for i in"
                " range(_design.shape[1])],"
            ),
            "})",
            (
                "print(_vif[_vif['variable'] !="
                " 'const'].sort_values('VIF', ascending=False))"
            ),
        ],
    )


def emit_pca(params: dict[str, Any]) -> CodeBlock:
    n_components = int(params.get("n_components", 2) or 2)
    cols = columns_helper(params, "columns")
    subset = f"df[{py_cols(cols)}]" if cols else "df.select_dtypes(include='number')"
    return CodeBlock(
        imports=[
            PANDAS,
            PLT,
            "from sklearn.decomposition import PCA",
            "from sklearn.preprocessing import StandardScaler",
        ],
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
        ],
    )


def emit_manifold(params: dict[str, Any]) -> CodeBlock:
    return CodeBlock(
        imports=[
            PANDAS,
            PLT,
            "from sklearn.manifold import TSNE",
            "from sklearn.preprocessing import StandardScaler",
        ],
        body=[
            "# Projection non lineaire (t-SNE)",
            "_X = df.select_dtypes(include='number').dropna()",
            "_perplexity = min(30, max(5, len(_X) // 4))",
            (
                "_emb = TSNE(n_components=2, perplexity=_perplexity, init='pca',"
                " random_state=0).fit_transform(StandardScaler().fit_transform(_X))"
            ),
            "plt.figure(figsize=(7, 6))",
            "plt.scatter(_emb[:, 0], _emb[:, 1], alpha=0.6)",
            "plt.title('Projection t-SNE'); plt.tight_layout(); plt.show()",
        ],
    )


def emit_cluster(params: dict[str, Any]) -> CodeBlock:
    k = int(params.get("n_clusters", params.get("k", 3)) or 3)
    return CodeBlock(
        imports=[
            PANDAS,
            "from sklearn.cluster import KMeans",
            "from sklearn.preprocessing import StandardScaler",
            "from sklearn.metrics import silhouette_score",
        ],
        body=[
            f"# Classification non supervisee (K-Means, k={k})",
            "_X = df.select_dtypes(include='number').dropna()",
            "_Xs = StandardScaler().fit_transform(_X)",
            f"_km = KMeans(n_clusters={k}, n_init=10, random_state=0).fit(_Xs)",
            "df.loc[_X.index, 'cluster'] = _km.labels_",
            "print('Silhouette :', round(silhouette_score(_Xs, _km.labels_), 4))",
            "print(df['cluster'].value_counts())",
        ],
    )


def emit_regression(params: dict[str, Any]) -> CodeBlock:
    target = target_helper(params)
    if not target:
        return CodeBlock(
            body=["# Regression : aucune variable cible configuree."],
            note="cible manquante",
        )
    features = columns_helper(params, "features", "columns")
    selection = (
        f"df[{py_cols(features)}]"
        if features
        else f"df.select_dtypes(include='number').drop(columns=[{py_literal(target)}], errors='ignore')"
    )
    return CodeBlock(
        imports=[
            PANDAS,
            SM,
            "from sklearn.model_selection import cross_val_score",
            "from sklearn.ensemble import RandomForestRegressor",
        ],
        body=[
            f"# Regression sur {target}",
            f"_frame = pd.concat([{selection}, df[[{py_literal(target)}]]], axis=1).dropna()",
            f"_y = _frame[{py_literal(target)}]",
            f"_X = _frame.drop(columns=[{py_literal(target)}])",
            "_ols = sm.OLS(_y, sm.add_constant(_X)).fit()",
            "print(_ols.summary())",
            "_rf = RandomForestRegressor(n_estimators=200, random_state=0)",
            (
                "print('R2 validation croisee :',"
                " cross_val_score(_rf, _X, _y, cv=5, scoring='r2').mean().round(4))"
            ),
        ],
    )


def emit_classification(params: dict[str, Any]) -> CodeBlock:
    target = target_helper(params)
    if not target:
        return CodeBlock(
            body=["# Classification : aucune variable cible configuree."],
            note="cible manquante",
        )
    features = columns_helper(params, "features", "columns")
    selection = (
        f"df[{py_cols(features)}]"
        if features
        else f"df.select_dtypes(include='number').drop(columns=[{py_literal(target)}], errors='ignore')"
    )
    return CodeBlock(
        imports=[
            PANDAS,
            "from sklearn.ensemble import RandomForestClassifier",
            "from sklearn.model_selection import train_test_split",
            "from sklearn.metrics import classification_report, roc_auc_score",
        ],
        body=[
            f"# Classification de {target}",
            f"_frame = pd.concat([{selection}, df[[{py_literal(target)}]]], axis=1).dropna()",
            f"_y = _frame[{py_literal(target)}].astype('category').cat.codes",
            f"_X = _frame.drop(columns=[{py_literal(target)}])",
            (
                "_Xtr, _Xte, _ytr, _yte = train_test_split(_X, _y, test_size=0.25,"
                " random_state=0, stratify=_y)"
            ),
            "_clf = RandomForestClassifier(n_estimators=200, random_state=0).fit(_Xtr, _ytr)",
            "print(classification_report(_yte, _clf.predict(_Xte)))",
            "if _y.nunique() == 2:",
            (
                "    print('AUC :',"
                " round(roc_auc_score(_yte, _clf.predict_proba(_Xte)[:, 1]), 4))"
            ),
        ],
    )


def emit_explainability(params: dict[str, Any]) -> CodeBlock:
    target = target_helper(params)
    if not target:
        return CodeBlock(
            body=["# Explicabilite : aucune variable cible configuree."],
            note="cible manquante",
        )
    return CodeBlock(
        imports=[
            PANDAS,
            PLT,
            "import shap",
            "from sklearn.ensemble import RandomForestRegressor",
        ],
        body=[
            f"# Explicabilite SHAP pour {target}",
            "_frame = df.select_dtypes(include='number').dropna()",
            f"_y = _frame[{py_literal(target)}]",
            f"_X = _frame.drop(columns=[{py_literal(target)}], errors='ignore')",
            "_model = RandomForestRegressor(n_estimators=150, random_state=0).fit(_X, _y)",
            "_values = shap.TreeExplainer(_model).shap_values(_X)",
            "shap.summary_plot(_values, _X, show=False)",
            "plt.tight_layout(); plt.show()",
        ],
    )
