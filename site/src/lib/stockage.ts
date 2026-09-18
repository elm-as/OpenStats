/**
 * Persistance des commandes, licences et activations.
 *
 * Implémentation SQLite, via le module intégré à Node : aucune dépendance
 * externe, et le fichier se sauvegarde en le copiant. Cela suppose un serveur
 * unique avec un disque persistant — un VPS, pas une plateforme sans état.
 *
 * Toute la surface passe par les fonctions de ce module : basculer vers
 * PostgreSQL le jour où plusieurs instances tournent en parallèle se fera ici,
 * sans toucher aux routes.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CHEMIN = process.env.BASE_CHEMIN ?? './donnees/openstats.db';

let base: DatabaseSync | null = null;

function connexion(): DatabaseSync {
  if (base) return base;

  mkdirSync(dirname(CHEMIN), { recursive: true });
  base = new DatabaseSync(CHEMIN);

  // Le journal en mode WAL autorise des lectures pendant une écriture : sans
  // lui, un webhook et une activation simultanés se bloquent mutuellement.
  base.exec('PRAGMA journal_mode = WAL');
  base.exec(`
    CREATE TABLE IF NOT EXISTS commandes (
      reference        TEXT PRIMARY KEY,
      email            TEXT NOT NULL,
      nom              TEXT NOT NULL,
      offre            TEXT NOT NULL,
      montant_xof      INTEGER NOT NULL,
      statut           TEXT NOT NULL DEFAULT 'en_attente',
      transaction_id   TEXT,
      cree_le          INTEGER NOT NULL,
      paye_le          INTEGER
    );

    CREATE TABLE IF NOT EXISTS licences (
      cle              TEXT PRIMARY KEY,
      commande         TEXT NOT NULL REFERENCES commandes(reference),
      email            TEXT NOT NULL,
      offre            TEXT NOT NULL,
      postes           INTEGER NOT NULL,
      revoquee         INTEGER NOT NULL DEFAULT 0,
      emise_le         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activations (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      cle              TEXT NOT NULL REFERENCES licences(cle),
      empreinte        TEXT NOT NULL,
      nom_machine      TEXT NOT NULL,
      activee_le       INTEGER NOT NULL,
      vue_le           INTEGER NOT NULL,
      liberee_le       INTEGER,
      UNIQUE (cle, empreinte)
    );

    CREATE INDEX IF NOT EXISTS idx_licences_email ON licences(email);
    CREATE INDEX IF NOT EXISTS idx_activations_cle ON activations(cle);
  `);

  return base;
}

const maintenant = () => Math.floor(Date.now() / 1000);

// ── Commandes ────────────────────────────────────────────────────────────

export interface Commande {
  reference: string;
  email: string;
  nom: string;
  offre: string;
  montant_xof: number;
  statut: 'en_attente' | 'payee' | 'echouee';
  transaction_id: string | null;
  cree_le: number;
  paye_le: number | null;
}

export function enregistrerCommande(commande: {
  reference: string;
  email: string;
  nom: string;
  offre: string;
  montantXOF: number;
}): void {
  connexion()
    .prepare(
      `INSERT INTO commandes (reference, email, nom, offre, montant_xof, cree_le)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      commande.reference,
      commande.email,
      commande.nom,
      commande.offre,
      commande.montantXOF,
      maintenant(),
    );
}

export function commandeParReference(reference: string): Commande | undefined {
  return connexion()
    .prepare('SELECT * FROM commandes WHERE reference = ?')
    .get(reference) as Commande | undefined;
}

export function marquerCommandePayee(reference: string, transactionId: string): void {
  connexion()
    .prepare(
      `UPDATE commandes SET statut = 'payee', transaction_id = ?, paye_le = ?
       WHERE reference = ? AND statut != 'payee'`,
    )
    .run(transactionId, maintenant(), reference);
}

// ── Licences ─────────────────────────────────────────────────────────────

export interface Licence {
  cle: string;
  commande: string;
  email: string;
  offre: string;
  postes: number;
  revoquee: number;
  emise_le: number;
}

/**
 * Enregistre une licence si la commande n'en a pas déjà une.
 *
 * SasPay peut renvoyer plusieurs fois le même événement : sans cette garde,
 * un client recevrait deux clés pour un seul paiement.
 */
export function enregistrerLicence(licence: {
  cle: string;
  commande: string;
  email: string;
  offre: string;
  postes: number;
}): { creee: boolean; cle: string } {
  const existante = connexion()
    .prepare('SELECT cle FROM licences WHERE commande = ?')
    .get(licence.commande) as { cle: string } | undefined;

  if (existante) return { creee: false, cle: existante.cle };

  connexion()
    .prepare(
      `INSERT INTO licences (cle, commande, email, offre, postes, emise_le)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(licence.cle, licence.commande, licence.email, licence.offre, licence.postes, maintenant());

  return { creee: true, cle: licence.cle };
}

export function licenceParCle(cle: string): Licence | undefined {
  return connexion().prepare('SELECT * FROM licences WHERE cle = ?').get(cle) as
    | Licence
    | undefined;
}

export function licenceParCommande(commande: string): Licence | undefined {
  return connexion().prepare('SELECT * FROM licences WHERE commande = ?').get(commande) as
    | Licence
    | undefined;
}

// ── Activations ──────────────────────────────────────────────────────────

export interface Activation {
  id: number;
  cle: string;
  empreinte: string;
  nom_machine: string;
  activee_le: number;
  vue_le: number;
  liberee_le: number | null;
}

export function activationsActives(cle: string): Activation[] {
  return connexion()
    .prepare('SELECT * FROM activations WHERE cle = ? AND liberee_le IS NULL ORDER BY activee_le')
    .all(cle) as unknown as Activation[];
}

export function activationExistante(cle: string, empreinte: string): Activation | undefined {
  return connexion()
    .prepare('SELECT * FROM activations WHERE cle = ? AND empreinte = ? AND liberee_le IS NULL')
    .get(cle, empreinte) as Activation | undefined;
}

/**
 * Active une machine, ou rafraîchit son horodatage si elle l'était déjà.
 *
 * Réactiver la même machine ne consomme pas de poste : sans cela, une
 * réinstallation du logiciel épuiserait le quota du client légitime.
 */
export function activerMachine(cle: string, empreinte: string, nomMachine: string): void {
  const deja = activationExistante(cle, empreinte);
  if (deja) {
    connexion().prepare('UPDATE activations SET vue_le = ? WHERE id = ?').run(maintenant(), deja.id);
    return;
  }

  connexion()
    .prepare(
      `INSERT INTO activations (cle, empreinte, nom_machine, activee_le, vue_le)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (cle, empreinte)
       DO UPDATE SET liberee_le = NULL, vue_le = excluded.vue_le`,
    )
    .run(cle, empreinte, nomMachine, maintenant(), maintenant());
}

/** Libère un poste pour que le client puisse en activer un autre. */
export function libererMachine(cle: string, empreinte: string): boolean {
  const resultat = connexion()
    .prepare('UPDATE activations SET liberee_le = ? WHERE cle = ? AND empreinte = ? AND liberee_le IS NULL')
    .run(maintenant(), cle, empreinte);
  return Number(resultat.changes) > 0;
}
