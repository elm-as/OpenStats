"""Reconnaissance des dates : formats acceptes, traduction, typage temporel.

Source unique du projet. Le typage a l'import, le profilage de l'auto-analyseur
et les moteurs temporels doivent repondre la meme chose sur une meme colonne :
quand ils divergeaient, une colonne reconnue par l'un etait ignoree par l'autre
et les analyses temporelles disparaissaient sans explication.
"""

from __future__ import annotations

import re
from typing import Any

import pandas as pd


# ── Formats de dates courants ──────────────────────────────────────────

DATE_FORMATS = [
    # ISO
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y/%m/%d",
    # Français
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d.%m.%Y",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y %H:%M:%S",
    "%d %B %Y",        # 15 janvier 2024
    "%d %b %Y",        # 15 jan 2024
    # US
    "%m/%d/%Y",
    "%m-%d-%Y",
    "%m/%d/%Y %I:%M %p",
    # Textuels
    "%B %d, %Y",       # January 15, 2024
    "%b %d, %Y",       # Jan 15, 2024
    "%d %b %y",        # 15 Jan 24
    # Compacts
    "%Y%m%d",
    "%d%m%Y",
]


MOIS_FR = {
    "janvier": "january", "fevrier": "february", "février": "february",
    "mars": "march", "avril": "april", "mai": "may", "juin": "june",
    "juillet": "july", "aout": "august", "août": "august",
    "septembre": "september", "octobre": "october",
    "novembre": "november", "decembre": "december", "décembre": "december",
}
JOURS_FR = r"^(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+"
SEMAINE_ISO = re.compile(r"^(\d{4})[-\s]?[WS](\d{1,2})$", re.IGNORECASE)


def normalize_date_text(value: Any) -> str:
    """Traduit une date ecrite en francais vers une forme que pandas sait lire.

    `pd.to_datetime` s'appuie sur la locale C : « 15 janvier 2024 » n'est pas
    reconnu alors que « 15 january 2024 » l'est. Cette fonction est la source
    unique de cette traduction, partagee par le profilage et les moteurs
    temporels.
    """
    texte = str(value).strip().lower()
    texte = re.sub(JOURS_FR, "", texte)
    for fr, en in MOIS_FR.items():
        texte = re.sub(rf"\b{re.escape(fr)}\b", en, texte)
    return texte


def _parse_semaine_iso(sample: pd.Series) -> bool:
    """Reconnait les semaines ISO (2021-W01, 2021S01) que pandas ignore seul."""
    correspondances = sample.astype(str).str.strip().str.match(SEMAINE_ISO)
    if correspondances.mean() < 0.8:
        return False
    normalise = sample.astype(str).str.strip().str.replace(
        SEMAINE_ISO, lambda m: f"{m.group(1)}-W{int(m.group(2)):02d}-1", regex=True)
    parsed = pd.to_datetime(normalise, format="%G-W%V-%u", errors="coerce")
    return bool(parsed.notna().mean() >= 0.8)


def try_parse_dates(series: pd.Series, sample_size: int = 50) -> tuple[bool, str | None]:
    """
    Tente de parser une série en dates avec plusieurs formats.
    Retourne (success, format_detected).
    """
    sample = series.dropna().astype(str).head(sample_size)
    if sample.empty:
        return False, None

    # D'abord essayer pandas infer_datetime_format (rapide)
    try:
        parsed = pd.to_datetime(sample, format="mixed", dayfirst=True)
        if parsed.notna().sum() / len(sample) >= 0.8:
            return True, "mixed"
    except (ValueError, TypeError):
        pass

    # Essai format par format
    for fmt in DATE_FORMATS:
        try:
            parsed = pd.to_datetime(sample, format=fmt, errors="coerce")
            success_rate = parsed.notna().sum() / len(sample)
            if success_rate >= 0.8:
                return True, fmt
        except (ValueError, TypeError):
            continue

    # Dates ecrites en francais : on retente apres traduction des mois.
    normalise = sample.map(normalize_date_text)
    try:
        parsed = pd.to_datetime(normalise, format="mixed", dayfirst=True, errors="coerce")
        if parsed.notna().sum() / len(sample) >= 0.8:
            return True, "texte_francais"
    except (ValueError, TypeError):
        pass
    for fmt in ("%d %B %Y", "%B %Y", "%d %b %Y", "%b %Y"):
        parsed = pd.to_datetime(normalise, format=fmt, errors="coerce")
        if parsed.notna().sum() / len(sample) >= 0.8:
            return True, fmt

    if _parse_semaine_iso(sample):
        return True, "semaine_iso"

    return False, None


