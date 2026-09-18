import type { Metadata } from 'next';
import PageDoc from '@/components/PageDoc';

export const metadata: Metadata = { title: 'Activer sa licence' };

export default function Activation() {
  return (
    <PageDoc
      titre="Activer sa licence"
      chapeau="Une clé s'active sur un nombre limité de machines. Voici comment cela fonctionne, et quoi faire quand vous changez d'ordinateur."
    >
      <h2>Activer</h2>
      <ol>
        <li>Lancez OpenStats. L&apos;écran d&apos;activation apparaît tant qu&apos;aucune licence n&apos;est enregistrée.</li>
        <li>Collez la clé reçue par courriel — elle commence par <code className="rounded bg-surface-800 px-1.5 py-0.5 font-mono text-[12px]">OS3-</code>.</li>
        <li>Validez. L&apos;activation prend quelques secondes et ne se refait pas au démarrage suivant.</li>
      </ol>

      <h2>Combien de machines</h2>
      <p>
        La licence Solo autorise deux machines actives en même temps, l&apos;offre Équipe cinq,
        l&apos;offre Établissement cinquante. Réinstaller le logiciel sur une machine déjà
        activée ne consomme pas de poste supplémentaire.
      </p>

      <h2>Changer d&apos;ordinateur</h2>
      <p>
        Rendez-vous dans votre espace client, retrouvez la machine à retirer dans la liste, et
        libérez-la. Le poste redevient disponible immédiatement, et vous pouvez activer le
        nouvel ordinateur.
      </p>

      <h2>Travailler sans connexion</h2>
      <p>
        Après l&apos;activation, OpenStats fonctionne hors ligne pendant trois semaines. Il se
        reconnecte ensuite brièvement pour revalider. Si vous êtes en déplacement prolongé,
        lancez le logiciel une fois avant de partir : le compteur repart de zéro.
      </p>

      <h2>Pourquoi cette vérification</h2>
      <p>
        Elle permet de vendre une licence perpétuelle à un prix bas plutôt qu&apos;un abonnement.
        Elle ne transmet que votre clé et une empreinte de votre machine — une valeur calculée
        à partir de votre matériel, sans que nous sachions de quel matériel il s&apos;agit.
        Aucune donnée d&apos;analyse ne sort de votre poste.
      </p>
    </PageDoc>
  );
}
