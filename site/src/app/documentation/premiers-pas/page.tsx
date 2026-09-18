import type { Metadata } from 'next';
import PageDoc from '@/components/PageDoc';

export const metadata: Metadata = { title: 'Première analyse' };

export default function PremiersPas() {
  return (
    <PageDoc
      titre="Votre première analyse"
      chapeau="Dix minutes, d'un fichier brut à un résultat interprété."
    >
      <h2>1. Importer</h2>
      <p>
        Glissez un fichier CSV, Excel, Parquet ou JSON dans la zone d&apos;import. OpenStats
        détecte les types de colonnes, repère les dates même écrites en français ou en format
        comptable, et affiche un dictionnaire de données que vous pouvez corriger.
      </p>
      <p>
        Vérifiez ce typage : c&apos;est lui qui décidera de ce que l&apos;application vous
        proposera ensuite. Une colonne de dates prise pour un nombre fait disparaître toutes
        les analyses temporelles.
      </p>

      <h2>2. Laisser l&apos;analyse guidée proposer</h2>
      <p>
        L&apos;onglet <strong>Analyse guidée</strong> examine vos données et construit un
        pipeline adapté : régression si votre cible est continue, classification si elle est
        catégorielle, économétrie de panel si vos données suivent des entités dans le temps,
        prévision si elles forment une série. Vous choisissez la variable à expliquer, cochez
        ou décochez des étapes, puis lancez.
      </p>

      <h2>3. Lire ce que l&apos;application vous dit</h2>
      <p>
        Les résultats ne sont pas que des chiffres. Quand une hypothèse de la régression est
        violée, OpenStats indique la conséquence et le remède. Quand une prévision ne fait pas
        mieux qu&apos;une référence naïve, il le dit. Quand une ANOVA est significative, il
        précise quels groupes diffèrent réellement.
      </p>

      <h2>4. Reprendre la main</h2>
      <p>
        Le bouton <strong>Générer le canevas</strong> convertit le pipeline en graphe de nœuds
        que vous pouvez modifier, compléter et relancer. C&apos;est là que vous ajoutez vos
        propres analyses, votre code Python, vos graphiques.
      </p>

      <h2>5. Sortir du logiciel</h2>
      <p>
        Exportez le tout en rapport PDF, Word ou PowerPoint, ou récupérez votre analyse sous
        forme de script Python, de script R ou de carnet Jupyter — avec les mêmes réglages que
        ceux utilisés dans l&apos;application.
      </p>
    </PageDoc>
  );
}
