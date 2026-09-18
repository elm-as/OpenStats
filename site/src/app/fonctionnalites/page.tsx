import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Fonctionnalités',
  description:
    "Économétrie de panel, séries temporelles multivariées, apprentissage explicable, " +
    "canevas nodal et export de code : ce que fait OpenStats, en détail.",
};

const FAMILLES = [
  {
    titre: 'Statistiques descriptives et tests',
    analyses: [
      'Moyennes, dispersion, asymétrie, aplatissement, intervalles par bootstrap',
      'Corrélations de Pearson, Spearman et Kendall, avec significativité',
      'Comparaison de moyennes : t de Student, Welch, Mann-Whitney',
      "ANOVA et Kruskal-Wallis, suivies de post-hoc Tukey ou Games-Howell selon l'homogénéité des variances",
      "Indépendance : chi-carré, Fisher exact, V de Cramér",
      'Normalité (Shapiro-Wilk), stationnarité (ADF et KPSS croisés)',
      "Puissance statistique et effet minimal détectable",
      "Test d'équivalence (TOST) pour démontrer une absence d'effet",
    ],
  },
  {
    titre: 'Économétrie',
    analyses: [
      'Panel à effets fixes et aléatoires, arbitrés par le test de Hausman',
      'Variables instrumentales (2SLS) avec diagnostic d’instrument faible',
      'Différence de différences et appariement par score de propension',
      'Modèles de comptage : Poisson et binomiale négative, choisis par test de surdispersion',
      'Régression quantile : effets sur la médiane et sur les queues',
      "Diagnostics complets : Breusch-Pagan, Jarque-Bera, Ljung-Box, RESET, Durbin-Watson",
    ],
  },
  {
    titre: 'Séries temporelles',
    analyses: [
      'ARIMA, SARIMA, lissage exponentiel, Prophet',
      'VAR, VECM, ARDL, BVAR, VARMAX',
      'Cointégration de Johansen, causalité de Granger, réponses impulsionnelles',
      'GARCH(1,1) estimé par maximum de vraisemblance',
      'Décomposition saisonnière et test de rupture structurelle de Chow',
      'Validation par origine glissante : chaque modèle est comparé à une référence naïve',
    ],
  },
  {
    titre: 'Apprentissage automatique',
    analyses: [
      'Quinze modèles supervisés mis en compétition par validation croisée',
      'Régression et classification, avec réglages exposés (profondeur, plis, séparation)',
      'Valeurs SHAP et importance des variables',
      'Clustering : k-moyennes, DBSCAN, mélanges gaussiens, classification hiérarchique',
      'ACP, AFC, ACM, projection t-SNE',
    ],
  },
  {
    titre: 'Méthode et honnêteté des résultats',
    analyses: [
      "Contrôle du taux de fausses découvertes sur l'ensemble d'une session d'exploration",
      'Sondes de robustesse : observations influentes, ruptures, hétérogénéité entre sous-groupes',
      "Boucle de correction : l'application détecte un problème, propose un remède, re-diagnostique",
      "Chaque violation d'hypothèse est accompagnée de sa conséquence et de son remède",
    ],
  },
  {
    titre: 'Restitution',
    analyses: [
      'Rapports PDF, Word et PowerPoint avec interprétation rédigée',
      'Export Excel avec formules vivantes',
      'Export du pipeline en script Python, script R ou carnet Jupyter',
      'Graphiques interactifs Plotly, personnalisables',
    ],
  },
];

export default function Fonctionnalites() {
  return (
    <>
      <section className="halo-accent border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Tout ce qu&apos;OpenStats sait faire.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-surface-300">
            Quarante-neuf types d&apos;analyses, reliées dans un canevas visuel. Toutes sont
            incluses dans chaque licence : il n&apos;y a pas de version amputée.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 md:grid-cols-2">
          {FAMILLES.map((famille) => (
            <article
              key={famille.titre}
              className="rounded-2xl border border-white/5 bg-surface-800/40 p-7"
            >
              <h2 className="text-[15px] font-bold text-accent-400">{famille.titre}</h2>
              <ul className="mt-4 space-y-2">
                {famille.analyses.map((analyse) => (
                  <li key={analyse} className="flex gap-2.5 text-[13px] leading-relaxed text-surface-200">
                    <span aria-hidden className="mt-1 shrink-0 text-surface-500">▸</span>
                    <span>{analyse}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/5 bg-surface-950/60">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Ce qu&apos;OpenStats ne fait pas
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-surface-300">
            Un logiciel qui prétend tout faire ment sur au moins un point. OpenStats
            n&apos;est pas un outil de tableau de bord temps réel, ne se connecte pas à des
            entrepôts de données distants, et ne remplace pas un statisticien : il exécute
            correctement ce que vous lui demandez, et vous avertit quand le résultat ne tient
            pas — il ne décide pas à votre place de ce qu&apos;il faut analyser.
          </p>
          <p className="mt-4 text-[14px] leading-relaxed text-surface-300">
            Il tourne aujourd&apos;hui sur Windows. Les versions macOS et Linux ne sont pas
            disponibles.
          </p>
          <Link
            href="/tarifs"
            className="mt-8 inline-block rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-surface-950 transition-colors hover:bg-accent-400"
          >
            Voir les tarifs
          </Link>
        </div>
      </section>
    </>
  );
}
