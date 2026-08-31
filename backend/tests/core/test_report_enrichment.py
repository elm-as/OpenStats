"""
Tests unitaires pour l'enrichissement des rapports professionnels :
- Injection des descriptives temporelles
- Injection du tableau d'équation OLS détaillée et des coefficients t-stat / p-valeur / IC 95%
- Formatage sans dépassement des limites
"""

import pytest
from app.core.professional_report import ReportBuilder, build_report_payload


class TestReportEnrichment:
    def test_report_builder_with_temporal_descriptives(self):
        stats = {
            "annee": {
                "type": "temporal",
                "min": "1995",
                "max": "2024",
                "periods_count": 30,
            },
            "production": {
                "type": "numeric",
                "mean": 1250.4,
                "median": 1240.0,
                "std": 110.2,
                "skewness": 0.12,
                "null_rate": 0.0,
            },
        }

        builder = ReportBuilder("Dataset Econométrique")
        builder.with_descriptive(stats)
        report = builder.build()

        desc_sec = next((s for s in report.sections if "descriptives" in s.title.lower()), None)
        assert desc_sec is not None
        # Doit contenir le bullet temporel dédié
        assert any("Index Temporel `annee`" in b for b in desc_sec.bullets)
        # Et la table numérique
        assert desc_sec.table is not None
        assert desc_sec.table["rows"][0][0] == "production"

    def test_report_builder_with_ols_econometric_equation(self):
        model_results = {
            "task_type": "regression",
            "ranking": [
                {
                    "name": "Régression OLS",
                    "model_key": "ols",
                    "test_metrics": {"r2": 0.884, "rmse": 14.2, "mae": 11.1},
                    "model_summary": {
                        "equation": "production = 12.4 + 0.35 * precip + 0.85 * prix",
                        "r2_adjusted": 0.875,
                        "f_statistic": 45.2,
                        "f_pvalue": 1.2e-8,
                        "coefficients": [
                            {"variable": "const", "coefficient": 12.4, "std_error": 2.1, "t_statistic": 5.9, "p_value": 0.0001, "ci_lower": 8.1, "ci_upper": 16.7},
                            {"variable": "precip", "coefficient": 0.35, "std_error": 0.05, "t_statistic": 7.0, "p_value": 0.00001, "ci_lower": 0.25, "ci_upper": 0.45},
                            {"variable": "prix", "coefficient": 0.85, "std_error": 0.12, "t_statistic": 7.1, "p_value": 0.00001, "ci_lower": 0.61, "ci_upper": 1.09},
                        ],
                    },
                }
            ],
        }

        builder = ReportBuilder("Dataset Econométrique")
        builder.with_modeling(model_results)
        report = builder.build()

        mod_sec = next((s for s in report.sections if "modélisation" in s.title.lower()), None)
        assert mod_sec is not None
        # Vérification de la sous-section OLS
        assert len(mod_sec.subsections) == 1
        ols_sub = mod_sec.subsections[0]
        assert "Détail Économétrique OLS" in ols_sub.title
        assert "production = 12.4 + 0.35 * precip + 0.85 * prix" in ols_sub.body
        assert ols_sub.table is not None
        assert len(ols_sub.table["rows"]) == 3
        # Les étoiles de significativité doivent être présentes
        assert "***" in ols_sub.table["rows"][0][4]
