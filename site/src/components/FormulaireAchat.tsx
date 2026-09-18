'use client';

import { useState } from 'react';
import type { Offre } from '@/lib/tarifs';

/**
 * Collecte le strict nécessaire, puis redirige vers la page de paiement SasPay.
 *
 * On ne demande que le nom et l'adresse : l'adresse sert à livrer la clé de
 * licence et figure dans la clé elle-même, ce qui dissuade le partage — la
 * personne qui diffuse sa clé diffuse aussi son adresse.
 */
export default function FormulaireAchat({ offre }: { offre: Offre }) {
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function acheter(evenement: React.FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoi(true);

    const donnees = new FormData(evenement.currentTarget);

    try {
      const reponse = await fetch('/api/paiement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offre: offre.type,
          nom: donnees.get('nom'),
          email: donnees.get('email'),
          telephone: donnees.get('telephone') || undefined,
        }),
      });

      const resultat = await reponse.json();
      if (!reponse.ok) {
        setErreur(resultat.erreur ?? "Le paiement n'a pas pu être créé.");
        setEnvoi(false);
        return;
      }

      window.location.href = resultat.urlPaiement;
    } catch {
      setErreur('Connexion impossible. Vérifiez votre réseau et réessayez.');
      setEnvoi(false);
    }
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={`mt-7 w-full rounded-xl py-3 text-sm font-semibold transition-colors ${
          offre.miseEnAvant
            ? 'bg-accent-500 text-surface-950 hover:bg-accent-400'
            : 'border border-white/10 text-surface-100 hover:border-white/25'
        }`}
      >
        Choisir {offre.nom}
      </button>
    );
  }

  return (
    <form onSubmit={acheter} className="mt-7 space-y-3">
      <div>
        <label htmlFor={`nom-${offre.type}`} className="text-[11px] font-semibold text-surface-300">
          Nom complet
        </label>
        <input
          id={`nom-${offre.type}`}
          name="nom"
          required
          autoComplete="name"
          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-950 px-3 py-2 text-[13px] text-white outline-none focus:border-accent-500"
        />
      </div>

      <div>
        <label htmlFor={`email-${offre.type}`} className="text-[11px] font-semibold text-surface-300">
          Adresse électronique
        </label>
        <input
          id={`email-${offre.type}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-950 px-3 py-2 text-[13px] text-white outline-none focus:border-accent-500"
        />
        <p className="mt-1 text-[11px] text-surface-500">La clé de licence y sera envoyée.</p>
      </div>

      <div>
        <label htmlFor={`tel-${offre.type}`} className="text-[11px] font-semibold text-surface-300">
          Téléphone <span className="font-normal text-surface-500">(pour le mobile money)</span>
        </label>
        <input
          id={`tel-${offre.type}`}
          name="telephone"
          type="tel"
          autoComplete="tel"
          placeholder="+225 …"
          className="mt-1 w-full rounded-lg border border-white/10 bg-surface-950 px-3 py-2 text-[13px] text-white outline-none focus:border-accent-500"
        />
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi}
        className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-surface-950 transition-colors hover:bg-accent-400 disabled:opacity-60"
      >
        {envoi ? 'Redirection…' : 'Procéder au paiement'}
      </button>
    </form>
  );
}
