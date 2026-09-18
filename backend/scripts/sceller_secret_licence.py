"""Scelle le secret de verification des jetons dans le binaire.

A executer avant PyInstaller. Le module produit est ignore par git : un secret
commite est un secret public, et celui-ci permet de forger des jetons
d'activation pour n'importe quelle machine.

Il ne s'agit pas d'un secret inviolable — il part chez l'utilisateur, dans un
binaire decompilable. C'est le secret *de verification hors ligne*, distinct de
`LICENCE_SECRET` qui signe les cles et ne quitte jamais le serveur. Compromettre
celui-ci permet de contourner la verification locale ; il ne permet pas de
fabriquer une cle que le serveur accepterait.

    OPENSTATS_SECRET_JETON=... python scripts/sceller_secret_licence.py
"""

import os
import sys
from pathlib import Path

CIBLE = Path(__file__).resolve().parent.parent / "app" / "core" / "_secret_licence.py"


def main() -> int:
    secret = os.getenv("OPENSTATS_SECRET_JETON", "").strip()
    if not secret:
        print(
            "OPENSTATS_SECRET_JETON absente.\n"
            "Ce doit etre la meme valeur que ACTIVATION_SECRET du site, sinon\n"
            "aucune licence ne pourra etre activee dans le binaire produit.",
            file=sys.stderr,
        )
        return 1

    CIBLE.write_text(
        '"""Secret scelle a la construction. Genere, non versionne, ne pas editer."""\n\n'
        f"SECRET = {secret!r}\n",
        encoding="utf-8",
    )
    print(f"secret scelle dans {CIBLE.relative_to(CIBLE.parents[2])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
