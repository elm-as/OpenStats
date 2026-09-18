import { NextResponse } from 'next/server';
import { lireCle } from '@/lib/licence';
import {
  MESSAGES_REFUS,
  TOLERANCE_HORS_LIGNE_JOURS,
  emettreJeton,
  empreinteValide,
  type MotifRefus,
} from '@/lib/activation';
import { activationExistante, activationsActives, activerMachine, licenceParCle } from '@/lib/stockage';

/**
 * Active une licence sur une machine et rend un jeton signé.
 *
 * Appelée par le logiciel : à la première utilisation d'une clé, puis
 * périodiquement pour revalider. Le jeton rendu contient l'empreinte machine,
 * ce qui permet au logiciel de vérifier hors ligne qu'il tourne bien sur la
 * machine activée — un jeton recopié ailleurs est rejeté sans réseau.
 */
export const runtime = 'nodejs';

function refus(motif: MotifRefus, code = 403) {
  return NextResponse.json({ active: false, motif, message: MESSAGES_REFUS[motif] }, { status: code });
}

export async function POST(requete: Request) {
  let corps: { cle?: string; empreinte?: string; nomMachine?: string };

  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const cle = String(corps.cle ?? '').trim();
  const empreinte = String(corps.empreinte ?? '').trim().toLowerCase();
  const nomMachine = String(corps.nomMachine ?? 'Poste sans nom').slice(0, 80);

  if (!empreinteValide(empreinte)) return refus('empreinte_invalide', 400);

  const secretLicence = process.env.LICENCE_SECRET;
  const secretActivation = process.env.ACTIVATION_SECRET;
  if (!secretLicence || !secretActivation) {
    console.error('[activation] secrets absents');
    return NextResponse.json({ erreur: 'configuration serveur incomplète' }, { status: 500 });
  }

  // Deux vérifications distinctes, et toutes deux nécessaires : la signature
  // prouve que la clé vient de nous, la base prouve qu'elle a bien été vendue.
  // Une clé forgée échoue à la première ; une clé authentique révoquée ou
  // fabriquée avant mise en base échoue à la seconde.
  const contenu = lireCle(cle, secretLicence);
  if (!contenu) return refus('cle_invalide');

  const licence = licenceParCle(cle);
  if (!licence) return refus('cle_inconnue');
  if (licence.revoquee) return refus('licence_revoquee');

  // Une machine déjà activée ne reconsomme pas de poste : sans cela, une
  // simple réinstallation épuiserait le quota du client légitime.
  const deja = activationExistante(cle, empreinte);
  if (!deja && activationsActives(cle).length >= licence.postes) {
    return refus('quota_atteint');
  }

  activerMachine(cle, empreinte, nomMachine);

  return NextResponse.json({
    active: true,
    jeton: emettreJeton(cle, empreinte, secretActivation),
    offre: licence.offre,
    postes: licence.postes,
    postesUtilises: activationsActives(cle).length,
    maintenanceJusquA: contenu.maintenanceJusquA,
    revalidationDansJours: TOLERANCE_HORS_LIGNE_JOURS,
  });
}
