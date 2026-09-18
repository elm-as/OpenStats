import { useState } from 'react';
import { useLicence } from './useLicence';

const URL_ESPACE_CLIENT = 'https://openstats.app/compte';

function Fenetre({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-premium w-full max-w-md">
        <div>{children}</div>
      </div>
    </div>
  );
}

/**
 * Écran d'activation affiché avant l'application, dans la version installée.
 *
 * Il laisse passer dès que le backend déclare la licence active. Le contrôle
 * réel est côté serveur de licences (quota de machines) et dans le jeton signé
 * lié à l'empreinte du poste ; cet écran n'est que sa façade.
 */
export default function PorteActivation({ children }: { children: React.ReactNode }) {
  const { exigee, etat, erreurReseau, relire, activer } = useLicence();
  const [cle, setCle] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!exigee || etat?.active) return <>{children}</>;

  if (!etat) {
    return (
      <Fenetre>
        <p className="text-sm text-surface-300">
          {erreurReseau
            ? 'Démarrage du moteur d’analyse…'
            : 'Vérification de votre licence…'}
        </p>
        {erreurReseau && (
          <button type="button" onClick={() => void relire()} className="btn-secondary mt-4">
            Réessayer
          </button>
        )}
      </Fenetre>
    );
  }

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await activer(cle);
      if (!resultat.active) setErreur(resultat.message || 'Activation refusée.');
    } catch {
      setErreur('Impossible de joindre le serveur d’activation.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Fenetre>
      <h1 className="text-lg font-bold text-white">Activer OpenStats</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-surface-300">
        {etat.motif === 'absente'
          ? 'Collez la clé reçue par courriel après votre achat. Elle n’est demandée qu’une fois sur cet ordinateur.'
          : etat.message}
      </p>

      <form onSubmit={soumettre} className="mt-5">
        <label htmlFor="cle-licence" className="text-[11px] font-bold uppercase tracking-wider text-surface-400">
          Clé de licence
        </label>
        <textarea
          id="cle-licence"
          value={cle}
          onChange={(evenement) => setCle(evenement.target.value)}
          rows={3}
          placeholder="OS3-…"
          spellCheck={false}
          className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[12px] text-white outline-none focus:border-cyan-400"
        />
        <button type="submit" disabled={enCours || cle.trim().length < 10} className="btn-primary mt-3 w-full">
          {enCours ? 'Activation…' : 'Activer'}
        </button>
      </form>

      {erreur && (
        <p role="alert" className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
          {erreur}
        </p>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-surface-400">
        Pas encore de clé, ou besoin de libérer un ancien ordinateur ?{' '}
        <a href={URL_ESPACE_CLIENT} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
          Votre espace client
        </a>
        .
      </p>
    </Fenetre>
  );
}
