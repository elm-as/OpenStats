import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

const racine = dirname(fileURLToPath(import.meta.url));

/**
 * Configuration du site.
 *
 * Le dossier de sortie depend de la phase, et ce n'est pas un detail de confort :
 * `next dev` et `next build` ecrivaient tous deux dans `.next`. Lancer une
 * construction pendant que le serveur de developpement tourne remplacait sous
 * ses pieds les fragments qu'il gardait en memoire, et la page suivante
 * echouait sur un « Cannot find module './611.js' » dont la cause n'a rien
 * d'evident quand on la rencontre. Les deux ecrivent desormais ailleurs.
 *
 * @type {(phase: string) => import('next').NextConfig}
 */
export default function configuration(phase) {
  return {
    reactStrictMode: true,
    // Le binaire est servi depuis un stockage externe signe, pas depuis le site :
    // un fichier de 400 Mo n'a rien a faire dans le depot ni dans le build.
    poweredByHeader: false,
    // Next remonte l'arborescence a la recherche d'un fichier de verrouillage pour
    // deviner la racine. Il en existe un egare dans le dossier personnel de
    // l'utilisateur, qu'il choisissait a la place de celui-ci : la construction
    // echouait alors sur un `/_document` introuvable. La racine est ce dossier.
    outputFileTracingRoot: racine,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-production',
  };
}
