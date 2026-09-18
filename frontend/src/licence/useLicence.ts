import { useCallback, useEffect, useState } from 'react';
import { API_V1_BASE } from '../lib/apiBase';

export interface EtatLicence {
  active: boolean;
  motif: string;
  message: string;
  revalidationAvant: number;
  revalidationUrgente: boolean;
}

/**
 * La licence n'est exigée que dans la version installée.
 *
 * En développement et sur un déploiement web, l'application n'est pas
 * distribuée sous forme de fichier copiable : la verrouiller n'empêcherait
 * rien et rendrait la mise au point pénible.
 */
export function licenceExigee(): boolean {
  if (import.meta.env.VITE_LICENCE_REQUISE === 'true') return true;
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

const ETAT_LIBRE: EtatLicence = {
  active: true,
  motif: 'non_exigee',
  message: '',
  revalidationAvant: 0,
  revalidationUrgente: false,
};

export function useLicence() {
  const exigee = licenceExigee();
  const [etat, setEtat] = useState<EtatLicence | null>(exigee ? null : ETAT_LIBRE);
  const [erreurReseau, setErreurReseau] = useState(false);

  const relire = useCallback(async () => {
    if (!exigee) return;
    try {
      const reponse = await fetch(`${API_V1_BASE}/licence`);
      if (!reponse.ok) throw new Error(String(reponse.status));
      setEtat((await reponse.json()) as EtatLicence);
      setErreurReseau(false);
    } catch {
      // Le backend local n'a pas encore démarré : on ne déverrouille pas pour
      // autant, on signale l'attente.
      setErreurReseau(true);
    }
  }, [exigee]);

  useEffect(() => {
    void relire();
  }, [relire]);

  const activer = useCallback(
    async (cle: string): Promise<EtatLicence> => {
      const reponse = await fetch(`${API_V1_BASE}/licence/activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cle }),
      });
      const resultat = (await reponse.json()) as EtatLicence;
      setEtat(resultat);
      return resultat;
    },
    [],
  );

  return { exigee, etat, erreurReseau, relire, activer };
}