NOM_TEMPOREL = re.compile(
    r"(?:^|[_\s])(date|datetime|time|timestamp|year|annee|année|mois|month|"
    r"semaine|week|trimestre|quarter|an)(?:$|[_\s\d])"
)


def has_temporal_name(col_name: str) -> bool:
    """Le nom de la colonne evoque-t-il une date ?"""
    return bool(NOM_TEMPOREL.search((col_name or "").lower().strip()))


def _is_compact_date(nums: pd.Series) -> bool:
    """Periodes ecrites en entier : 202101 (AAAAMM), 20210115 (AAAAMMJJ).

    Format courant des exports comptables et ERP. La contrainte sur le mois
    (01-12) suffit a ecarter un code article a six chiffres.
    """
    if nums.nunique() < 3:
        return False
    for largeur, forme in ((6, "%Y%m"), (8, "%Y%m%d")):
        candidats = nums[(nums >= 10 ** (largeur - 1)) & (nums < 10 ** largeur)]
        if len(candidats) / len(nums) < 0.95:
            continue
        parsed = pd.to_datetime(candidats.astype("int64").astype(str),
                                format=forme, errors="coerce")
        if parsed.notna().mean() >= 0.95:
            return True
    return False


def _is_excel_serial(nums: pd.Series, nom_temporel: bool) -> bool:
    """Numero de serie Excel (jours depuis 1899-12-30).

    Exige un nom evocateur : sinon n'importe quel compteur entre 20 000 et
    60 000 passerait pour une date.
    """
    if not nom_temporel or nums.nunique() < 3:
        return False
    return bool(nums.between(20000, 60000).mean() >= 0.95)


def is_temporal_series(series: pd.Series, col_name: str = "") -> bool:
    """Decide si une colonne porte une date. Source unique du projet.

    Le typage a l'import et le profilage de l'auto-analyseur doivent repondre
    la meme chose : sinon une colonne reconnue par l'un est ignoree par
    l'autre, et les analyses temporelles disparaissent sans explication.
    """
    if pd.api.types.is_datetime64_any_dtype(series):
        return True

    echantillon = series.dropna().head(50)
    if echantillon.empty:
        return False

    nom_temporel = has_temporal_name(col_name or str(getattr(series, "name", "")))

    if pd.api.types.is_numeric_dtype(series):
        try:
            nums = pd.to_numeric(echantillon, errors="coerce").dropna()
            if nums.empty or not (nums == nums.round()).all():
                return False
            if nom_temporel and nums.between(1000, 3000).mean() > 0.8:
                return True
            if nom_temporel and nums.between(1800, 2100).all() and 2 <= nums.nunique() <= 200:
                return True
            return _is_compact_date(nums) or _is_excel_serial(nums, nom_temporel)
        except Exception:
            return False

    if series.dtype == object or pd.api.types.is_string_dtype(series):
        is_date, _ = try_parse_dates(series)
        if is_date:
            return True
        if nom_temporel:
            try:
                parsed = pd.to_datetime(echantillon, errors="coerce", dayfirst=True)
                if parsed.notna().mean() > 0.7:
                    return True
            except Exception:
                pass

    return False


def parse_compact_numeric(serie: pd.Series) -> pd.Series | None:
    """Convertit les dates ecrites en nombre : 2021, 202101, 20210115, serie Excel.

    Reconnaitre un format sans savoir le lire ne sert a rien : le detecteur
    proposait des analyses temporelles sur des periodes AAAAMM que le moteur
    ne savait pas convertir. Cette fonction ferme cet ecart.
    """
    nums = pd.to_numeric(serie, errors="coerce")
    if nums.notna().mean() < 0.9:
        return None
    valides = nums.dropna()
    if valides.empty or not (valides == valides.round()).all():
        return None

    entiers = valides.round().astype("int64")
    if entiers.between(1000, 3000).mean() > 0.9:
        converti = pd.to_datetime(entiers.astype(str), format="%Y", errors="coerce")
    elif _is_compact_date(valides):
        largeur = 6 if entiers.between(100000, 999999).mean() > 0.9 else 8
        forme = "%Y%m" if largeur == 6 else "%Y%m%d"
        converti = pd.to_datetime(entiers.astype(str), format=forme, errors="coerce")
    elif entiers.between(20000, 60000).mean() >= 0.95:
        converti = pd.Timestamp("1899-12-30") + pd.to_timedelta(entiers, unit="D")
    else:
        return None

    if converti.isna().mean() > 0.2:
        return None
    resultat = pd.Series(pd.NaT, index=serie.index, dtype="datetime64[ns]")
    resultat.loc[converti.index] = converti
    return resultat
