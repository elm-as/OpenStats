/**
 * Vérifie la grille tarifaire avant toute construction du site.
 *
 * Une règle de prix écrite seulement en commentaire ne survit pas au premier
 * ajustement fait dans l'urgence. Celle-ci casse le build.
 *
 * Exécuté par `npm run verifier:tarifs`, lui-même appelé par `npm run build`.
 */

import { OFFRES, formaterXOF, prixParPoste, prixUSD, tarifsCoherents } from '../src/lib/tarifs.ts';

const echecs: string[] = [];

for (const offre of OFFRES) {
  if (offre.prixXOF <= 0) echecs.push(`${offre.nom} : prix nul ou négatif.`);
  if (offre.postes < 1) echecs.push(`${offre.nom} : aucun poste activable.`);
  // Saspay encaisse en francs CFA, qui n'ont pas de subdivision en usage.
  if (!Number.isInteger(offre.prixXOF)) echecs.push(`${offre.nom} : montant non entier.`);
}

if (!tarifsCoherents()) {
  echecs.push(
    'Le prix par poste ne décroît pas d\'une offre à la suivante : le client ' +
      'qui monte en gamme paierait plus cher le poste, et achèterait plusieurs ' +
      'licences inférieures à la place.',
  );
}

console.log('Grille tarifaire :');
for (const offre of OFFRES) {
  console.log(
    `  ${offre.nom.padEnd(14)} ${formaterXOF(offre.prixXOF).padStart(14)}` +
      ` ≈ ${String(prixUSD(offre.prixXOF)).padStart(4)} $` +
      ` · ${String(offre.postes).padStart(2)} postes` +
      ` · ${formaterXOF(prixParPoste(offre))} par poste`,
  );
}

if (echecs.length > 0) {
  console.error('\nGrille tarifaire invalide :');
  for (const echec of echecs) console.error(`  - ${echec}`);
  process.exit(1);
}

console.log('\nGrille cohérente.');
