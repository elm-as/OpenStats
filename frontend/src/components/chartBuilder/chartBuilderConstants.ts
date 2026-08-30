import { SCI_COLORS } from '../viz/PlotlyBase';

export const CHART_TYPES = [
  { key: 'line',        label: "Courbe d'évolution",  desc: 'Tendances temporelles ou continues' },
  { key: 'bar',         label: 'Barres',              desc: 'Comparaison de catégories' },
  { key: 'stacked_bar', label: 'Barres empilées',     desc: 'Parts par catégorie' },
  { key: 'pie',         label: 'Diagramme circulaire', desc: 'Répartition en pourcentages' },
  { key: 'scatter',     label: 'Nuage de points',     desc: 'Relation entre 2 variables' },
  { key: 'bubble',      label: 'Bulles',              desc: 'Relation entre 3+ variables' },
  { key: 'area',        label: 'Aires',               desc: 'Évolution avec surface' },
  { key: 'histogram',   label: 'Histogramme',         desc: 'Distribution univariée' },
  { key: 'box',         label: 'Boîte à moustaches',  desc: "Quartiles et valeurs aberrantes" },
  { key: 'violin',      label: 'Violon',              desc: 'Densité + boxplot combinés' },
  { key: 'heatmap',     label: 'Carte de chaleur',    desc: 'Matrice de corrélation / densité' },
  { key: 'radar',       label: 'Radar',               desc: 'Comparaison multidimensionnelle' },
] as const;

export type ChartType = (typeof CHART_TYPES)[number]['key'];

export const AGGREGATIONS = [
  { key: 'mean',   label: 'Moyenne' },
  { key: 'sum',    label: 'Somme' },
  { key: 'count',  label: 'Compte' },
  { key: 'median', label: 'Médiane' },
  { key: 'min',    label: 'Minimum' },
  { key: 'max',    label: 'Maximum' },
];

export { SCI_COLORS };
