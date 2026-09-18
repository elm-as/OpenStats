/**
 * Grille tarifaire — source unique, lue par la page Tarifs et par le paiement.
 *
 * Les montants sont définis en francs CFA, car c'est la devise dans laquelle
 * SasPay encaisse réellement. Le prix en dollars est un repère d'affichage pour
 * les visiteurs internationaux : leur banque convertira au moment du débit
 * par carte. Afficher un montant en dollars sans dire lequel est prélevé serait
 * trompeur — la page l'indique explicitement.
 */

import type { TypeLicence } from './licence';

/** Le franc CFA est arrimé à l'euro (655,957 XOF = 1 EUR). Le taux dollar
 *  bouge : cette valeur sert d'affichage indicatif, pas de facturation. */
export const TAUX_USD_XOF = 600;

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
    prixXOF: 79000,
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
    prixXOF: 299000,
    postes: 5,
    moisMaintenance: 12,
    inclus: [
      'Tout ce que comprend Solo',
      '5 machines activables, transférables entre collaborateurs',
      'Facture au nom de la structure',
      'Support prioritaire sous 24 h',
    ],
  },
  {
    type: 'site',
    nom: 'Établissement',
    resume: 'Pour une université ou une direction entière.',
    prixXOF: 899000,
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

export function offreParType(type: string): Offre | undefined {
  return OFFRES.find((offre) => offre.type === type);
}

export function formaterXOF(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`;
}
