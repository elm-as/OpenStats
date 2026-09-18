/**
 * Envoi de la clé de licence au client.
 *
 * Le fournisseur est branché par variable d'environnement. Sans configuration,
 * la fonction ne prétend pas avoir envoyé : elle journalise et rend `false`,
 * pour que l'appelant sache que le client n'a rien reçu et puisse l'orienter
 * vers son espace client.
 */

const EXPEDITEUR = process.env.COURRIEL_EXPEDITEUR ?? 'OpenStats <licences@openstats.app>';

export interface Courriel {
  destinataire: string;
  sujet: string;
  texte: string;
}

function messageLicence(nom: string, cle: string, postes: number, urlEspace: string): Courriel {
  return {
    destinataire: '',
    sujet: 'Votre licence OpenStats',
    texte: [
      `Bonjour ${nom},`,
      '',
      'Merci pour votre achat. Voici votre clé de licence :',
      '',
      cle,
      '',
      `Elle autorise ${postes} machines activées en même temps.`,
      '',
      'Pour démarrer :',
      `1. Téléchargez le logiciel depuis votre espace : ${urlEspace}`,
      '2. Installez-le, puis lancez OpenStats.',
      '3. Collez cette clé à la première ouverture.',
      '',
      "Conservez ce message : la clé contient votre adresse, et le nombre d'activations",
      'est limité. Vous pouvez libérer une machine depuis votre espace client à tout moment.',
      '',
      "En cas de difficulté, répondez simplement à ce message.",
      '',
      "L'équipe OpenStats",
    ].join('\n'),
  };
}

/**
 * Envoie la clé. Rend `true` seulement si le fournisseur a accepté le message.
 */
export async function envoyerCleLicence(params: {
  destinataire: string;
  nom: string;
  cle: string;
  postes: number;
  urlEspace: string;
}): Promise<boolean> {
  const cleApi = process.env.RESEND_API_KEY;
  const message = messageLicence(params.nom, params.cle, params.postes, params.urlEspace);

  if (!cleApi) {
    console.warn(
      "[courriel] RESEND_API_KEY absente : la clé n'a PAS été envoyée à " +
        `${params.destinataire}. Elle reste consultable dans l'espace client.`,
    );
    return false;
  }

  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleApi}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: params.destinataire,
        subject: message.sujet,
        text: message.texte,
      }),
    });

    if (!reponse.ok) {
      console.error('[courriel] envoi refusé', reponse.status, await reponse.text());
      return false;
    }
    return true;
  } catch (erreur) {
    console.error('[courriel] envoi impossible', erreur);
    return false;
  }
}
