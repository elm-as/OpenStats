import os
import pandas as pd
from typing import Optional, Dict, Any, List
from openai import OpenAI
from app.models.extension import UserScript
from app.extensions import db
from app.services.dataset_service import dataset_manager
import multiprocessing as mp

def _run_sandboxed(code, df, params, queue):
    """Fonction exécutée dans un processus séparé pour le sandboxing."""
    try:
        import numpy as np
        import scipy.stats as scipy_stats
        import pandas as pd
        
        safe_builtins = ExtensionService._make_safe_builtins(ExtensionService._BLOCKED_BUILTINS)
        safe_builtins["__import__"] = ExtensionService._make_safe_import(ExtensionService._ALLOWED_MODULES)

        namespace = {
            "__builtins__": safe_builtins,
            "pd": pd,
            "np": np,
            "stats": scipy_stats,
            "sm": __import__("statsmodels.api", fromlist=["api"]),
            "tsa": __import__("statsmodels.tsa.stattools", fromlist=["adfuller", "kpss"]),
            "plt": None,
        }
        
        exec(code, namespace)
        
        if "analyze_custom" not in namespace:
            raise ValueError("Le script doit définir une fonction 'analyze_custom(df, params)'")

        result = namespace["analyze_custom"](df, params or {})
        queue.put({"status": "success", "data": result})
    except Exception as e:
        queue.put({"status": "error", "message": str(e)})


