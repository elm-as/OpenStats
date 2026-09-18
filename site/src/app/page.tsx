import Link from 'next/link';
import { OFFRES, formaterXOF, prixUSD } from '@/lib/tarifs';

const CAPACITES = [
  {
    titre: 'Économétrie sérieuse',
    texte:
      "Panel à effets fixes et aléatoires avec test de Hausman, variables instrumentales, " +
      "différence de différences, modèles de comptage. Les hypothèses sont testées, pas supposées.",
  },
  {
    titre: 'Séries temporelles validées',
    texte:
      "ARIMA, SARIMA, VAR, VECM, cointégration de Johansen, GARCH estimé par maximum de " +
      "vraisemblance. Chaque prévision est comparée à une référence naïve avant d'être présentée.",
  },
  {
    titre: 'Apprentissage explicable',
    texte:
      "Quinze modèles mis en compétition par validation croisée, valeurs SHAP, importance " +
      "des variables. Un score sans référence ne veut rien dire : il y en a toujours une.",
  },
  {
    titre: 'Canevas visuel',
    texte:
      "49 types de nœuds à relier : import, nettoyage, tests, modèles, graphiques, export. " +
      "Le pipeline se lit d'un coup d'œil et se rejoue sur de nouvelles données.",
  },
  {
    titre: 'Code source exportable',
    texte:
      "Votre analyse s'exporte en script Python, en script R ou en carnet Jupyter — avec les " +
      "mêmes constantes que celles utilisées dans le logiciel. Rien n'est enfermé.",
  },
  {
    titre: 'Rapports professionnels',
    texte:
      "PDF, Word ou PowerPoint, avec tableaux de résultats, graphiques et interprétation " +
      "rédigée. Prêts à circuler dans une organisation.",
  },
];

const GARANTIES = [
  {
    titre: 'Vos données restent chez vous',
    texte:
      "Le logiciel s'exécute sur votre machine. Aucun jeu de données n'est transmis, " +
      "à nous ou à qui que ce soit. C'est une propriété de l'architecture, pas une promesse.",
  },
  {
    titre: 'Licence perpétuelle',
    texte:
      "Vous achetez une version, vous la gardez. Si vous ne renouvelez pas la maintenance, " +
      "le logiciel continue de fonctionner — vous cessez simplement de recevoir les nouveautés.",
  },
  {
    titre: 'Hors ligne pendant trois semaines',
    texte:
      "Une connexion est nécessaire pour activer un poste, puis environ toutes les trois " +
      "semaines. Entre-temps, vous travaillez sans réseau.",
  },
];

export default function Accueil() {
  const solo = OFFRES[0];

  return (
    <>
      <section className="halo-accent border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-20 md:pt-28">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-400">
            Windows · Licence perpétuelle · Hors ligne
          </p>

          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl">
            L&apos;analyse statistique sans compromis sur la rigueur.
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-surface-300 md:text-base">
            OpenStats réunit l&apos;économétrie, les séries temporelles et l&apos;apprentissage
            automatique dans un logiciel de bureau qui vous dit aussi quand un résultat ne tient
            pas. Les hypothèses sont testées, les modèles comparés à une référence, et le code
            de votre analyse s&apos;exporte en Python ou en R.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/tarifs"
              className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-surface-950 transition-colors hover:bg-accent-400"
            >
              Acheter — {formaterXOF(solo.prixXOF)} · ${prixUSD(solo.prixXOF)}
            </Link>
            <Link
              href="/fonctionnalites"
              className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-surface-200 transition-colors hover:border-white/25 hover:text-white"
            >
              Voir ce qu&apos;il sait faire
            </Link>
          </div>

          <p className="mt-4 text-[12px] text-surface-500">
            Paiement par carte bancaire, Orange Money, MTN, Moov ou Wave. Prix en francs CFA ;
            le montant en dollars est indicatif.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Ce que le logiciel sait faire
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {CAPACITES.map((capacite) => (
            <article
              key={capacite.titre}
              className="rounded-2xl border border-white/5 bg-surface-800/40 p-6"
            >
              <h3 className="text-[15px] font-bold text-white">{capacite.titre}</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-surface-300">
                {capacite.texte}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-white/5 bg-surface-950/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Ce sur quoi nous nous engageons
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {GARANTIES.map((garantie) => (
              <div key={garantie.titre}>
                <h3 className="text-[15px] font-bold text-accent-400">{garantie.titre}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-surface-300">
                  {garantie.texte}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="rounded-3xl border border-accent-500/20 bg-accent-500/5 p-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Une licence, deux machines, pour toujours.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-surface-300">
            {formaterXOF(solo.prixXOF)} — environ ${prixUSD(solo.prixXOF)} — avec douze mois de
            mises à jour incluses et toutes les analyses débloquées.
          </p>
          <Link
            href="/tarifs"
            className="mt-7 inline-block rounded-xl bg-accent-500 px-7 py-3 text-sm font-semibold text-surface-950 transition-colors hover:bg-accent-400"
          >
            Voir les offres
          </Link>
        </div>
      </section>
    </>
  );
}
