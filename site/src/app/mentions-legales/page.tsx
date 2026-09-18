import type { Metadata } from 'next';
import PageDoc from '@/components/PageDoc';

export const metadata: Metadata = { title: 'Mentions légales' };

export default function MentionsLegales() {
  return (
    <PageDoc
      titre="Mentions légales et conditions"
      chapeau="Ce que vous achetez, ce que nous garantissons, et ce que nous faisons de vos données."
    >
      <h2>Éditeur</h2>
      <p>
        OpenStats est édité par Elmas Labs. Les coordonnées complètes et le numéro
        d&apos;enregistrement figureront ici dès l&apos;immatriculation de la structure.
      </p>

      <h2>Ce que vous achetez</h2>
      <p>
        Une licence d&apos;utilisation perpétuelle et non exclusive du logiciel, pour le nombre
        de postes indiqué par votre offre. Vous n&apos;achetez pas le code source, et la licence
        n&apos;est pas transférable à un tiers.
      </p>
      <p>
        La période de maintenance incluse donne droit aux mises à jour publiées pendant sa
        durée. À son terme, le logiciel continue de fonctionner indéfiniment dans sa dernière
        version reçue.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Nous conservons votre nom, votre adresse électronique, la référence de votre commande
        et, pour chaque machine activée, une empreinte matérielle et un nom de poste. Cette
        empreinte est une valeur calculée : elle ne nous permet pas de connaître votre matériel.
      </p>
      <p>
        <strong className="text-surface-100">
          Aucune donnée analysée avec le logiciel ne nous est transmise.
        </strong>{' '}
        Vos fichiers, vos résultats et vos rapports restent sur votre machine. C&apos;est une
        propriété de l&apos;architecture : le logiciel n&apos;envoie rien d&apos;autre que la
        vérification de licence.
      </p>
      <p>
        Vous pouvez demander la suppression de vos données à tout moment ; elle entraîne la
        révocation de la licence, puisque celle-ci repose sur ces informations.
      </p>

      <h2>Remboursement</h2>
      <p>
        Le logiciel est remboursé sur simple demande dans les quatorze jours suivant l&apos;achat,
        sauf usage manifestement abusif. La licence est alors révoquée.
      </p>

      <h2>Garantie</h2>
      <p>
        Nous garantissons que les méthodes statistiques implémentées calculent ce qu&apos;elles
        annoncent, et nos tests le vérifient contre des implémentations de référence. Nous ne
        garantissons pas que les conclusions que vous tirerez de vos analyses soient correctes :
        un logiciel exécute une méthode, il ne se substitue pas au jugement de celui qui
        l&apos;emploie.
      </p>

      <h2>Droit applicable</h2>
      <p>
        À préciser lors de l&apos;immatriculation de la structure éditrice.
      </p>
    </PageDoc>
  );
}