class ExtensionService:
    def __init__(self):
        # Fallback values
        self.default_api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
        self.default_base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        self.default_model = os.getenv("LLM_MODEL", "deepseek-chat")

    def get_templates(self) -> List[Dict[str, Any]]:
        """Retourne une liste de scripts prédéfinis pour aider l'utilisateur."""
        return [
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
                )
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
                )
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
                )
            }
        ]

    def generate_script_from_prompt(self, prompt: str, dataset_id: str, custom_api_key: Optional[str] = None, provider: str = "openai") -> Dict[str, Any]:
        """Génère un script Python à partir d'une description textuelle via le LLM configuré."""
        from app.models.dataset import Dataset
        from app.models.audit import AuditLog
        
        api_key = custom_api_key or self.default_api_key
        base_url = "https://api.openai.com/v1" if provider == "openai" and custom_api_key else self.default_base_url
        model = "gpt-4" if provider == "openai" and custom_api_key else self.default_model

        if not api_key:
            raise ValueError("Clé API manquante. Veuillez configurer votre clé dans les paramètres de profil.")

        client = OpenAI(api_key=api_key, base_url=base_url)

        ds = Dataset.query.get(dataset_id)
        if not ds:
            raise ValueError("Dataset introuvable")
        
        # Contexte des colonnes
        dictionary = ds.profile.get("dictionary", [])
        cols_info = "\n".join([f"- {c['nom_brut']} ({c['type_statistique']}): {c.get('signification_ia', '')}" for c in dictionary])

        # Contexte des transformations (AuditTrail)
        history = AuditLog.query.filter_by(dataset_id=dataset_id).order_by(AuditLog.created_at.desc()).limit(10).all()
        history_info = "\n".join([f"- {h.action}: {h.details}" for h in history])

        system_prompt = f"""Tu es un expert en data science et statistiques. 
Ton rôle est de générer un script Python qui effectue une analyse sur un DataFrame pandas nommé 'df'.

CONTEXTE DU DATASET :
Colonnes disponibles :
{cols_info}

Historique des transformations appliquées :
{history_info}

RÈGLES DE GÉNÉRATION :
1. Le script doit être une fonction nommée 'analyze_custom(df, params)'.
2. Il doit retourner un dictionnaire JSON-serializable.
3. Utilise pandas, numpy, scipy.stats, statsmodels ou scikit-learn.
4. IMPORTANT : Pour les tests de stationnarité (ADF), utilise 'from statsmodels.tsa.stattools import adfuller'. Ne confonds pas avec scipy.stats.
5. Gère les erreurs gracieusement avec un bloc try/except retournant {{"status": "error", "message": ...}}.
6. Inclus des commentaires clairs en français.
7. Ne génère QUE le code, pas d'explications autour.

STRUCTURE DES GRAPHIQUES :
Si pertinent, ajoute une clef 'charts' dans le dictionnaire de retour. Format STRICT :
{{
    "type": "line" | "bar" | "pie" | "scatter",
    "title": "Titre",
    "x_key": "nom_colonne_pour_axe_x",
    "y_key": "nom_colonne_pour_axe_y",  # Requis pour pie et scatter
    "data": [ {{"col1": val, "col2": val}}, ... ]
}}
Note : 'data' doit être une liste de dicts (df.to_dict(orient='records')).

CONSEILS STATISTIQUES :
1. Valide TOUJOURS que tes groupes ne sont pas vides avant un test (ex: ANOVA, ADF).
2. Évite les divisions par zéro (vérifie les dénominateurs comme 'n - k').
3. Si une variable a une variance nulle, signale-le au lieu de planter.

FORMAT DE SORTIE :
{{
    "status": "success",
    "result_summary": {{ ... }},
    "charts": [ ... ]
}}
"""

        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Génère le script pour : {prompt}"}
            ],
            stream=False
        )
        
        code = response.choices[0].message.content
        if "```python" in code:
            code = code.split("```python")[1].split("```")[0].strip()
        elif "```" in code:
            code = code.split("```")[1].split("```")[0].strip()
            
        return {
            "name": f"Analyse : {prompt[:30]}...",
            "description": prompt,
            "code": code,
            "input_config": {"dataset_id": dataset_id}
        }

    def save_script(self, user_id: str, name: str, code: str, description: str = "", input_config: dict = None) -> UserScript:
        script = UserScript(
            user_id=user_id,
            name=name,
            code=code,
            description=description,
            input_config=input_config or {}
        )
        db.session.add(script)
        db.session.commit()
        return script

    def list_scripts(self, user_id: str):
        return UserScript.query.filter_by(user_id=user_id).all()

    def get_script(self, script_id: str):
        return UserScript.query.get(script_id)

    def execute_script(self, script_id: str, dataset_id: str, params: dict = None) -> Dict[str, Any]:
        script = self.get_script(script_id)
        if not script:
            raise ValueError("Script introuvable")
        return self.execute_raw_code(script.code, dataset_id, params)

    # ── Sandbox Configuration ─────────────────────────────────────
    # Modules autorisés pour l'exécution de code utilisateur.
    # Tout import en dehors de cette liste sera bloqué.
    _ALLOWED_MODULES = frozenset({
        "math", "statistics", "collections", "itertools", "functools",
        "re", "json", "datetime", "decimal", "fractions",
        "numpy", "pandas", "scipy", "scipy.stats",
        "statsmodels", "statsmodels.api", "statsmodels.tsa",
        "statsmodels.tsa.stattools", "sklearn",
    })

    # Builtins dangereux qui sont retirés du namespace d'exécution.
    _BLOCKED_BUILTINS = frozenset({
        "eval", "exec", "compile", "__import__", "globals", "locals",
        "getattr", "setattr", "delattr", "vars", "dir",
        "open", "input", "breakpoint", "exit", "quit",
        "memoryview", "type", "classmethod", "staticmethod", "property",
    })

    _EXECUTION_TIMEOUT_SECONDS = 30

    @staticmethod
    def _make_safe_import(allowed: frozenset):
        """Crée une fonction __import__ restreinte qui ne permet que les modules autorisés."""
        _real_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

        def _safe_import(name, *args, **kwargs):
            # Autoriser le module si son nom ou son package racine est dans la liste
            root = name.split(".")[0]
            if name in allowed or root in allowed:
                return _real_import(name, *args, **kwargs)
            raise ImportError(
                f"Module '{name}' non autorisé. "
                f"Seuls les modules suivants sont disponibles : {', '.join(sorted(allowed))}"
            )

        return _safe_import

    @staticmethod
    def _make_safe_builtins(blocked: frozenset) -> dict:
        """Construit un dictionnaire de builtins nettoyé (sans les fonctions dangereuses)."""
        import builtins
        safe = {k: v for k, v in vars(builtins).items() if k not in blocked}
        return safe

    def _validate_code_safety(self, code: str) -> None:
        """Analyse statique rapide du code pour rejeter les patterns dangereux évidents."""
        import ast

        dangerous_patterns = [
            "subprocess", "os.system", "os.popen", "os.exec",
            "shutil", "socket", "http.client", "urllib",
            "ctypes", "pickle", "shelve", "marshal",
            "__subclasses__", "__bases__", "__mro__",
            "__globals__", "__code__", "__reduce__",
        ]

        code_lower = code.lower()
        for pattern in dangerous_patterns:
            if pattern.lower() in code_lower:
                raise ValueError(
                    f"Le code contient un pattern interdit : '{pattern}'. "
                    f"Pour des raisons de sécurité, ce type d'opération n'est pas autorisé."
                )

        # Vérifier que le code est syntaxiquement valide
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            raise ValueError(f"Erreur de syntaxe dans le code : {e}")

        # Validation de l'arbre syntaxique abstrait (AST)
        for node in ast.walk(tree):
            # Interdire l'accès aux attributs internes/magiques (ex: __subclasses__)
            if isinstance(node, ast.Attribute):
                if node.attr.startswith('__') and node.attr.endswith('__'):
                    raise ValueError(f"Accès interdit à l'attribut spécial : {node.attr}")
            
            # Interdire l'utilisation de builtins dangereux
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    if node.func.id in self._BLOCKED_BUILTINS:
                        raise ValueError(f"Appel de fonction interdit : {node.func.id}")

    def execute_raw_code(self, code: str, dataset_id: str, params: dict = None) -> Dict[str, Any]:
        """
        Exécute du code Python utilisateur dans un environnement sandboxé.

        Mesures de sécurité :
        - __builtins__ restreints (pas de open, eval, exec, __import__, etc.)
        - __import__ custom qui bloque tout module hors whitelist
        - Analyse statique du code pour rejeter les patterns dangereux
        - Timeout d'exécution pour éviter les boucles infinies
        """
        # 1. Validation statique du code
        self._validate_code_safety(code)

        # 2. Charger le DataFrame
        df = dataset_manager.get_df(dataset_id)

        # 3. Exécuter avec multiprocessing pour une vraie isolation
        try:
            ctx = mp.get_context("spawn")
            queue = ctx.Queue()
            
            process = ctx.Process(target=_run_sandboxed, args=(code, df, params, queue))
            process.start()
            process.join(timeout=self._EXECUTION_TIMEOUT_SECONDS)

            if process.is_alive():
                process.terminate()
                process.join()
                return {
                    "status": "error",
                    "message": f"Le script a dépassé le délai d'exécution de {self._EXECUTION_TIMEOUT_SECONDS}s. "
                               f"Vérifiez qu'il ne contient pas de boucle infinie.",
                }
                
            if not queue.empty():
                res = queue.get()
                if res["status"] == "error":
                    raise ValueError(res["message"])
                return res["data"]
                
            raise ValueError("Erreur inconnue lors de l'exécution du script (crash potentiel lié à l'épuisement de la mémoire).")

        except ValueError:
            raise
        except Exception as e:
            import traceback
            import logging
            logging.getLogger(__name__).warning("Erreur d'exécution de script utilisateur: %s", str(e))
            return {"status": "error", "message": str(e)}


extension_service = ExtensionService()
