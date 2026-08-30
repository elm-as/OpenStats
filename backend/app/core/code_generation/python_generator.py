"""
Générateur de code Python reproductible (pandas, statsmodels, scikit-learn).
Conforme à la charte ELMAS.md : fonctions verbe+nom, découpage strict < 350 lignes.
"""

from typing import Any, Dict, List


def _get_python_loader(file_name: str) -> str:
    ext = file_name.split(".")[-1].lower() if "." in file_name else "csv"
    if ext in ("xlsx", "xls"):
        return f"df = pd.read_excel('{file_name}')"
    elif ext == "parquet":
        return f"df = pd.read_parquet('{file_name}')"
    elif ext == "json":
        return f"df = pd.read_json('{file_name}')"
    elif ext == "tsv":
        return f"df = pd.read_csv('{file_name}', sep='\\t')"
    return f"df = pd.read_csv('{file_name}')"


def generate_node_python_code(
    node_type: str,
    node_data: Dict[str, Any],
    dataset_name: str = "dataset.csv",
    include_imports: bool = False
) -> str:
    """
    Génère le code Python propre et exécutable pour un nœud spécifique.

    :param node_type: Type du nœud Canvas ou de l'étape de pipeline.
    :param node_data: Paramètres et configuration du nœud.
    :param dataset_name: Nom du fichier de données source.
    :param include_imports: Inclure les importations au début du bloc.
    :return: Chaîne de caractères contenant le script Python commenté.
    """
    lines: List[str] = []
    actual_file = node_data.get("file") or node_data.get("fileName") or dataset_name or "dataset.csv"

    if node_type == "dataset":
        if include_imports:
            lines.extend(["import pandas as pd", ""])
        lines.extend([
            f"# Chargement du dataset '{actual_file}'",
            _get_python_loader(actual_file),
            "print(f'Dataset chargé : {df.shape[0]} lignes, {df.shape[1]} colonnes')",
            "print(df.head())"
        ])

    elif node_type == "typing":
        if include_imports:
            lines.extend(["import pandas as pd", ""])
        lines.extend([
            "# Inférence et conversion des types de colonnes",
            "df = df.infer_objects()",
            "for col in df.select_dtypes(include=['object', 'string']).columns:",
            "    df[col] = df[col].astype('category')",
            "print(df.dtypes)"
        ])

    elif node_type == "cleaning":
        if include_imports:
            lines.extend(["import pandas as pd", "import numpy as np", ""])
        actions = node_data.get("actions", "") if isinstance(node_data.get("actions"), str) else ""
        is_iqr = "iqr_clipping" in actions
        is_winsorize = "winsorize_1_99" in actions
        is_none_outliers = "none_outliers" in actions

        lines.extend([
            "# Nettoyage : dédoublonnage et imputation médiane",
            "df = df.drop_duplicates()",
            "num_cols = df.select_dtypes(include='number').columns",
            "df[num_cols] = df[num_cols].fillna(df[num_cols].median())"
        ])
        if is_iqr:
            lines.extend([
                "# Détection IQR et traitement par Capping (Winsorisation 1% - 99%)",
                "# Note: Aligné sur le comportement du backend pour le traitement 'cap'",
                "for col in num_cols:",
                "    q_low = df[col].quantile(0.01)",
                "    q_high = df[col].quantile(0.99)",
                "    if pd.notna(q_low) and pd.notna(q_high) and q_low < q_high:",
                "        df[col] = np.clip(df[col], q_low, q_high)",
                "print(f'Lignes après nettoyage : {len(df)} | Outliers écrêtés via la méthode IQR [cap 1%-99%]')\n"
            ])
        elif is_winsorize or not is_none_outliers:
            lines.extend([
                "# Traitement des outliers par Winsorisation (1% - 99%)",
                "for col in num_cols:",
                "    q_low = df[col].quantile(0.01)",
                "    q_high = df[col].quantile(0.99)",
                "    if pd.notna(q_low) and pd.notna(q_high) and q_low < q_high:",
                "        df[col] = np.clip(df[col], q_low, q_high)",
                "print(f'Lignes après nettoyage : {len(df)} | Outliers extrêmes écrêtés aux percentiles [1%, 99%]')"
            ])
        else:
            lines.append("print(f'Lignes après nettoyage : {len(df)}')")

    elif node_type in ("descriptiveNumeric", "descriptiveCategorical"):
        if include_imports:
            lines.extend(["import pandas as pd", ""])
        cols = node_data.get("columns", [])
        col_arg = f"df[{cols}]" if cols else "df"
        lines.extend([
            "# Statistiques descriptives",
            f"stats_desc = {col_arg}.describe(include='all').T",
            "stats_desc['skewness'] = df.skew(numeric_only=True)",
            "stats_desc['kurtosis'] = df.kurtosis(numeric_only=True)",
            "print(stats_desc)"
        ])

    elif node_type == "correlation":
        if include_imports:
            lines.extend(["import pandas as pd", "import seaborn as sns", "import matplotlib.pyplot as plt", ""])
        method = node_data.get("method", "pearson")
        lines.extend([
            "# Matrice de corrélation",
            f"corr_matrix = df.corr(numeric_only=True, method='{method}')",
            "print(corr_matrix)",
            "plt.figure(figsize=(8, 6))",
            "sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f')",
            "plt.title('Matrice de Corrélation')",
            "plt.show()"
        ])

    elif node_type == "vif":
        if include_imports:
            lines.extend(["import pandas as pd", "from statsmodels.stats.outliers_influence import variance_inflation_factor", ""])
        lines.extend([
            "# Facteur d'Inflation de la Variance (VIF)",
            "X_vif = df.select_dtypes(include='number').dropna()",
            "if X_vif.shape[1] >= 2:",
            "    vif_df = pd.DataFrame({'Variable': X_vif.columns, 'VIF': [variance_inflation_factor(X_vif.values, i) for i in range(X_vif.shape[1])]})",
            "    print(vif_df.sort_values(by='VIF', ascending=False))"
        ])

    elif node_type == "pca":
        if include_imports:
            lines.extend(["import numpy as np", "from sklearn.decomposition import PCA", ""])
        lines.extend([
            "# Analyse en Composantes Principales (ACP)",
            "X_pca = df.select_dtypes(include='number').dropna()",
            "pca = PCA(n_components=min(5, X_pca.shape[1]))",
            "pca.fit(X_pca)",
            "print('Variance expliquée par axe :', pca.explained_variance_ratio_)"
        ])

    elif node_type == "clustering":
        if include_imports:
            lines.extend(["from sklearn.cluster import KMeans", ""])
        lines.extend([
            "# Clustering K-Means",
            "X_cls = df.select_dtypes(include='number').dropna()",
            "kmeans = KMeans(n_clusters=3, random_state=42, n_init=10).fit(X_cls)",
            "df.loc[X_cls.index, 'cluster'] = kmeans.labels_",
            "print('Répartition des clusters :\\n', df['cluster'].value_counts())"
        ])

    elif node_type == "regression":
        if include_imports:
            lines.extend(["import statsmodels.api as sm", "from sklearn.ensemble import RandomForestRegressor", ""])
        target = node_data.get("targetCol") or node_data.get("target", "target")
        lines.extend([
            f"# Régression Linéaire OLS & Random Forest sur '{target}'",
            f"y_col = '{target}' if '{target}' in df.columns else df.select_dtypes(include='number').columns[-1]",
            "data_reg = df.dropna(subset=[y_col]).copy()",
            "y = data_reg[y_col]",
            "X = data_reg.drop(columns=[y_col], errors='ignore').select_dtypes(include='number').fillna(0)",
            "X_const = sm.add_constant(X)",
            "ols_model = sm.OLS(y, X_const).fit()",
            "print(ols_model.summary())"
        ])

    elif node_type == "classification":
        if include_imports:
            lines.extend(["from sklearn.ensemble import RandomForestClassifier", "from sklearn.metrics import classification_report", ""])
        target = node_data.get("targetCol") or node_data.get("target", "target")
        lines.extend([
            f"# Classification Random Forest sur '{target}'",
            f"y_col = '{target}' if '{target}' in df.columns else df.columns[-1]",
            "data_clf = df.dropna(subset=[y_col]).copy()",
            "y = data_clf[y_col]",
            "X = data_clf.drop(columns=[y_col], errors='ignore').select_dtypes(include='number').fillna(0)",
            "clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1).fit(X, y)",
            "print('Rapport de Classification :\\n', classification_report(y, clf.predict(X)))"
        ])

    elif node_type == "testNormality":
        if include_imports:
            lines.extend(["from scipy import stats", ""])
        col = node_data.get("column", "variable")
        lines.extend([
            f"# Test de normalité de Shapiro-Wilk sur '{col}'",
            f"data_col = df['{col}'].dropna() if '{col}' in df.columns else df.select_dtypes(include='number').iloc[:, 0].dropna()",
            "shapiro_stat, shapiro_p = stats.shapiro(data_col)",
            "print(f'Shapiro-Wilk: Stat={shapiro_stat:.4f}, p-value={shapiro_p:.4e}')"
        ])

    elif node_type == "testCompareMeans":
        if include_imports:
            lines.extend(["from scipy import stats", ""])
        group_col = node_data.get("groupCol", "groupe")
        value_col = node_data.get("valueCol", "valeur")
        lines.extend([
            "# Comparaison de moyennes / Test T de Student",
            f"groups = [group.dropna().values for _, group in df.groupby('{group_col}')['{value_col}'] if len(group.dropna()) > 0]",
            "if len(groups) == 2:",
            "    t_stat, p_val = stats.ttest_ind(groups[0], groups[1], equal_var=False)",
            "    print(f'Test t de Welch : t = {t_stat:.4f}, p-value = {p_val:.4e}')"
        ])

    elif node_type == "survival":
        if include_imports:
            lines.extend(["import statsmodels.duration.hazard_regression as ph", ""])
        dur_col = node_data.get("durationCol", "duration")
        evt_col = node_data.get("eventCol", "event")
        lines.extend([
            "# Régression à Risques Proportionnels de Cox",
            f"if '{dur_col}' in df.columns and '{evt_col}' in df.columns:",
            f"    features = [c for c in df.select_dtypes(include='number').columns if c not in ['{dur_col}', '{evt_col}']]",
            f"    formula = '{dur_col} ~ ' + ' + '.join(features)",
            f"    cox_model = ph.PHReg.from_formula(formula, df, status=df['{evt_col}']).fit()",
            "    print(cox_model.summary())"
        ])

    elif node_type == "causal":
        if include_imports:
            lines.extend(["import statsmodels.api as sm", ""])
        treat_col = node_data.get("treatmentCol", "treatment")
        out_col = node_data.get("outcomeCol", "outcome")
        time_col = node_data.get("timeCol", "period")
        lines.extend([
            "# Inférence Causale : Difference-in-Differences (DiD)",
            f"sub = df[['{out_col}', '{treat_col}', '{time_col}']].dropna().copy() if all(c in df.columns for c in ['{out_col}', '{treat_col}', '{time_col}']) else df.select_dtypes(include='number').iloc[:, :3].dropna()",
            "sub.columns = ['outcome', 'treatment', 'period']",
            "sub['interaction'] = sub['treatment'] * sub['period']",
            "X = sm.add_constant(sub[['treatment', 'period', 'interaction']])",
            "did_model = sm.OLS(sub['outcome'], X).fit()",
            "print(f'Effet Causal ATT = {did_model.params.get(\"interaction\", 0.0):.4f}')"
        ])

    elif node_type == "sql":
        if include_imports:
            lines.extend(["import duckdb", ""])
        query = node_data.get("query", "SELECT * FROM df")
        lines.extend([
            "# Requête SQL exécutée via DuckDB",
            f"query = '''{query}'''",
            "df = duckdb.query(query).to_df()",
            "print(df.head())"
        ])

    elif node_type == "python":
        user_code = node_data.get("code", "# df['new_col'] = df.iloc[:, 0] * 2")
        lines.extend([
            "# Code Python Personnalisé",
            user_code
        ])

    else:
        lines.extend([
            f"# Traitement / Analyse pour le nœud '{node_type}'",
            "print(f'Dimensions actuelles du dataset : {df.shape}')"
        ])

    return "\n".join(lines)


