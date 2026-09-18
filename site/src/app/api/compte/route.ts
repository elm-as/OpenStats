import { NextResponse } from 'next/server';
import { lireCle } from '@/lib/licence';
import { activationsActives, libererMachine, licenceParCle } from '@/lib/stockage';

/**
 * Consultation et gestion d'une licence par son propriétaire.
 *
 * La clé fait office de mot de passe : seule la personne qui la détient peut
 * voir ses machines et en libérer une. Une recherche par adresse électronique
 * laisserait n'importe qui énumérer les licences d'autrui.
 */
export const runtime = 'nodejs';

function etatLicence(cle: string) {
  const licence = licenceParCle(cle);
  if (!licence) return null;

  const machines = activationsActives(cle).map((activation) => ({
    empreinte: activation.empreinte,
    // L'empreinte complète n'a pas à circuler : un préfixe suffit à distinguer
    // deux postes dans une liste.
    identifiantCourt: activation.empreinte.slice(0, 12),
    nomMachine: activation.nom_machine,
    activeeLe: activation.activee_le,
    vueLe: activation.vue_le,
  }));

  return {
    offre: licence.offre,
    email: licence.email,
    postes: licence.postes,
    postesUtilises: machines.length,
    revoquee: Boolean(licence.revoquee),
    emiseLe: licence.emise_le,
    machines,
  };
}

export async function POST(requete: Request) {
  let corps: { cle?: string; action?: string; empreinte?: string };

  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const cle = String(corps.cle ?? '').trim();
  const secret = process.env.LICENCE_SECRET;

  if (!secret) {
    return NextResponse.json({ erreur: 'configuration serveur incomplète' }, { status: 500 });
  }

  // La signature est vérifiée avant toute lecture en base : une clé mal formée
  // ne doit pas déclencher de requête, ni permettre de deviner par le temps de
  // réponse si une clé existe.
  if (!lireCle(cle, secret)) {
    return NextResponse.json({ erreur: 'Clé invalide ou incomplète.' }, { status: 403 });
  }

  if (corps.action === 'liberer') {
    const empreinte = String(corps.empreinte ?? '').trim().toLowerCase();
    const libere = libererMachine(cle, empreinte);
    if (!libere) {
      return NextResponse.json(
        { erreur: "Cette machine n'est pas active sur cette licence." },
        { status: 404 },
      );
    }
  }

  const etat = etatLicence(cle);
  if (!etat) {
    return NextResponse.json({ erreur: 'Licence introuvable.' }, { status: 404 });
  }

  return NextResponse.json(etat);
}
