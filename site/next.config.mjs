import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le binaire est servi depuis un stockage externe signe, pas depuis le site :
  // un fichier de 400 Mo n'a rien a faire dans le depot ni dans le build.
  poweredByHeader: false,
  // Next remonte l'arborescence a la recherche d'un fichier de verrouillage pour
  // deviner la racine. Il en existe un egare dans le dossier personnel de
  // l'utilisateur, qu'il choisissait a la place de celui-ci : la construction
  // echouait alors sur un `/_document` introuvable. La racine est ce dossier.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
};

export default nextConfig;
