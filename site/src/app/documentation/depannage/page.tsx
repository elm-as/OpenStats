import type { Metadata } from 'next';
import PageDoc from '@/components/PageDoc';

export const metadata: Metadata = { title: 'Dépannage' };

const CAS = [
  {
    probleme: 'Toutes les machines autorisées sont déjà activées',
    cause:
      "Votre licence a atteint son nombre de postes. C'est fréquent après un changement d'ordinateur : l'ancien compte toujours.",
    remede:
      'Ouvrez votre espace client, libérez la machine que vous n’utilisez plus, puis réessayez.',
  },
  {
    probleme: 'Cette clé est invalide ou a été modifiée',
    cause:
      "La clé a été tronquée à la copie, le plus souvent par un retour à la ligne inséré par le logiciel de messagerie.",
    remede:
      "Recopiez-la depuis votre espace client, d'un seul bloc, sans espace avant ni après.",
  },
  {
    probleme: 'Le logiciel démarre mais reste sur une fenêtre vide',
    cause:
      "Le moteur d'analyse n'a pas démarré, généralement parce qu'un antivirus a bloqué son exécutable.",
    remede:
      "Autorisez OpenStats dans votre antivirus, puis relancez. Si cela persiste, envoyez-nous le fichier de journal situé dans %APPDATA%\OpenStats\logs.",
  },
  {
    probleme: 'Une analyse temporelle n’est pas proposée',
    cause:
      "Votre colonne de dates n'a pas été reconnue comme telle : format inhabituel, ou colonne de périodes en nombre entier.",
    remede:
      "Dans l'écran de typage, forcez le type « Date » sur cette colonne, puis relancez l'analyse guidée. L'application vous indique d'ailleurs la colonne suspecte quand elle refuse une étape temporelle.",
  },
  {
    probleme: 'Le calcul est très lent sur un gros fichier',
    cause:
      "Certaines analyses, notamment la sélection automatique d'ordre ARIMA et la compétition de modèles, testent de nombreuses combinaisons.",
    remede:
      "Réduisez la plage testée dans les réglages du nœud, ou travaillez d'abord sur un échantillon pour valider le pipeline avant de le lancer sur l'ensemble.",
  },
];

export default function Depannage() {
  return (
    <PageDoc
      titre="Dépannage"
      chapeau="Les situations que rencontrent le plus souvent les utilisateurs, et ce qu'elles signifient réellement."
    >
      {CAS.map((cas) => (
        <div key={cas.probleme} className="mt-8 border-l-2 border-accent-500/40 pl-5">
          <h3>{cas.probleme}</h3>
          <p><strong className="text-surface-100">Pourquoi :</strong> {cas.cause}</p>
          <p><strong className="text-surface-100">Que faire :</strong> {cas.remede}</p>
        </div>
      ))}

      <h2>Rien ne correspond</h2>
      <p>
        Écrivez-nous en joignant le fichier de journal et, si possible, un extrait des données
        qui déclenche le problème. Un cas reproductible est corrigé bien plus vite qu&apos;une
        description.
      </p>
    </PageDoc>
  );
}
