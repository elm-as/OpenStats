"""Licence du poste : empreinte machine, activation et verification hors ligne.

Le logiciel demande une cle a sa premiere ouverture, l'echange contre un jeton
lie a cette machine, puis verifie ce jeton localement a chaque demarrage. Il ne
recontacte le serveur qu'a l'expiration de la tolerance hors ligne.

Ce que ce dispositif obtient : une cle partagee atteint son quota de machines et
cesse d'activer ; un jeton recopie sur un autre poste est rejete sans reseau.

Ce qu'il n'obtient pas : l'inviolabilite. Ce fichier est du Python empaquete,
donc decompilable, et quelqu'un de determine neutralisera la verification.
L'objectif est de rendre le partage inutile, pas impossible — le pretendre
serait mentir a l'editeur comme a l'utilisateur.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import platform
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

URL_ACTIVATION = os.getenv("OPENSTATS_URL_LICENCE", "https://openstats.app/api/activation")

def _secret_jeton() -> str:
    """Secret de verification des jetons, identique a ACTIVATION_SECRET du site.

    Dans un binaire distribue il n'y a pas de variable d'environnement : le
    secret y est scelle a la construction par `scripts/sceller_secret_licence.py`,
    dans un module genere et non versionne. La variable reste prioritaire, pour
    le developpement et pour un deploiement ou l'environnement est maitrise.
    """
    depuis_environnement = os.getenv("OPENSTATS_SECRET_JETON", "").strip()
    if depuis_environnement:
        return depuis_environnement
    try:
        from app.core._secret_licence import SECRET
    except ImportError:
        return ""
    return SECRET

DELAI_RESEAU_SECONDES = 15


def _dossier_donnees() -> Path:
    """Emplacement standard des donnees applicatives, par systeme."""
    if platform.system() == "Windows":
        base = Path(os.getenv("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.getenv("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    dossier = base / "OpenStats"
    dossier.mkdir(parents=True, exist_ok=True)
    return dossier


FICHIER_LICENCE = _dossier_donnees() / "licence.json"


def _identifiants_materiels() -> list[str]:
    """Elements stables de la machine, utilises pour composer l'empreinte.

    On privilegie ce qui survit a une reinstallation du systeme mais change
    d'une machine a l'autre. Aucun de ces identifiants n'est transmis : seule
    leur empreinte l'est.
    """
    elements: list[str] = [platform.machine(), platform.system()]

    if platform.system() == "Windows":
        for commande in (
            ["wmic", "csproduct", "get", "uuid"],
            ["wmic", "baseboard", "get", "serialnumber"],
        ):
            try:
                sortie = subprocess.run(
                    commande, capture_output=True, text=True, timeout=5,
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            except (OSError, subprocess.SubprocessError):
                continue
            lignes = [ligne.strip() for ligne in sortie.stdout.splitlines() if ligne.strip()]
            if len(lignes) > 1:
                elements.append(lignes[1])
    else:
        for chemin in ("/etc/machine-id", "/var/lib/dbus/machine-id"):
            try:
                elements.append(Path(chemin).read_text(encoding="utf-8").strip())
                break
            except OSError:
                continue

    return [element for element in elements if element]


def empreinte_machine() -> str:
    """Empreinte stable de la machine, en hexadecimal sur 64 caracteres.

    Si aucun identifiant materiel n'est lisible, le nom de la machine sert de
    repli : l'empreinte est alors plus faible, mais le logiciel reste
    utilisable — refuser de demarrer parce qu'une commande systeme a echoue
    punirait l'utilisateur legitime pour un defaut qui n'est pas le sien.
    """
    elements = _identifiants_materiels() or [platform.node()]
    return hashlib.sha256("|".join(elements).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class EtatLicence:
    """Etat de la licence du poste, tel que l'interface doit l'afficher."""

    active: bool
    motif: str = ""
    message: str = ""
    revalidation_avant: int = 0

    @property
    def revalidation_urgente(self) -> bool:
        """Moins de trois jours avant l'expiration de la tolerance hors ligne."""
        if not self.active or not self.revalidation_avant:
            return False
        return self.revalidation_avant - int(time.time()) < 3 * 24 * 3600


def _lire_jeton_local() -> dict[str, Any] | None:
    try:
        return json.loads(FICHIER_LICENCE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _ecrire_jeton_local(donnees: dict[str, Any]) -> None:
    FICHIER_LICENCE.write_text(json.dumps(donnees, indent=2), encoding="utf-8")


def _verifier_jeton(jeton: str) -> dict[str, Any] | None:
    """Verifie la signature du jeton et rend son contenu."""
    secret = _secret_jeton()
    if not secret or "." not in jeton:
        return None

    charge, signature = jeton.rsplit(".", 1)
    attendue = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), charge.encode("utf-8"), hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")

    if not hmac.compare_digest(attendue, signature):
        return None

    try:
        rembourrage = "=" * (-len(charge) % 4)
        return json.loads(base64.urlsafe_b64decode(charge + rembourrage).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None


def etat_licence() -> EtatLicence:
    """Etat courant, determine sans reseau."""
    local = _lire_jeton_local()
    if not local or "jeton" not in local:
        return EtatLicence(False, "absente", "Aucune licence enregistrée sur ce poste.")

    contenu = _verifier_jeton(local["jeton"])
    if not contenu:
        return EtatLicence(False, "jeton_invalide", "La licence enregistrée est illisible.")

    if contenu.get("empreinte") != empreinte_machine():
        # Cas du jeton recopie depuis une autre machine : detecte hors ligne.
        return EtatLicence(
            False, "autre_machine",
            "Cette licence a été activée sur un autre ordinateur.",
        )

    if int(contenu.get("revalidationAvant", 0)) < int(time.time()):
        return EtatLicence(
            False, "revalidation_requise",
            "Votre licence doit être revalidée : connectez-vous une fois à Internet.",
            int(contenu.get("revalidationAvant", 0)),
        )

    return EtatLicence(True, revalidation_avant=int(contenu.get("revalidationAvant", 0)))


def activer(cle: str) -> EtatLicence:
    """Echange une cle contre un jeton lie a cette machine."""
    import urllib.error
    import urllib.request

    corps = json.dumps({
        "cle": cle.strip(),
        "empreinte": empreinte_machine(),
        "nomMachine": platform.node() or "Poste sans nom",
    }).encode("utf-8")

    requete = urllib.request.Request(
        URL_ACTIVATION, data=corps,
        headers={"Content-Type": "application/json"}, method="POST",
    )

    try:
        with urllib.request.urlopen(requete, timeout=DELAI_RESEAU_SECONDES) as reponse:
            resultat = json.loads(reponse.read().decode("utf-8"))
    except urllib.error.HTTPError as erreur:
        try:
            detail = json.loads(erreur.read().decode("utf-8"))
        except (ValueError, OSError):
            detail = {}
        return EtatLicence(
            False, detail.get("motif", "refus"),
            detail.get("message", "L'activation a été refusée."),
        )
    except (urllib.error.URLError, TimeoutError, OSError):
        return EtatLicence(
            False, "reseau",
            "Impossible de joindre le serveur d'activation. Vérifiez votre connexion.",
        )

    if not resultat.get("active") or not resultat.get("jeton"):
        return EtatLicence(False, "refus", resultat.get("message", "Activation refusée."))

    _ecrire_jeton_local({"cle": cle.strip(), "jeton": resultat["jeton"]})
    return etat_licence()
