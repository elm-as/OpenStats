"""
Module de génération de rapport HTML autonome et interactif.
"""

from __future__ import annotations

from html import escape
import pandas as pd

from app.core.export_formatters import (
    _dig, _fmt, _display_datetime, _slugify
)
from app.core.export_frames_stats import (
    _preview_frame, _dictionary_frame, _descriptive_frames,
    _significant_correlations_frame, _vif_frame, _tests_frame,
    _log_frame, _versions_frame, _history_frame, _audit_frame
)
from app.core.export_frames_models import (
    _model_ranking_frame, _feature_importance_frame, _shap_frame,
    _timeseries_summary_frame, _timeseries_forecast_frame,
    _multivariate_summary_frame, _granger_frame, _johansen_frame,
    _pca_variance_frame, _pca_loadings_frame, _ca_coords_frame,
    _mca_modalities_frame
)


def _render_summary_cards(payload: dict) -> str:
    dataset = payload.get("dataset", {})
    metadata = payload.get("metadata", {})
    cards = [
        ("Dataset", dataset.get("name")),
        ("Fichier source", dataset.get("original_filename")),
        ("Lignes", _dig(dataset, "shape", "rows")),
        ("Colonnes", _dig(dataset, "shape", "columns")),
        ("Colonnes actives", _dig(dataset, "active_shape", "columns")),
        ("Version", dataset.get("current_version")),
        ("Export", _display_datetime(metadata.get("generated_at"))),
        ("Colonnes exclues", ", ".join(dataset.get("excluded_columns") or []) or "Aucune"),
    ]
    cards_html = "".join(
        f'''
        <div class="stat-card">
          <div class="stat-label">{escape(str(label))}</div>
          <div class="stat-value">{escape(_fmt(value))}</div>
        </div>
        '''
        for label, value in cards
    )
    return f'<div class="stats-grid">{cards_html}</div>'


def _render_dataframe(frame: pd.DataFrame, max_rows: int = 40) -> str:
    if frame.empty:
        return '<p class="muted">Aucune donnee disponible.</p>'

    clipped = frame.head(max_rows).copy()
    headers = "".join(f"<th>{escape(str(column))}</th>" for column in clipped.columns)
    body_rows = []
    for _, row in clipped.iterrows():
        cells = "".join(f"<td>{escape(_fmt(row[column]))}</td>" for column in clipped.columns)
        body_rows.append(f"<tr>{cells}</tr>")
    notice = ""
    if len(frame) > max_rows:
        notice = f'<p class="muted">Affichage limite a {max_rows} lignes sur {len(frame)}.</p>'
    return (
        f'{notice}<div class="table-wrap"><table><thead><tr>{headers}</tr></thead>'
        f'<tbody>{"".join(body_rows)}</tbody></table></div>'
    )


