import type { Metadata } from 'next';
import PageDoc from '@/components/PageDoc';

export const metadata: Metadata = { title: 'Installation' };

export default function Installation() {
  return (
    <PageDoc
      titre="Installation"
      chapeau="OpenStats est un logiciel Windows autonome : il n'exige ni Python, ni R, ni aucune installation préalable."
    >
      <h2>Ce qu'il vous faut</h2>
      <ul>
        <li>Windows 10 ou 11, en 64 bits</li>
        <li>8 Go de mémoire vive (16 Go recommandés si vos fichiers dépassent le million de lignes)</li>
        <li>3 Go d&apos;espace disque</li>
        <li>Une connexion, le temps d&apos;activer la licence</li>
      </ul>

      <h2>Étapes</h2>
      <ol>
        <li>Connectez-vous à votre espace client et téléchargez le programme d&apos;installation.</li>
        <li>
          Lancez-le. Windows peut afficher un avertissement SmartScreen : le programme
          n&apos;est pas encore signé par un certificat commercial. Choisissez
          « Informations complémentaires », puis « Exécuter quand même ».
        </li>
        <li>Choisissez le dossier d&apos;installation, puis laissez l&apos;installation se dérouler.</li>
        <li>Lancez OpenStats depuis le menu Démarrer.</li>
      </ol>

      <h2>Au premier lancement</h2>
      <p>
        Le logiciel démarre son moteur d&apos;analyse en arrière-plan, ce qui prend une
        trentaine de secondes la première fois. Il vous demande ensuite votre clé de licence :
        la suite est décrite dans la page <strong>Activer sa licence</strong>.
      </p>

      <h2>Où sont mes données</h2>
      <p>
        Les jeux de données importés, les projets et les rapports sont écrits dans
        <code className="mx-1 rounded bg-surface-800 px-1.5 py-0.5 font-mono text-[12px]">%APPDATA%\OpenStats</code>.
        Rien n&apos;est transmis à nos serveurs : seule l&apos;activation de licence communique
        avec l&apos;extérieur, et elle n&apos;envoie ni vos fichiers ni vos résultats.
      </p>
    </PageDoc>
  );
}