def generate_pipeline_python_script(steps: List[Dict[str, Any]], dataset_name: str = "dataset.csv") -> str:
    """
    Génère un script Python complet réexécutant l'ensemble du pipeline.

    :param steps: Liste des étapes avec 'type'/'operation' et 'params'/'data'.
    :param dataset_name: Nom du dataset source.
    :return: Code Python exécutable complet sous forme de chaîne de caractères.
    """
    header = [
        "# " + "=" * 76,
        "# SCRIPT PYTHON REPRODUCTIBLE — OPENSTATS BYELMAS",
        f"# Dataset Source : {dataset_name}",
        "# " + "=" * 76,
        "",
        "import pandas as pd",
        "import numpy as np",
        "import scipy.stats as stats",
        "import statsmodels.api as sm",
        "from statsmodels.stats.outliers_influence import variance_inflation_factor",
        "from sklearn.decomposition import PCA",
        "from sklearn.cluster import KMeans",
        "from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier",
        "import matplotlib.pyplot as plt",
        "import seaborn as sns",
        "",
        "# 1. Chargement du jeu de données",
        f"df = pd.read_csv('{dataset_name}')",
        "print(f'Dataset initial : {df.shape[0]} observations, {df.shape[1]} variables')",
        "",
    ]

    body_blocks = []
    for idx, step in enumerate(steps, 1):
        stype = step.get("operation") or step.get("type") or "unknown"
        sdata = step.get("params") or step.get("data") or {}
        label = step.get("label") or stype

        if stype == "dataset":
            continue

        block = [
            f"# " + "-" * 60,
            f"# Étape {idx} : {label} ({stype})",
            f"# " + "-" * 60,
            generate_node_python_code(stype, sdata, dataset_name, include_imports=False),
            "",
        ]
        body_blocks.append("\n".join(block))

    footer = [
        "# " + "=" * 76,
        "# Fin du script Python OpenStats byElmas",
        "# " + "=" * 76,
    ]

    return "\n".join(header + body_blocks + footer)
