/**
 * Grille tarifaire — source unique, lue par la page Tarifs et par le paiement.
 *
 * Les montants sont définis en francs CFA, car c'est la devise dans laquelle
 * SasPay encaisse réellement. Le prix en dollars est un repère d'affichage pour
 * les visiteurs internationaux : leur banque convertira au moment du débit
 * par carte. Afficher un montant en dollars sans dire lequel est prélevé serait
 * trompeur — la page l'indique explicitement.
 *
 * Deux règles tiennent cette grille, et toute modification doit les respecter :
 *
 * 1. **Le prix par poste décroît d'une offre à la suivante.** La grille
 *    précédente ne le faisait pas (39 500 XOF le poste en Solo, 59 800 en
 *    Équipe) : un cabinet de cinq personnes avait mathématiquement intérêt à
 *    acheter trois licences Solo. Une grille qui punit le client qui monte en
 *    gamme le pousse à la contourner. `tarifsCoherents()` en fait un test.
 *
 * 2. **Ce sont des prix de lancement, et ils le disent.** Le logiciel n'a pas
 *    d'historique de versions publiées, pas de références clients, pas
 *    d'organisation de support derrière lui. Les premiers acheteurs prennent
 *    le risque ; ce qui vaut plus que la marge aujourd'hui, c'est d'avoir des
 *    acheteurs du tout — leurs retours sur données réelles. Les prix monteront
 *    quand il y aura de quoi les justifier, et la licence étant perpétuelle,
 *    une hausse ne retire rien à qui a déjà acheté.
 */

import type { TypeLicence } from './licence';

/** Le franc CFA est arrimé à l'euro (655,957 XOF = 1 EUR). Le taux dollar
 *  bouge : cette valeur sert d'affichage indicatif, pas de facturation. */
export const TAUX_USD_XOF = 600;

/** Affiché sur la page Tarifs. Voir la règle 2 de l'en-tête. */
export const TARIF_DE_LANCEMENT = true;

export interface Offre {
  type: TypeLicence;
  nom: string;
  resume: string;
  prixXOF: number;
  postes: number;
  /** Mois de mises à jour inclus. Au-delà, le logiciel continue de fonctionner. */
  moisMaintenance: number;
  inclus: string[];
  miseEnAvant?: boolean;
}

export const OFFRES: Offre[] = [
  {
    type: 'solo',
    nom: 'Solo',
    resume: 'Pour un analyste, un consultant, un doctorant.',
    prixXOF: 25000,
    postes: 2,
    moisMaintenance: 12,
    inclus: [
      'Licence perpétuelle : le logiciel ne cesse jamais de fonctionner',
      '2 machines activables (poste fixe et portable)',
      '12 mois de mises à jour incluses',
      'Toutes les analyses, sans restriction de fonctionnalité',
      'Support par courriel sous 48 h',
    ],
    miseEnAvant: true,
  },
  {
    type: 'equipe',
    nom: 'Équipe',
    resume: "Pour un cabinet, un service études, un laboratoire.",
    prixXOF: 89000,
    postes: 10,
    moisMaintenance: 12,
    inclus: [
      'Tout ce que comprend Solo',
      '10 machines activables, transférables entre collaborateurs',
      'Facture au nom de la structure',
      'Support prioritaire sous 24 h',
    ],
  },
  {
    type: 'site',
    nom: 'Établissement',
    resume: 'Pour une université ou une direction entière.',
    prixXOF: 249000,
    postes: 50,
    moisMaintenance: 24,
    inclus: [
      'Tout ce que comprend Équipe',
      '50 machines activables',
      '24 mois de mises à jour incluses',
      "Accompagnement à l'installation",
      'Tarif académique : nous consulter',
    ],
  },
];

/** Prix affiché en dollars, arrondi pour ne pas afficher de fausse précision. */
export function prixUSD(prixXOF: number): number {
  return Math.round(prixXOF / TAUX_USD_XOF);
}

/** Coût d'un poste dans une offre, pour comparer les offres entre elles. */
export function prixParPoste(offre: Offre): number {
  return Math.round(offre.prixXOF / offre.postes);
}

/**
 * Vérifie la règle 1 : le prix par poste décroît strictement d'une offre à la
 * suivante. Exporté pour être testé, et non enfoui dans un commentaire — c'est
 * exactement le genre d'erreur qui revient au prochain ajustement de prix.
 */
export function tarifsCoherents(offres: Offre[] = OFFRES): boolean {
  return offres.every(
    (offre, index) => index === 0 || prixParPoste(offre) < prixParPoste(offres[index - 1]),
  );
}

export function offreParType(type: string): Offre | undefined {
  return OFFRES.find((offre) => offre.type === type);
}

export function formaterXOF(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`;
}
