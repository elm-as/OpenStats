"""Comment nommer un pipeline et le resumer a l'utilisateur.

Le titre est ce que l'utilisateur lit en premier : il doit dire quelle
structure a ete reconnue dans ses donnees, pas seulement quel modele sera
lance.
"""

from __future__ import annotations

from app.core.auto_pipeline.detector import DatasetProfile


def titre_et_description(
    profile: DatasetProfile,
    problem: str,
    effective_target: str | None,
) -> tuple[str, str]:
    """Rend (titre, description) selon la structure reconnue et la cible."""
    if profile.is_panel:
        forme = profile.panel_structure
        title = f"Pipeline d'Économétrie de Panel (`{effective_target}`)"
        desc = (f"{forme.get('n_entities')} entités suivies sur {forme.get('n_periods')} "
                f"périodes : effets fixes, effets aléatoires et test de Hausman sur "
                f"**{effective_target}**.")
    elif profile.has_temporal and effective_target:
        title = f"Pipeline Séries Temporelles & Économétrie (`{effective_target}`)"
        desc = (f"Pipeline complet d'analyse temporelle, stationnarité, cointégration et "
                f"prévision sur **{effective_target}** ({profile.n_rows} observations).")
    elif problem == "regression" and effective_target:
        title = f"Pipeline de Régression (`{effective_target}`)"
        desc = (f"Pipeline de modélisation prédictive, VIF, régression et explicabilité "
                f"sur **{effective_target}**.")
    elif "classification" in problem and effective_target:
        title = f"Pipeline de Classification (`{effective_target}`)"
        desc = f"Pipeline d'apprentissage supervisé et discrimination sur **{effective_target}**."
    else:
        title = "Pipeline d'Exploration & Profilage"
        desc = ("Pipeline exploratoire : contrôle de qualité, statistiques, corrélations "
                "et réduction dimensionnelle.")

    return title, desc
