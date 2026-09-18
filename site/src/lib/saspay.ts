/**
 * Client SasPay : création d'un paiement et vérification des webhooks.
 *
 * SasPay encaisse en XOF et XAF. Un client international paie par carte, mais
 * le montant débité est en francs CFA : c'est sa banque qui convertit. Toute la
 * facturation est donc pensée en XOF, le dollar n'étant qu'un repère d'affichage.
 *
 * Référence : https://docs.saspay.me/api-reference/payments/checkout-create
 *             https://docs.saspay.me/api-reference/webhooks
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE_API = process.env.SASPAY_API_URL ?? 'https://api.saspay.me/api/v1';

/** Tolérance d'horloge sur les webhooks, imposée par SasPay : 5 minutes. */
const FENETRE_HORODATAGE_SECONDES = 300;

export interface DemandePaiement {
  montantXOF: number;
  description: string;
  email: string;
  nom: string;
  telephone?: string;
  /** Renvoyé tel quel par le webhook : c'est notre lien entre paiement et commande. */
  metadonnees: Record<string, string>;
  urlRetour: string;
}

export interface SessionPaiement {
  id: string;
  urlPaiement: string;
  statut: string;
}

function cleSecrete(): string {
  const cle = process.env.SASPAY_SECRET_KEY;
  if (!cle) {
    throw new Error(
      "SASPAY_SECRET_KEY absente : le paiement ne peut pas être créé. " +
        "Renseignez-la dans les variables d'environnement.",
    );
  }
  return cle;
}

/**
 * Crée une session de paiement et rend l'URL vers laquelle envoyer le client.
 *
 * Le montant est transmis en chaîne décimale, comme l'exige l'API.
 */
export async function creerSessionPaiement(demande: DemandePaiement): Promise<SessionPaiement> {
  const reponse = await fetch(`${BASE_API}/checkout-sessions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleSecrete()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: demande.montantXOF.toFixed(2),
      currency: 'XOF',
      description: demande.description,
      customer_email: demande.email,
      customer_name: demande.nom,
      ...(demande.telephone ? { customer_phone: demande.telephone } : {}),
      return_url: demande.urlRetour,
      metadata: demande.metadonnees,
    }),
    cache: 'no-store',
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error(`SasPay a refusé la création du paiement (${reponse.status}) : ${detail}`);
  }

  const donnees = (await reponse.json()) as {
    id: string;
    checkout_url: string;
    status: string;
  };

  return { id: donnees.id, urlPaiement: donnees.checkout_url, statut: donnees.status };
}

/**
 * Vérifie qu'un webhook vient bien de SasPay.
 *
 * Deux contrôles, tous deux nécessaires : l'horodatage empêche le rejeu d'une
 * requête interceptée, la signature empêche la fabrication. La comparaison est
 * faite en temps constant — une comparaison ordinaire laisse fuir, par sa durée,
 * de quoi reconstituer la signature attendue.
 *
 * Le corps doit être la chaîne brute reçue : re-sérialiser le JSON change les
 * espaces et l'ordre des clés, donc invalide une signature pourtant correcte.
 */
export function webhookAuthentique(
  corpsBrut: string,
  signature: string | null,
  horodatage: string | null,
  secret = process.env.SASPAY_WEBHOOK_SECRET,
): boolean {
  if (!signature || !horodatage || !secret) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(horodatage));
  if (!Number.isFinite(age) || age > FENETRE_HORODATAGE_SECONDES) return false;

  const attendue = createHmac('sha256', secret).update(`${horodatage}.${corpsBrut}`).digest('hex');
  const a = Buffer.from(attendue);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface EvenementPaiement {
  event: string;
  data: {
    id: string;
    reference: string;
    status: string;
    amount: string;
    currency: string;
    metadata?: Record<string, string>;
  };
}
