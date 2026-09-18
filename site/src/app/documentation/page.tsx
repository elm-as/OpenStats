import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    "Installation, activation de licence, premiers pas et dépannage d'OpenStats.",
};

const SECTIONS = [
  {
    titre: 'Démarrer',
    pages: [
      {
        href: '/documentation/installation',
        titre: 'Installation',
        resume: 'Télécharger, installer et lancer OpenStats sur Windows.',
      },
      {
        href: '/documentation/activation',
        titre: 'Activer sa licence',
        resume: 'Coller sa clé, comprendre les postes et le fonctionnement hors ligne.',
      },
      {
        href: '/documentation/premiers-pas',
        titre: 'Première analyse',
        resume: "Importer un fichier et produire un premier résultat en dix minutes.",
      },
    ],
  },
  {
    titre: 'Résoudre un problème',
    pages: [
      {
        href: '/documentation/depannage',
        titre: 'Dépannage',
        resume: 'Les erreurs fréquentes et ce qu’elles signifient.',
      },
    ],
  },
];

export default function Documentation() {
  return (
    <>
      <section className="halo-accent border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 pb-14 pt-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Documentation
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-surface-300">
            La documentation des analyses elles-mêmes — hypothèses, formules, lecture des
            résultats — est intégrée au logiciel, dans l&apos;onglet Docs. Les pages ci-dessous
            traitent de l&apos;installation et de la licence.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-14">
        {SECTIONS.map((section) => (
          <div key={section.titre} className="mb-12">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
              {section.titre}
            </h2>
            <div className="mt-4 grid gap-3">
              {section.pages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="group rounded-xl border border-white/5 bg-surface-800/40 p-5 transition-colors hover:border-accent-500/30"
                >
                  <h3 className="text-[14px] font-semibold text-white group-hover:text-accent-300">
                    {page.titre}
                  </h3>
                  <p className="mt-1 text-[13px] text-surface-400">{page.resume}</p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
