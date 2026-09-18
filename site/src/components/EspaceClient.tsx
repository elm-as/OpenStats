'use client';

import { useState } from 'react';

interface Machine {
  empreinte: string;
  identifiantCourt: string;
  nomMachine: string;
  activeeLe: number;
  vueLe: number;
}

interface EtatLicence {
  offre: string;
  email: string;
  postes: number;
  postesUtilises: number;
  revoquee: boolean;
  emiseLe: number;
  machines: Machine[];
}

const NOMS_OFFRES: Record<string, string> = {
  solo: 'Solo',
  equipe: 'Équipe',
  site: 'Établissement',
};

function dateLisible(secondes: number): string {
  return new Date(secondes * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EspaceClient() {
  const [cle, setCle] = useState('');
  const [etat, setEtat] = useState<EtatLicence | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  async function interroger(action?: 'liberer', empreinte?: string) {
    setErreur(null);
    setChargement(true);
    try {
      const reponse = await fetch('/api/compte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cle: cle.trim(), action, empreinte }),
      });
      const resultat = await reponse.json();
      if (!reponse.ok) {
        setErreur(resultat.erreur ?? 'Licence introuvable.');
        setEtat(null);
      } else {
        setEtat(resultat as EtatLicence);
      }
    } catch {
      setErreur('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void interroger();
        }}
        className="rounded-2xl border border-white/5 bg-surface-800/40 p-6"
      >
        <label htmlFor="cle" className="text-[11px] font-bold uppercase tracking-wider text-surface-300">
          Clé de licence
        </label>
        <textarea
          id="cle"
          value={cle}
          onChange={(evenement) => setCle(evenement.target.value)}
          rows={3}
          placeholder="OS3-…"
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-surface-950 px-3 py-2 font-mono text-[12px] text-white outline-none focus:border-accent-500"
        />
        <button
          type="submit"
          disabled={chargement || cle.trim().length < 10}
          className="mt-3 rounded-xl bg-accent-500 px-5 py-2.5 text-[13px] font-semibold text-surface-950 transition-colors hover:bg-accent-400 disabled:opacity-50"
        >
          {chargement ? 'Vérification…' : 'Afficher ma licence'}
        </button>

        {erreur && (
          <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {erreur}
          </p>
        )}
      </form>

      {etat && (
        <>
          <div className="rounded-2xl border border-white/5 bg-surface-800/40 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold text-white">
                Licence {NOMS_OFFRES[etat.offre] ?? etat.offre}
              </h2>
              <span className="font-mono text-[12px] text-surface-400">
                {etat.postesUtilises} / {etat.postes} postes utilisés
              </span>
            </div>
            <p className="mt-2 text-[13px] text-surface-400">
              Émise le {dateLisible(etat.emiseLe)} pour {etat.email}.
            </p>
            {etat.revoquee && (
              <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
                Cette licence a été révoquée. Contactez le support.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-white/5 bg-surface-800/40 p-6">
            <h2 className="text-[15px] font-bold text-white">Machines activées</h2>

            {etat.machines.length === 0 ? (
              <p className="mt-3 text-[13px] text-surface-400">
                Aucune machine activée pour le moment. Lancez OpenStats et collez votre clé.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-white/5">
                {etat.machines.map((machine) => (
                  <li key={machine.empreinte} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-white">
                        {machine.nomMachine}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-surface-500">
                        {machine.identifiantCourt} · activée le {dateLisible(machine.activeeLe)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void interroger('liberer', machine.empreinte)}
                      disabled={chargement}
                      className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-semibold text-surface-200 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                    >
                      Libérer
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-[12px] leading-relaxed text-surface-500">
              Libérer une machine rend son poste disponible immédiatement. Le logiciel installé
              dessus demandera une nouvelle activation à son prochain démarrage.
            </p>
          </div>

          <div className="rounded-2xl border border-accent-500/25 bg-accent-500/5 p-6">
            <h2 className="text-[15px] font-bold text-white">Télécharger OpenStats</h2>
            <p className="mt-2 text-[13px] text-surface-300">
              Programme d&apos;installation Windows, version 1.3.0.
            </p>
            <a
              href={`/api/telechargement?cle=${encodeURIComponent(cle.trim())}`}
              className="mt-4 inline-block rounded-xl bg-accent-500 px-5 py-2.5 text-[13px] font-semibold text-surface-950 transition-colors hover:bg-accent-400"
            >
              Télécharger
            </a>
          </div>
        </>
      )}
    </div>
  );
}
