"""
Module de calcul de variables personnalisées via des expressions mathématiques.
Utilise pandas.eval() pour une exécution sécurisée et performante.
"""

import pandas as pd
import numpy as np

def compute_new_variable(df: pd.DataFrame, new_col_name: str, formula: str) -> tuple[pd.DataFrame, dict]:
    """
    Évalue une formule mathématique sur un DataFrame et ajoute le résultat
    comme nouvelle colonne.
    
    Args:
        df: Le DataFrame source.
        new_col_name: Le nom de la nouvelle colonne.
        formula: La formule à évaluer (ex: "childs + brothers" ou "log(income + 1)").
        
    Returns:
        Un tuple contenant le nouveau DataFrame et un dictionnaire de logs.
    """
    df_out = df.copy()
    
    try:
        # pd.eval permet d'utiliser des fonctions numpy via engine='numexpr'
        # On définit un espace de nom local restreint si nécessaire,
        # mais par défaut pd.eval est relativement sûr par rapport à eval() classique.
        
        # Astuce : df.eval() évalue sur les colonnes du DataFrame.
        # Par défaut target n'est pas supporté pour juste retourner la série,
        # donc on évalue la partie droite puis on l'assigne.
        
        # On va utiliser pd.eval directement ou df.eval
        # On peut avoir des appels mathématiques basiques.
        # engine='python' ou 'numexpr'. 'numexpr' est plus sûr et rapide pour du maths pur,
        # mais on peut avoir besoin de trucs comme log().
        # df.eval supporte certaines fonctions mathématiques comme log, exp, sqrt etc avec numexpr.
        
        # Préparation: Remplacer les noms de fonctions mathématiques par les fonctions équivalentes
        # supportées (numexpr comprend log, log10, exp, sqrt, sin, cos, tan, arcsin, arccos, arctan).
        
        # Évaluation
        result_series = df_out.eval(formula)
        
        # Vérification du résultat
        if isinstance(result_series, pd.DataFrame):
            raise ValueError("L'expression a retourné un DataFrame au lieu d'une Series 1D.")
        elif np.isscalar(result_series):
            # Si l'expression retourne un scalaire (ex: "1 + 1"), on broadcast
            df_out[new_col_name] = result_series
        else:
            df_out[new_col_name] = result_series

        log = {
            "column": new_col_name,
            "transform": "compute",
            "formula": formula,
            "success": True,
            "meta": {"formula": formula}
        }
        return df_out, log
        
    except Exception as e:
        log = {
            "column": new_col_name,
            "transform": "compute",
            "formula": formula,
            "success": False,
            "error": str(e)
        }
        return df_out, log
