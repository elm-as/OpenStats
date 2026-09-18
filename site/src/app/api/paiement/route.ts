import { NextResponse } from 'next/server';
import { creerSessionPaiement } from '@/lib/saspay';
import { nouvelleReferenceCommande } from '@/lib/licence';
import { offreParType } from '@/lib/tarifs';
import { enregistrerCommande } from '@/lib/stockage';

/**
 * Crée un paiement et rend l'URL de la page SasPay.
 *
 * Le montant n'est jamais lu depuis la requête : il est repris de la grille
 * tarifaire à partir du seul identifiant d'offre. Accepter un prix envoyé par
 * le navigateur laisserait n'importe qui acheter une licence à un franc.
 */
export const runtime = 'nodejs';

export async function POST(requete: Request) {
  let corps: { offre?: string; nom?: string; email?: string; telephone?: string };

  try {
    corps = await requete.json();
  } catch {
    return NextResponse.json({ erreur: 'Requête illisible.' }, { status: 400 });
  }

  const offre = offreParType(String(corps.offre ?? ''));
  if (!offre) {
    return NextResponse.json({ erreur: 'Offre inconnue.' }, { status: 400 });
  }

  const nom = String(corps.nom ?? '').trim();
  const email = String(corps.email ?? '').trim().toLowerCase();

  if (nom.length < 2) {
    return NextResponse.json({ erreur: 'Nom manquant.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ erreur: 'Adresse électronique invalide.' }, { status: 400 });
  }

  const commande = nouvelleReferenceCommande();
  const origine = process.env.SITE_URL ?? new URL(requete.url).origin;

  // La commande est enregistree avant l'appel au prestataire : si SasPay
  // repond puis que notre serveur tombe, le webhook retrouvera quand meme
  // a quelle commande rattacher le paiement.
  enregistrerCommande({
    reference: commande,
    email,
    nom,
    offre: offre.type,
    montantXOF: offre.prixXOF,
  });

  try {
    const session = await creerSessionPaiement({
      montantXOF: offre.prixXOF,
      description: `OpenStats — licence ${offre.nom} (${offre.postes} postes)`,
      email,
      nom,
      telephone: corps.telephone ? String(corps.telephone).trim() : undefined,
      // Ces métadonnées reviennent dans le webhook : c'est par elles que le
      // paiement confirmé retrouve la commande à laquelle émettre une licence.
      metadonnees: { commande, offre: offre.type, email },
      urlRetour: `${origine}/merci?commande=${commande}`,
    });

    return NextResponse.json({ urlPaiement: session.urlPaiement, commande });
  } catch (erreur) {
    // Le détail part dans les journaux du serveur, pas au navigateur : il peut
    // contenir la réponse brute du prestataire.
    console.error('[paiement] création impossible', erreur);
    return NextResponse.json(
      { erreur: "Le paiement n'a pas pu être initié. Réessayez dans un instant." },
      { status: 502 },
    );
  }
}
