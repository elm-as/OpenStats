import { NextResponse } from 'next/server';
import { webhookAuthentique, type EvenementPaiement } from '@/lib/saspay';
import { genererCle, type ContenuLicence } from '@/lib/licence';
import { offreParType } from '@/lib/tarifs';
import { commandeParReference, enregistrerLicence, marquerCommandePayee } from '@/lib/stockage';
import { envoyerCleLicence } from '@/lib/courriel';

/**
 * Réception des notifications de paiement SasPay.
 *
 * C'est le seul endroit où une licence est émise. Surtout pas au retour du
 * navigateur : l'utilisateur contrôle son navigateur et peut atteindre la page
 * de remerciement sans avoir payé. Le webhook, lui, est signé par le
 * prestataire et vérifié ici.
 */
export const runtime = 'nodejs';

export async function POST(requete: Request) {
  // Le corps doit être lu brut : re-sérialiser le JSON changerait les espaces
  // et l'ordre des clés, donc invaliderait une signature pourtant correcte.
  const corpsBrut = await requete.text();

  const authentique = webhookAuthentique(
    corpsBrut,
    requete.headers.get('X-Webhook-Signature'),
    requete.headers.get('X-Webhook-Timestamp'),
  );

  if (!authentique) {
    console.warn('[webhook] signature refusée');
    return NextResponse.json({ erreur: 'signature invalide' }, { status: 401 });
  }

  let evenement: EvenementPaiement;
  try {
    evenement = JSON.parse(corpsBrut) as EvenementPaiement;
  } catch {
    return NextResponse.json({ erreur: 'charge illisible' }, { status: 400 });
  }

  if (evenement.event !== 'transaction.success') {
    // Les autres événements sont acquittés sans traitement : renvoyer une
    // erreur ferait réessayer le prestataire indéfiniment pour rien.
    return NextResponse.json({ recu: true });
  }

  const metadonnees = evenement.data.metadata ?? {};
  const offre = offreParType(metadonnees.offre ?? '');
  const commande = metadonnees.commande;
  const email = metadonnees.email;

  if (!offre || !commande || !email) {
    console.error('[webhook] métadonnées incomplètes', metadonnees);
    return NextResponse.json({ erreur: 'métadonnées incomplètes' }, { status: 422 });
  }

  // La commande doit exister chez nous : elle n'est creee que par notre propre
  // route de paiement. Emettre une licence pour une reference inconnue
  // reviendrait a laisser quiconque possede le secret du webhook fabriquer des
  // licences a volonte.
  const commandeEnregistree = commandeParReference(commande);
  if (!commandeEnregistree) {
    console.error('[webhook] commande inconnue', { commande, transaction: evenement.data.reference });
    return NextResponse.json({ erreur: 'commande inconnue' }, { status: 422 });
  }

  const secret = process.env.LICENCE_SECRET;
  if (!secret) {
    // Émettre une clé avec un secret par défaut reviendrait à distribuer des
    // licences que n'importe qui pourrait forger : mieux vaut échouer bruyamment.
    console.error('[webhook] LICENCE_SECRET absente, aucune clé émise');
    return NextResponse.json({ erreur: 'configuration serveur incomplète' }, { status: 500 });
  }

  const contenu: ContenuLicence = {
    commande,
    email,
    type: offre.type,
    postes: offre.postes,
    maintenanceJusquA:
      Math.floor(Date.now() / 1000) + offre.moisMaintenance * 30 * 24 * 3600,
    version: '1',
  };

  const cle = genererCle(contenu, secret);

  marquerCommandePayee(commande, evenement.data.reference);

  // SasPay peut renvoyer le meme evenement plusieurs fois : l'enregistrement
  // est idempotent, un second envoi rend la cle deja emise au lieu d'en creer
  // une seconde pour le meme paiement.
  const { creee, cle: cleFinale } = enregistrerLicence({
    cle,
    commande,
    email,
    offre: offre.type,
    postes: offre.postes,
  });

  if (creee) {
    console.info('[webhook] licence emise', { commande, email, offre: offre.type });

    // L'echec d'envoi ne fait pas echouer le webhook : la licence est deja
    // enregistree, et la renvoyer en erreur ferait reessayer SasPay, donc
    // reemettre. Le client la retrouve dans son espace avec sa reference.
    const envoye = await envoyerCleLicence({
      destinataire: email,
      nom: commandeEnregistree.nom,
      cle: cleFinale,
      postes: offre.postes,
      urlEspace: `${process.env.SITE_URL ?? ''}/compte`,
    });
    if (!envoye) {
      console.warn('[webhook] cle non envoyee par courriel', { commande, email });
    }
  }

  return NextResponse.json({ recu: true, commande, cle: cleFinale });
}
