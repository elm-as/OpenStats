"""Routes de licence du poste.

Volontairement sans `@login_required` : la fenetre d'activation s'ouvre avant
que l'utilisateur ait un compte. Ces routes ne lisent ni n'ecrivent de donnees
d'analyse, elles ne touchent qu'au fichier de licence local.

Elles ne sont pas exposables sur un serveur partage telles quelles : elles
decrivent l'etat de la *machine* qui heberge le backend, ce qui n'a de sens que
dans le binaire Desktop, ou backend et interface tournent sur le meme poste.
"""

from flask import jsonify, request

from app.api.v1 import api_v1_bp
from app.core.licence_poste import EtatLicence, activer, empreinte_machine, etat_licence
from app.extensions import limiter


def _en_json(etat: EtatLicence) -> dict:
    return {
        "active": etat.active,
        "motif": etat.motif,
        "message": etat.message,
        "revalidationAvant": etat.revalidation_avant,
        "revalidationUrgente": etat.revalidation_urgente,
    }


@api_v1_bp.route("/licence", methods=["GET"])
def lire_licence():
    """Etat de la licence, determine sans reseau."""
    etat = etat_licence()
    return jsonify({**_en_json(etat), "empreinte": empreinte_machine()[:12]})


@api_v1_bp.route("/licence/activation", methods=["POST"])
@limiter.limit("10 per hour")
def activer_licence():
    """Echange une cle contre un jeton lie a cette machine.

    Le debit est limite : sans cela, la fenetre d'activation devient un oracle
    permettant d'essayer des cles en masse contre le serveur de licences.
    """
    donnees = request.get_json(silent=True) or {}
    cle = str(donnees.get("cle", "")).strip()

    if len(cle) < 10:
        return jsonify({"active": False, "motif": "cle_absente",
                        "message": "Saisissez votre clé de licence."}), 400

    etat = activer(cle)
    return jsonify(_en_json(etat)), (200 if etat.active else 402)