def export_html(output_path: str, payload: dict) -> str:
    """Genere un rapport HTML autonome et riche en sections."""
    metadata = payload.get("metadata", {})
    dataset = payload.get("dataset", {})
    title = metadata.get("title", "Export")
    organization = metadata.get("organization") or "OpenStats — Elmas Labs"
    generated_at = metadata.get("generated_at", "")

    numeric_stats, categorical_stats = _descriptive_frames(payload)
    sections: list[tuple[str, str]] = []

    sections.append(("Jeu de donnees", _render_summary_cards(payload)))

    preview = _preview_frame(payload)
    if not preview.empty:
        sections.append(("Apercu", _render_dataframe(preview, max_rows=10)))

    dictionary = _dictionary_frame(payload)
    if not dictionary.empty:
        sections.append(("Dictionnaire", _render_dataframe(dictionary, max_rows=25)))

    if not numeric_stats.empty:
        sections.append(("Statistiques Numeriques", _render_dataframe(numeric_stats, max_rows=30)))

    if not categorical_stats.empty:
        sections.append(("Statistiques Categorielles", _render_dataframe(categorical_stats, max_rows=30)))

    significant_corr = _significant_correlations_frame(payload)
    if not significant_corr.empty:
        sections.append(("Correlations Significatives", _render_dataframe(significant_corr, max_rows=40)))

    vif = _vif_frame(payload)
    if not vif.empty:
        sections.append(("Colinearite", _render_dataframe(vif, max_rows=40)))

    tests = _tests_frame(payload)
    if not tests.empty:
        sections.append(("Tests d Hypotheses", _render_dataframe(tests, max_rows=40)))

    modeling = _model_ranking_frame(payload)
    if not modeling.empty:
        sections.append(("Modelisation", _render_dataframe(modeling, max_rows=25)))

    feature_importance = _feature_importance_frame(payload)
    if not feature_importance.empty:
        sections.append(("Importance des Variables", _render_dataframe(feature_importance, max_rows=40)))

    shap = _shap_frame(payload)
    if not shap.empty:
        sections.append(("SHAP Global", _render_dataframe(shap, max_rows=30)))

    ts_summary = _timeseries_summary_frame(payload)
    if not ts_summary.empty:
        sections.append(("Series Temporelles", _render_dataframe(ts_summary, max_rows=10)))

    ts_forecast = _timeseries_forecast_frame(payload)
    if not ts_forecast.empty:
        sections.append(("Previsions Temporelles", _render_dataframe(ts_forecast, max_rows=25)))

    mts_summary = _multivariate_summary_frame(payload)
    if not mts_summary.empty:
        sections.append(("Series Temporelles Multivariees", _render_dataframe(mts_summary, max_rows=10)))

    granger = _granger_frame(payload)
    if not granger.empty:
        sections.append(("Causalite de Granger", _render_dataframe(granger, max_rows=40)))

    johansen = _johansen_frame(payload)
    if not johansen.empty:
        sections.append(("Test de Johansen", _render_dataframe(johansen, max_rows=20)))

    pca_variance = _pca_variance_frame(payload)
    if not pca_variance.empty:
        sections.append(("ACP", _render_dataframe(pca_variance, max_rows=20)))

    pca_loadings = _pca_loadings_frame(payload)
    if not pca_loadings.empty:
        sections.append(("Loadings ACP", _render_dataframe(pca_loadings, max_rows=30)))

    ca_rows = _ca_coords_frame(payload, axis="row")
    if not ca_rows.empty:
        sections.append(("AFC Lignes", _render_dataframe(ca_rows, max_rows=30)))

    ca_cols = _ca_coords_frame(payload, axis="col")
    if not ca_cols.empty:
        sections.append(("AFC Colonnes", _render_dataframe(ca_cols, max_rows=30)))

    mca = _mca_modalities_frame(payload)
    if not mca.empty:
        sections.append(("ACM Modalites", _render_dataframe(mca, max_rows=30)))

    cleaning_log = _log_frame(payload.get("cleaning_log"))
    if not cleaning_log.empty:
        sections.append(("Nettoyage", _render_dataframe(cleaning_log, max_rows=40)))

    transform_logs = _log_frame(payload.get("transform_logs"))
    if not transform_logs.empty:
        sections.append(("Transformations", _render_dataframe(transform_logs, max_rows=40)))

    versions = _versions_frame(payload)
    if not versions.empty:
        sections.append(("Versions", _render_dataframe(versions, max_rows=25)))

    history = _history_frame(payload)
    if not history.empty:
        sections.append(("Historique", _render_dataframe(history, max_rows=25)))

    audit = _audit_frame(payload)
    if not audit.empty:
        sections.append(("Audit", _render_dataframe(audit, max_rows=25)))

    nav_links = "".join(
        f'<a href="#sec-{_slugify(section_title)}">{escape(section_title)}</a>'
        for section_title, _ in sections
    )
    rendered_sections = "".join(
        f'''
        <section id="sec-{_slugify(section_title)}" class="panel">
          <div class="panel-head">
            <h2>{escape(section_title)}</h2>
          </div>
          {section_html}
        </section>
        '''
        for section_title, section_html in sections
    )

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{escape(title)}</title>
  <style>
    :root {{
      --bg: #f5f1e8;
      --ink: #1f2933;
      --muted: #5f6c7b;
      --panel: rgba(255,255,255,0.92);
      --panel-border: rgba(20, 42, 73, 0.08);
      --accent: #103d60;
      --line: #d9e1e8;
      --shadow: 0 18px 48px rgba(16, 61, 96, 0.12);
    }}
    * {{ box-sizing: border-box; }}
    html {{ scroll-behavior: smooth; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(196, 107, 61, 0.18), transparent 26%),
        radial-gradient(circle at top right, rgba(16, 61, 96, 0.12), transparent 30%),
        linear-gradient(180deg, #faf7f2 0%, var(--bg) 100%);
      line-height: 1.55;
    }}
    .shell {{ max-width: 1320px; margin: 0 auto; padding: 32px 24px 56px; }}
    .hero {{
      background: linear-gradient(135deg, rgba(16, 61, 96, 0.96), rgba(17, 92, 122, 0.92));
      color: white;
      border-radius: 28px;
      padding: 32px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }}
    .hero::after {{
      content: "";
      position: absolute;
      inset: auto -80px -120px auto;
      width: 260px;
      height: 260px;
      background: rgba(255,255,255,0.08);
      border-radius: 50%;
    }}
    .eyebrow {{
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 0.78rem;
      opacity: 0.75;
      margin-bottom: 12px;
    }}
    h1 {{ margin: 0; font-size: clamp(2rem, 4vw, 3.2rem); line-height: 1.05; max-width: 780px; }}
    .hero-meta {{ margin-top: 16px; color: rgba(255,255,255,0.84); display: flex; gap: 18px; flex-wrap: wrap; }}
    .hero-meta span {{ background: rgba(255,255,255,0.12); border-radius: 999px; padding: 8px 12px; }}
    nav {{ margin: 18px 0 28px; display: flex; flex-wrap: wrap; gap: 10px; }}
    nav a {{
      text-decoration: none;
      color: var(--accent);
      background: rgba(255,255,255,0.78);
      border: 1px solid rgba(16, 61, 96, 0.08);
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 0.92rem;
      backdrop-filter: blur(6px);
    }}
    .panel {{
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 24px;
      padding: 24px;
      margin-bottom: 18px;
      box-shadow: 0 14px 36px rgba(18, 38, 63, 0.07);
    }}
    .panel-head {{ display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }}
    .panel h2 {{ margin: 0; font-size: 1.32rem; color: var(--accent); }}
    .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }}
    .stat-card {{
      background: linear-gradient(180deg, rgba(16, 61, 96, 0.08), rgba(255,255,255,0.88));
      border: 1px solid rgba(16, 61, 96, 0.08);
      border-radius: 18px;
      padding: 16px;
    }}
    .stat-label {{ font-size: 0.82rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }}
    .stat-value {{ margin-top: 8px; font-size: 1.45rem; font-weight: 700; color: var(--accent); word-break: break-word; }}
    .table-wrap {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 18px; }}
    table {{ width: 100%; border-collapse: collapse; background: white; }}
    th, td {{ padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 0.94rem; }}
    th {{ position: sticky; top: 0; background: #133c5d; color: white; font-weight: 600; }}
    tbody tr:nth-child(even) {{ background: #f9fbfd; }}
    tbody tr:hover {{ background: #eef5fa; }}
    .muted {{ color: var(--muted); }}
    .footer {{ text-align: center; color: var(--muted); padding-top: 12px; font-size: 0.9rem; }}
    @media (max-width: 720px) {{
      .shell {{ padding: 20px 14px 40px; }}
      .hero {{ padding: 24px 20px; border-radius: 22px; }}
      .panel {{ padding: 18px; border-radius: 20px; }}
      th, td {{ padding: 10px 11px; font-size: 0.88rem; }}
    }}
  </style>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <div class="eyebrow">OpenStats by Elmas Export</div>
      <h1>{escape(title)}</h1>
      <div class="hero-meta">
        <span>{escape(organization)}</span>
        <span>{escape(str(dataset.get("name") or "Dataset"))}</span>
        <span>Genere le {escape(_display_datetime(generated_at))}</span>
      </div>
    </header>
    <nav>{nav_links}</nav>
    {rendered_sections}
    <div class="footer">Export dataset {escape(str(dataset.get("id") or ""))} · OpenStats by Elmas Labs</div>
  </div>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(html)

    return output_path
