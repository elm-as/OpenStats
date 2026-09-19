"""Génère une clé de licence de test et pré-active le poste de développement.

Permet de tester immédiatement le binaire Windows (.exe) sans avoir besoin
de configurer le serveur d'activation distant ou d'attendre un achat réel.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import pathlib
import sys
import time

# Permet d'importer app.core sans modifier le PYTHONPATH manuellement
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from app.core.licence_poste import FICHIER_LICENCE, _secret_jeton, empreinte_machine, etat_licence

# Secrets par défaut utilisés en environnement de test/développement local
SECRET_LICENCE_PAR_DEFAUT = "secret-licence-essai-local-a-remplacer"
SECRET_ACTIVATION_PAR_DEFAUT = "secret-activation-essai-local-a-remplacer"


def fabriquer_cle(
    email: str = "admin@openstats.app",
    commande: str = "OS-TEST-DEV01",
    type_licence: str = "site",
    postes: int = 50,
    duree_annees: int = 10,
    secret_licence: str | None = None,
) -> str:
    """Produit une clé signée conforme au format attendu par OpenStats (OS3-...)."""
    secret = secret_licence or os.getenv("LICENCE_SECRET") or SECRET_LICENCE_PAR_DEFAUT

    contenu = {
        "commande": commande,
        "email": email,
        "type": type_licence,
        "postes": postes,
        "maintenanceJusquA": int(time.time()) + duree_annees * 365 * 24 * 3600,
        "version": "1",
    }

    charge = base64.urlsafe_b64encode(
        json.dumps(contenu, separators=(",", ":")).encode("utf-8")
    ).rstrip(b"=").decode("ascii")

    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), charge.encode("utf-8"), hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")

    return f"OS3-{charge}.{signature}"


def fabriquer_jeton(
    cle: str,
    empreinte: str,
    duree_annees: int = 10,
    secret_activation: str | None = None,
) -> str:
    """Produit un jeton d'activation scellé pour cette empreinte machine."""
    secret = secret_activation or _secret_jeton() or SECRET_ACTIVATION_PAR_DEFAUT

    donnees = {
        "cle": cle,
        "empreinte": empreinte,
        "emisLe": int(time.time()),
        "revalidationAvant": int(time.time()) + duree_annees * 365 * 24 * 3600,
    }

    charge = base64.urlsafe_b64encode(
        json.dumps(donnees, separators=(",", ":")).encode("utf-8")
    ).rstrip(b"=").decode("ascii")

    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), charge.encode("utf-8"), hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")

    return f"{charge}.{signature}"


def enregistrer_dans_base_site(cle: str, commande: str = "OS-TEST-DEV01", email: str = "admin@openstats.app") -> None:
    """Synchronise la base SQLite du site local si elle existe."""
    base_site = pathlib.Path(__file__).resolve().parents[2] / "site" / "donnees" / "openstats.db"
    if not base_site.exists():
        return

    import sqlite3

    try:
        conn = sqlite3.connect(base_site)
        cur = conn.cursor()
        maintenant = int(time.time())
        cur.execute(
            """INSERT OR REPLACE INTO commandes
               (reference, email, nom, offre, montant_xof, statut, cree_le, paye_le)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (commande, email, "Testeur OpenStats", "site", 0, "payee", maintenant, maintenant),
        )
        cur.execute(
            """INSERT OR REPLACE INTO licences
               (cle, commande, email, offre, postes, revoquee, emise_le)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (cle, commande, email, "site", 50, 0, maintenant),
        )
        conn.commit()
        conn.close()
    except Exception as err:
        print(f"[Avertissement] Impossible de synchroniser openstats.db: {err}", file=sys.stderr)


def activer_poste_local(cle: str) -> None:
    """Écrit le fichier licence.json dans %APPDATA%/OpenStats pour débloquer le .exe."""
    empreinte = empreinte_machine()
    jeton = fabriquer_jeton(cle, empreinte)

    FICHIER_LICENCE.parent.mkdir(parents=True, exist_ok=True)
    donnees = {"cle": cle, "jeton": jeton}
    FICHIER_LICENCE.write_text(json.dumps(donnees, indent=2), encoding="utf-8")


def main() -> int:
    cle = fabriquer_cle()
    enregistrer_dans_base_site(cle)
    activer_poste_local(cle)

    etat = etat_licence()
    if not etat.active:
        print("Échec de l'activation locale du poste.", file=sys.stderr)
        return 1

    print("\n" + "=" * 70)
    print(" Clé de licence OpenStats générée avec succès")
    print("=" * 70)
    print(f"\nClé : {cle}\n")
    print(f"Emplacement licence locale : {FICHIER_LICENCE}")
    print("Statut du poste            : ACTIVÉ (Prêt pour exécuter le .exe)")
    print("=" * 70 + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
