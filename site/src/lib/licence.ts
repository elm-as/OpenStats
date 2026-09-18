/**
 * Génération et vérification des clés de licence OpenStats.
 *
 * Principe : une clé est un message signé, pas un identifiant à rechercher en
 * base. Le logiciel peut donc vérifier hors ligne qu'une clé vient bien de nous
 * et qu'elle n'a pas été modifiée — mais pas qu'elle n'a pas été partagée.
 * C'est le rôle de l'activation en ligne, qui lie la clé à une machine (voir
 * `activation.ts`).
 *
 * Ce que ce dispositif fait : rendre le partage inopérant. Une clé donnée à un
 * collègue s'active sur sa machine, atteint son quota, et cesse de fonctionner.
 *
 * Ce qu'il ne fait pas : empêcher un attaquant déterminé de contourner la
 * vérification dans un binaire Python, qui reste décompilable. Aucun dispositif
 * côté client ne le peut, et le prétendre serait malhonnête.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type TypeLicence = 'solo' | 'equipe' | 'site';

export interface ContenuLicence {
  /** Identifiant de commande, permet de retrouver le paiement d'origine. */
  commande: string;
  /** Adresse du client : elle figure dans la clé, donc un partage l'expose. */
  email: string;
  type: TypeLicence;
  /** Nombre de machines activables simultanément. */
  postes: number;
  /** Fin de la période de mises à jour (epoch secondes). La licence perpétuelle
   *  continue de fonctionner au-delà, sans nouvelles versions. */
  maintenanceJusquA: number;
  /** Version majeure achetée, pour distinguer une mise à jour d'une migration. */
  version: string;
}

const SEPARATEUR = '.';

function base64url(donnees: Buffer): string {
  return donnees.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64url(texte: string): Buffer {
  return Buffer.from(texte.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signer(charge: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(charge).digest());
}

/**
 * Fabrique une clé de licence signée.
 *
 * Format : `OS3-<charge base64url>.<signature base64url>`. Le préfixe permet de
 * reconnaître une clé au premier coup d'œil dans un ticket de support.
 */
export function genererCle(contenu: ContenuLicence, secret: string): string {
  const charge = base64url(Buffer.from(JSON.stringify(contenu), 'utf8'));
  return `OS3-${charge}${SEPARATEUR}${signer(charge, secret)}`;
}

/**
 * Vérifie la signature d'une clé et rend son contenu.
 *
 * Rend `null` pour toute clé absente, mal formée ou dont la signature ne
 * correspond pas — sans distinguer les cas : renseigner l'attaquant sur la
 * raison de l'échec l'aiderait à forger une clé valide.
 */
export function lireCle(cle: string, secret: string): ContenuLicence | null {
  if (!cle?.startsWith('OS3-')) return null;

  const [charge, signature] = cle.slice(4).split(SEPARATEUR);
  if (!charge || !signature) return null;

  const attendue = Buffer.from(signer(charge, secret));
  const fournie = Buffer.from(signature);
  if (attendue.length !== fournie.length) return null;
  if (!timingSafeEqual(attendue, fournie)) return null;

  try {
    return JSON.parse(depuisBase64url(charge).toString('utf8')) as ContenuLicence;
  } catch {
    return null;
  }
}

/** Identifiant de commande lisible, utilisable en référence de paiement. */
export function nouvelleReferenceCommande(): string {
  const date = new Date();
  const jour = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
  return `OS-${jour}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
