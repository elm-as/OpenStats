"""
Service d'extensions personnalisées et scripts analytiques.
Délègue l'exécution isolée au module app.core.sandbox.
"""

from __future__ import annotations

import logging
from typing import Optional, Dict, Any, List
from app.models.extension import UserScript
from app.extensions import db
from app.services.dataset_service import dataset_manager
from app.services.llm_provider import resolve_llm_provider, request_chat_completion
from app.core.sandbox import (
    ALLOWED_MODULES,
    BLOCKED_BUILTINS,
    validate_python_code_safety,
    run_sandboxed_custom,
)

logger = logging.getLogger(__name__)


def _build_script_system_prompt(cols_info: str, history_info: str) -> str:
    return f"""Tu es un expert en data science et statistiques. 
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
    "y_key": "nom_colonne_pour_axe_y",
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


def _extract_python_code(llm_reply: str) -> str:
    """Les modèles entourent souvent le code d'un bloc markdown malgré la consigne."""
    if "```python" in llm_reply:
        return llm_reply.split("```python")[1].split("```")[0].strip()
    if "```" in llm_reply:
        return llm_reply.split("```")[1].split("```")[0].strip()
    return llm_reply.strip()


class ExtensionService:
    _ALLOWED_MODULES = ALLOWED_MODULES
    _BLOCKED_BUILTINS = BLOCKED_BUILTINS
    _EXECUTION_TIMEOUT_SECONDS = 30

    def get_templates(self) -> List[Dict[str, Any]]:
        """Retourne une liste de scripts prédéfinis pour aider l'utilisateur."""
        from app.services.extension_templates import EXTENSION_TEMPLATES
        return EXTENSION_TEMPLATES

    def generate_script_from_prompt(
        self,
        prompt: str,
        dataset_id: str,
        byok: Optional[Dict[str, Optional[str]]] = None,
    ) -> Dict[str, Any]:
        """Génère un script Python à partir d'une description textuelle via LLM."""
        from app.models.dataset import Dataset
        from app.models.audit import AuditLog

        byok = byok or {}
        provider = resolve_llm_provider(byok.get("api_key"), byok.get("provider"))

        ds = Dataset.query.get(dataset_id)
        if not ds:
            raise ValueError("Dataset introuvable")

        dictionary = ds.profile.get("dictionary", [])
        cols_info = "\n".join([f"- {c['nom_brut']} ({c['type_statistique']}): {c.get('signification_ia', '')}" for c in dictionary])

        history = AuditLog.query.filter_by(dataset_id=dataset_id).order_by(AuditLog.created_at.desc()).limit(10).all()
        history_info = "\n".join([f"- {h.action}: {h.details}" for h in history])

        llm_reply = request_chat_completion(provider, [
            {"role": "system", "content": _build_script_system_prompt(cols_info, history_info)},
            {"role": "user", "content": f"Génère le script pour : {prompt}"},
        ])
        code = _extract_python_code(llm_reply)

        return {
            "name": f"Analyse : {prompt[:30]}...",
            "description": prompt,
            "code": code,
            "input_config": {"dataset_id": dataset_id},
        }

    def save_script(
        self, user_id: str, name: str, code: str, description: str = "", input_config: dict = None,
    ) -> UserScript:
        script = UserScript(
            user_id=user_id,
            name=name,
            code=code,
            description=description,
            input_config=input_config or {},
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

    def _validate_code_safety(self, code: str) -> None:
        """Compatibilité avec les appels internes existants."""
        validate_python_code_safety(code)

    def execute_raw_code(self, code: str, dataset_id: str, params: dict = None) -> Dict[str, Any]:
        """Exécute du code Python utilisateur dans un environnement sandboxé."""
        df = dataset_manager.get_df(dataset_id)
        if df is None:
            raise ValueError("Dataset introuvable")

        return run_sandboxed_custom(
            code=code,
            df=df,
            params=params,
            timeout_seconds=self._EXECUTION_TIMEOUT_SECONDS,
        )


extension_service = ExtensionService()
