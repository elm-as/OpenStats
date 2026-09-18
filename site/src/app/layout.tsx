import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: "OpenStats — L'analyse statistique sans compromis sur la rigueur",
    template: '%s — OpenStats',
  },
  description:
    "Logiciel d'analyse statistique pour Windows : économétrie, séries temporelles, " +
    'machine learning explicable et rapports professionnels. Vos données ne quittent ' +
    'jamais votre machine.',
  keywords: [
    'analyse statistique',
    'économétrie',
    'séries temporelles',
    'machine learning',
    'logiciel statistique',
    'alternative SPSS',
    'alternative Stata',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'OpenStats',
  },
};

const LIENS = [
  { href: '/fonctionnalites', libelle: 'Fonctionnalités' },
  { href: '/documentation', libelle: 'Documentation' },
  { href: '/tarifs', libelle: 'Tarifs' },
  { href: '/compte', libelle: 'Mon espace' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-900 text-surface-100 antialiased">
        <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-900/80 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-500/15 font-mono text-sm font-bold text-accent-400">
                OS
              </span>
              <span className="text-[15px] font-bold tracking-tight text-white">OpenStats</span>
            </Link>

            <div className="hidden items-center gap-7 md:flex">
              {LIENS.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className="text-[13px] font-medium text-surface-300 transition-colors hover:text-white"
                >
                  {lien.libelle}
                </Link>
              ))}
            </div>

            <Link
              href="/tarifs"
              className="rounded-xl bg-accent-500 px-4 py-2 text-[13px] font-semibold text-surface-950 transition-colors hover:bg-accent-400"
            >
              Acheter
            </Link>
          </nav>
        </header>

        <main>{children}</main>

        <footer className="mt-24 border-t border-white/5 bg-surface-950">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-500/15 font-mono text-xs font-bold text-accent-400">
                  OS
                </span>
                <span className="font-bold tracking-tight text-white">OpenStats</span>
              </div>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-surface-400">
                Analyse statistique, économétrie et apprentissage automatique, sur votre
                machine. Aucune donnée transmise, aucun abonnement obligatoire.
              </p>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
                Produit
              </h3>
              <ul className="mt-3 space-y-2 text-[13px] text-surface-300">
                <li><Link href="/fonctionnalites" className="hover:text-white">Fonctionnalités</Link></li>
                <li><Link href="/tarifs" className="hover:text-white">Tarifs</Link></li>
                <li><Link href="/documentation" className="hover:text-white">Documentation</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
                Assistance
              </h3>
              <ul className="mt-3 space-y-2 text-[13px] text-surface-300">
                <li><Link href="/compte" className="hover:text-white">Gérer mes licences</Link></li>
                <li><Link href="/documentation/installation" className="hover:text-white">Installation</Link></li>
                <li><Link href="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 px-6 py-5">
            <p className="mx-auto max-w-6xl text-[12px] text-surface-500">
              © {new Date().getFullYear()} OpenStats. Tous droits réservés.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
