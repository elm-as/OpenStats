import type { Metadata } from 'next';
import EspaceClient from '@/components/EspaceClient';

export const metadata: Metadata = {
  title: 'Mon espace',
  description:
    'Consulter sa licence OpenStats, gérer ses machines activées et télécharger le logiciel.',
};

export default function Compte() {
  return (
    <>
      <section className="halo-accent border-b border-white/5">
        <div className="mx-auto max-w-3xl px-6 pb-12 pt-20">
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Mon espace
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-surface-300">
            Votre clé de licence tient lieu d&apos;identifiant. Collez-la pour voir vos
            machines activées, en libérer une, et télécharger le logiciel.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <EspaceClient />
      </section>
    </>
  );
}
