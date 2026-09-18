/**
 * Activation d'une licence sur une machine donnée.
 *
 * Le logiciel envoie sa clé et une empreinte de la machine. Le serveur enregistre
 * le couple et rend un jeton d'activation, signé, que le logiciel conserve. À
 * chaque démarrage il vérifie hors ligne que le jeton correspond bien à *cette*
 * machine ; il ne recontacte le serveur que périodiquement.
 *
 * Ce que ce dispositif garantit :
 * - une clé partagée atteint son quota de machines et cesse d'activer ;
 * - un jeton copié sur une autre machine est rejeté hors ligne, sans réseau ;
 * - l'utilisateur légitime peut travailler sans connexion pendant la tolérance.
 *
 * Ce qu'il ne garantit pas : l'inviolabilité. Le binaire embarque du bytecode
 * Python, décompilable ; quelqu'un de déterminé neutralisera la vérification.
 * L'objectif est de rendre le partage pénible et inutile, pas impossible.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Au-delà, le logiciel exige une reconnexion pour revalider son activation. */
export const TOLERANCE_HORS_LIGNE_JOURS = 21;

export interface DemandeActivation {
  cle: string;
  /** Empreinte matérielle calculée par le logiciel, déjà hachée côté client. */
  empreinte: string;
  /** Nom lisible, pour que le client reconnaisse ses postes dans son espace. */
  nomMachine: string;
}

export interface JetonActivation {
  cle: string;
  empreinte: string;
  emisLe: number;
  revalidationAvant: number;
}

/**
 * Émet un jeton lié à une machine.
 *
 * Le jeton contient l'empreinte : le logiciel recalcule l'empreinte locale au
 * démarrage et la compare à celle du jeton. Un jeton copié ailleurs ne
 * correspondra pas, sans avoir besoin du réseau pour le détecter.
 */
export function emettreJeton(cle: string, empreinte: string, secret: string): string {
  const jeton: JetonActivation = {
    cle,
    empreinte,
    emisLe: Math.floor(Date.now() / 1000),
    revalidationAvant:
      Math.floor(Date.now() / 1000) + TOLERANCE_HORS_LIGNE_JOURS * 24 * 3600,
  };
  const charge = Buffer.from(JSON.stringify(jeton), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(charge).digest('base64url');
  return `${charge}.${signature}`;
}

/** Vérifie un jeton d'activation et rend son contenu, ou `null`. */
export function lireJeton(jeton: string, secret: string): JetonActivation | null {
  const [charge, signature] = (jeton ?? '').split('.');
  if (!charge || !signature) return null;

  const attendue = Buffer.from(createHmac('sha256', secret).update(charge).digest('base64url'));
  const fournie = Buffer.from(signature);
  if (attendue.length !== fournie.length || !timingSafeEqual(attendue, fournie)) return null;

  try {
    return JSON.parse(Buffer.from(charge, 'base64url').toString('utf8')) as JetonActivation;
  } catch {
    return null;
  }
}

/**
 * Normalise une empreinte machine.
 *
 * Le logiciel compose l'empreinte à partir d'éléments stables (identifiant de
 * carte mère, numéro de série du disque système, identifiant processeur) et la
 * hache avant envoi : le serveur n'a jamais besoin de connaître le matériel
 * réel du client, seulement de reconnaître la même machine.
 */
export function empreinteValide(empreinte: string): boolean {
  return /^[a-f0-9]{64}$/i.test(empreinte);
}

export type MotifRefus =
  | 'cle_inconnue'
  | 'cle_invalide'
  | 'quota_atteint'
  | 'empreinte_invalide'
  | 'licence_revoquee';

export const MESSAGES_REFUS: Record<MotifRefus, string> = {
  cle_inconnue: "Cette clé n'existe pas. Vérifiez la saisie, ou contactez le support.",
  cle_invalide: "Cette clé est invalide ou a été modifiée.",
  quota_atteint:
    "Toutes les machines autorisées par cette licence sont déjà activées. " +
    "Libérez un poste depuis votre espace client, ou passez à une licence supérieure.",
  empreinte_invalide: "L'empreinte machine transmise est mal formée.",
  licence_revoquee: "Cette licence a été révoquée. Contactez le support.",
};
