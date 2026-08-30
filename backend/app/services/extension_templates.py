"""
Templates prédéfinis de scripts pour le module d'extensions personnalisées.
"""

from typing import Any, Dict, List


EXTENSION_TEMPLATES: List[Dict[str, Any]] = [
    {
        "name": "Moyenne Mobile & Analyse de Tendance",
        "description": "Calcule une moyenne mobile sur une colonne et détecte si la tendance est haussière ou baissière.",
        "code": (
            "def analyze_custom(df, params):\n"
            "    # Récupération des paramètres\n"
            "    col = params.get('column', df.select_dtypes(include='number').columns[0])\n"
            "    window = int(params.get('window', 7))\n"
            "    \n"
            "    # Calcul de la moyenne mobile\n"
            "    df_copy = df.copy()\n"
            "    df_copy['moving_avg'] = df_copy[col].rolling(window=window).mean()\n"
            "    \n"
            "    # Analyse de tendance simple\n"
            "    last_val = df_copy[col].iloc[-1]\n"
            "    avg_val = df_copy['moving_avg'].iloc[-1]\n"
            "    tendance = \"Haussière\" if last_val > avg_val else \"Baissière\"\n"
            "    \n"
            "    return {\n"
            "        \"status\": \"success\",\n"
            "        \"result_summary\": {\n"
            "            \"colonne_analysee\": col,\n"
            "            \"derniere_valeur\": float(last_val),\n"
            "            \"moyenne_mobile\": float(avg_val),\n"
            "            \"tendance_detectee\": tendance\n"
            "        },\n"
            "        \"charts\": [\n"
            "            {\"type\": \"line\", \"title\": \"Prix vs Moyenne Mobile\", \"data\": df_copy[[col, 'moving_avg']].tail(50).to_dict(orient='records')}\n"
            "        ]\n"
            "    }"
        ),
    },
    {
        "name": "Détection d'Anomalies (Z-Score)",
        "description": "Identifie les valeurs aberrantes dans une colonne numérique en utilisant le Z-Score.",
        "code": (
            "def analyze_custom(df, params):\n"
            "    col = params.get('column', df.select_dtypes(include='number').columns[0])\n"
            "    threshold = float(params.get('threshold', 3.0))\n"
            "    \n"
            "    series = df[col].dropna()\n"
            "    mean = series.mean()\n"
            "    std = series.std()\n"
            "    \n"
            "    z_scores = (series - mean) / std\n"
            "    outliers = series[abs(z_scores) > threshold]\n"
            "    \n"
            "    return {\n"
            "        \"status\": \"success\",\n"
            "        \"result_summary\": {\n"
            "            \"total_outliers\": len(outliers),\n"
            "            \"outliers_values\": outliers.tolist()[:10],\n"
            "            \"mean\": float(mean),\n"
            "            \"std\": float(std)\n"
            "        }\n"
            "    }"
        ),
    },
    {
        "name": "Corrélation Multiple Personnalisée",
        "description": "Calcule la corrélation entre plusieurs colonnes spécifiques et génère une matrice simplifiée.",
        "code": (
            "def analyze_custom(df, params):\n"
            "    cols = params.get('columns', df.select_dtypes(include='number').columns.tolist()[:5])\n"
            "    corr_matrix = df[cols].corr().to_dict()\n"
            "    \n"
            "    return {\n"
            "        \"status\": \"success\",\n"
            "        \"result_summary\": {\n"
            "            \"columns_count\": len(cols),\n"
            "            \"correlations\": corr_matrix\n"
            "        }\n"
            "    }"
        ),
    },
]
