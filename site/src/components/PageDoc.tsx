import Link from 'next/link';

/**
 * Gabarit commun aux pages de documentation.
 *
 * Il évite de recopier l'en-tête et le fil d'Ariane dans chaque page : une
 * modification de mise en page se fait ici, pas dans dix fichiers.
 */
export default function PageDoc({
  titre,
  chapeau,
  children,
}: {
  titre: string;
  chapeau: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 pb-12 pt-16">
          <Link href="/documentation" className="text-[12px] text-accent-400 hover:underline">
            ← Documentation
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">{titre}</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-surface-300">{chapeau}</p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-6 py-12 [&_h2]:mt-10 [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-7 [&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-accent-300 [&_li]:text-[14px] [&_li]:leading-relaxed [&_li]:text-surface-200 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:mt-3 [&_p]:text-[14px] [&_p]:leading-relaxed [&_p]:text-surface-200 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </article>
    </>
  );
}
