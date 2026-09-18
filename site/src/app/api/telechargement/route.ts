import { NextResponse } from 'next/server';
import { lireCle } from '@/lib/licence';
import { licenceParCle } from '@/lib/stockage';

/**
 * Redirige vers le programme d'installation, après vérification de la licence.
 *
 * Le binaire n'est pas servi par le site : un fichier de plusieurs centaines de
 * mégaoctets sature la bande passante applicative. Il vit sur un stockage
 * externe, et l'URL est fournie par configuration.
 *
 * Contrôler la licence ici ne protège pas le fichier — une fois téléchargé il
 * circule librement. Cela évite seulement que l'adresse de téléchargement soit
 * publique, et surtout, c'est l'activation qui rend une copie inutilisable.
 */
export const runtime = 'nodejs';

export async function GET(requete: Request) {
  const url = new URL(requete.url);
  const cle = (url.searchParams.get('cle') ?? '').trim();

  const secret = process.env.LICENCE_SECRET;
  const urlBinaire = process.env.URL_INSTALLEUR;

  if (!secret || !urlBinaire) {
    console.error('[telechargement] LICENCE_SECRET ou URL_INSTALLEUR absente');
    return NextResponse.json(
      { erreur: "Le téléchargement n'est pas encore configuré." },
      { status: 503 },
    );
  }

  if (!lireCle(cle, secret) || !licenceParCle(cle)) {
    return NextResponse.json(
      { erreur: 'Licence invalide : téléchargement refusé.' },
      { status: 403 },
    );
  }

  return NextResponse.redirect(urlBinaire, 302);
}
