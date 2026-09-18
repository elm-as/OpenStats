import Link from 'next/link';
import { commandeParReference, licenceParCommande } from '@/lib/stockage';

/**
 * Page de retour après paiement.
 *
 * Elle lit l'état réel de la commande en base : le navigateur revient ici dès
 * que le client quitte la page de paiement, parfois avant que le webhook ait
 * confirmé. Annoncer la réussite sur la seule présence du paramètre d'URL
 * afficherait « merci de votre achat » à quelqu'un qui a abandonné en chemin.
 */
export const dynamic = 'force-dynamic';

export default async function Merci({
  searchParams,
}: {
  searchParams: Promise<{ commande?: string }>;
}) {
  const { commande: reference } = await searchParams;
  const commande = reference ? commandeParReference(reference) : undefined;
  const licence = reference ? licenceParCommande(reference) : undefined;

  if (!commande) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl font-bold text-white">Commande introuvable</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-surface-300">
          Nous ne retrouvons pas cette référence. Si vous avez été débité, écrivez-nous en
          indiquant votre adresse électronique : nous retrouverons le paiement.
        </p>
        <Link href="/tarifs" className="mt-6 inline-block text-[13px] text-accent-400 hover:underline">
          Retour aux tarifs
        </Link>
      </section>
    );
  }

  if (commande.statut !== 'payee' || !licence) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl font-bold text-white">Paiement en cours de confirmation</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-surface-300">
          Votre commande <span className="font-mono text-accent-400">{commande.reference}</span> est
          enregistrée, mais la confirmation du prestataire ne nous est pas encore parvenue. Cela
          prend généralement quelques secondes, parfois quelques minutes en mobile money.
        </p>
        <p className="mt-3 text-[13px] text-surface-400">
          Rechargez cette page dans un instant. Votre clé apparaîtra ici dès la confirmation, et
          vous la retrouverez aussi dans votre espace client.
        </p>
        <Link href="/compte" className="mt-6 inline-block text-[13px] text-accent-400 hover:underline">
          Aller à mon espace
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-400">
        Paiement confirmé
      </p>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
        Merci — votre licence est prête.
      </h1>

      <div className="mt-8 rounded-2xl border border-accent-500/25 bg-accent-500/5 p-6">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-surface-300">
          Votre clé de licence
        </h2>
        <p className="mt-2 break-all font-mono text-[13px] leading-relaxed text-accent-300">
          {licence.cle}
        </p>
        <p className="mt-3 text-[12px] text-surface-400">
          Conservez-la. Elle contient votre adresse électronique : la diffuser revient à diffuser
          votre identité, et les activations sont limitées à {licence.postes} machines.
        </p>
      </div>

      <ol className="mt-8 space-y-4 text-[14px] leading-relaxed text-surface-200">
        <li>
          <span className="font-semibold text-white">1. Téléchargez</span> le programme
          d&apos;installation depuis votre espace client.
        </li>
        <li>
          <span className="font-semibold text-white">2. Installez</span>, puis lancez OpenStats.
        </li>
        <li>
          <span className="font-semibold text-white">3. Collez votre clé</span> à la première
          ouverture. La machine est alors activée, et le logiciel fonctionne hors ligne ensuite.
        </li>
      </ol>

      <Link
        href="/compte"
        className="mt-9 inline-block rounded-xl bg-accent-500 px-6 py-3 text-sm font-semibold text-surface-950 transition-colors hover:bg-accent-400"
      >
        Accéder à mon espace
      </Link>
    </section>
  );
}
