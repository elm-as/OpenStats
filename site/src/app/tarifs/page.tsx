import type { Metadata } from 'next';
import { OFFRES, TARIF_DE_LANCEMENT, formaterXOF, prixParPoste, prixUSD } from '@/lib/tarifs';
import FormulaireAchat from '@/components/FormulaireAchat';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    'Licence perpétuelle OpenStats : Solo, Équipe ou Établissement. Paiement par carte ' +
    'bancaire ou mobile money, en francs CFA.',
};

const QUESTIONS = [
  {
    question: 'Que se passe-t-il au bout des douze mois ?',
    reponse:
      "Rien ne s'arrête. Votre version continue de fonctionner indéfiniment : c'est une licence " +
      "perpétuelle. Vous cessez simplement de recevoir les nouvelles versions, jusqu'à ce que " +
      'vous renouvelez la maintenance si vous le souhaitez.',
  },
  {
    question: 'Puis-je installer le logiciel sur mon portable et mon poste fixe ?',
    reponse:
      "Oui. La licence Solo autorise deux machines activées en même temps. Vous pouvez libérer " +
      'un poste depuis votre espace client pour le remplacer par un autre, par exemple après un ' +
      'changement de matériel.',
  },
  {
    question: 'Ai-je besoin d’une connexion permanente ?',
    reponse:
      "Non. Une connexion est nécessaire pour activer un poste, puis environ une fois toutes les " +
      'trois semaines pour revalider. Entre-temps, le logiciel fonctionne sans réseau, et vos ' +
      'données ne sortent jamais de votre machine.',
  },
  {
    question: 'Pourquoi le prix est-il en francs CFA ?',
    reponse:
      "Parce que c'est la devise réellement encaissée. Si vous payez par carte depuis " +
      "l'étranger, votre banque convertit au taux du jour : le montant en dollars affiché est " +
      'donc un repère, pas un prix ferme.',
  },
  {
    question: 'Les prix vont-ils augmenter ?',
    reponse:
      "Probablement, oui. Ce sont des tarifs de lancement : OpenStats n'a pas encore " +
      "d'historique de versions publiées ni de références clients, et les premiers acheteurs " +
      'en tiennent compte. Comme la licence est perpétuelle, une hausse ultérieure ne change ' +
      'rien à ce que vous avez acheté : vous gardez votre version et vos mises à jour.',
  },
  {
    question: 'Proposez-vous un tarif académique ?',
    reponse:
      "Oui, pour les universités, laboratoires et étudiants, sur présentation d'un justificatif. " +
      'Écrivez-nous avant l’achat.',
  },
];

export default function Tarifs() {
  return (
    <>
      <section className="halo-accent border-b border-white/5">
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20">
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Un achat, pas un abonnement.
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-surface-300">
            Vous achetez une version et vous la gardez. Les prix sont en francs CFA, la devise
            réellement débitée ; le montant en dollars est indicatif pour les paiements par
            carte depuis l&apos;étranger.
          </p>
          {TARIF_DE_LANCEMENT && (
            <p className="mt-5 max-w-2xl rounded-xl border border-accent-500/25 bg-accent-500/5 px-4 py-3 text-[13px] leading-relaxed text-surface-200">
              <strong className="font-semibold text-accent-300">Tarifs de lancement.</strong>{' '}
              OpenStats est récent : pas encore d&apos;historique de versions publiées, pas encore
              de références clients. Ces prix en tiennent compte et augmenteront. Votre licence
              étant perpétuelle, une hausse ne vous retirera rien.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {OFFRES.map((offre) => (
            <article
              key={offre.type}
              className={`flex flex-col rounded-2xl border p-7 ${
                offre.miseEnAvant
                  ? 'border-accent-500/40 bg-accent-500/5'
                  : 'border-white/5 bg-surface-800/40'
              }`}
            >
              {offre.miseEnAvant && (
                <span className="mb-3 w-fit rounded-full bg-accent-500/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent-300">
                  Le plus choisi
                </span>
              )}

              <h2 className="text-lg font-bold text-white">{offre.nom}</h2>
              <p className="mt-1.5 text-[13px] text-surface-400">{offre.resume}</p>

              <div className="mt-6">
                <p className="text-3xl font-extrabold tracking-tight text-white">
                  {formaterXOF(offre.prixXOF)}
                </p>
                <p className="mt-1 font-mono text-[12px] text-surface-400">
                  ≈ ${prixUSD(offre.prixXOF)} · paiement unique
                </p>
                <p className="mt-1 font-mono text-[11px] text-surface-500">
                  soit {formaterXOF(prixParPoste(offre))} par poste
                </p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {offre.inclus.map((ligne) => (
                  <li key={ligne} className="flex gap-2.5 text-[13px] leading-relaxed text-surface-200">
                    <span aria-hidden className="mt-1 text-accent-400">▸</span>
                    <span>{ligne}</span>
                  </li>
                ))}
              </ul>

              <FormulaireAchat offre={offre} />
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-2xl font-bold tracking-tight text-white">Questions fréquentes</h2>
        <div className="mt-8 space-y-6">
          {QUESTIONS.map((item) => (
            <div key={item.question} className="border-b border-white/5 pb-6">
              <h3 className="text-[15px] font-semibold text-white">{item.question}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-surface-300">{item.reponse}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
