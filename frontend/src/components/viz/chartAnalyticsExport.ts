export function safeMin(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  let m = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && !isNaN(v) && v < m) m = v;
  }
  return m === Infinity ? 0 : m;
}

export function safeMax(arr: number[]): number {
  if (!arr || arr.length === 0) return 0;
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (typeof v === 'number' && !isNaN(v) && v > m) m = v;
  }
  return m === -Infinity ? 0 : m;
}

/**
 * Régression Linéaire pour les trendlines automatiques.
 */
export function getLinearRegression(x: number[], y: number[]) {
  const points = x
    .map((xv, idx) => ({ x: xv, y: y[idx] }))
    .filter(
      p =>
        typeof p.x === 'number' &&
        typeof p.y === 'number' &&
        !isNaN(p.x) &&
        !isNaN(p.y)
    );

  const n = points.length;
  if (n < 2) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const xValues = points.map(p => p.x);
  const minX = safeMin(xValues);
  const maxX = safeMax(xValues);

  return { minX, maxX, slope, intercept };
}

/**
 * Aide à l'interprétation automatique pour non-codeurs.
 */
export function getChartInterpretation(
  chartType: string,
  title?: string,
  _data?: any[]
): string {
  const lowerTitle = (title || '').toLowerCase();

  if (lowerTitle.includes('corrélation') || chartType === 'heatmap') {
    return "Cette matrice de corrélation mesure la force et la direction de l'association linéaire entre vos variables. Un score de +1 (bleu foncé) indique une corrélation positive parfaite, -1 (rouge foncé) une corrélation négative parfaite, et 0 l'absence de relation.";
  }
  if (lowerTitle.includes('shap') || lowerTitle.includes('importance des variables')) {
    return 'Ce graphique identifie les variables prédictives les plus décisives pour le modèle. Plus la barre est longue, plus la variable a d’influence sur les prédictions finales.';
  }
  if (lowerTitle.includes('prévision') || lowerTitle.includes('forecast')) {
    return 'Ce graphique affiche les prévisions futures estimées d’après votre historique. La zone colorée représente l’intervalle de confiance (généralement à 95%) : plus elle est étroite, plus la prévision est jugée précise.';
  }
  if (lowerTitle.includes('décomposition')) {
    return 'La décomposition de série temporelle isole la Tendance globale (évolution à long terme), la Saisonnalité (variations périodiques répétitives) et le Résidu (bruit aléatoire inexpliqué).';
  }
  if (lowerTitle.includes('roc') || lowerTitle.includes('auc')) {
    return 'La courbe ROC évalue la capacité de discrimination d’un classifieur binaire. Un modèle idéal tend vers le coin supérieur gauche (AUC proche de 1.0), tandis qu’un modèle aléatoire suit la diagonale (AUC = 0.5).';
  }
  if (lowerTitle.includes('résidus') || lowerTitle.includes('qq-plot')) {
    return 'Les diagnostics des résidus valident la régularité statistique du modèle. Sur le QQ-Plot, les points doivent suivre au mieux la ligne droite diagonale. Sur le graphique des résidus, ils doivent être répartis de manière homogène sans motif identifiable.';
  }

  switch (chartType) {
    case 'histogram':
      return 'L’histogramme modélise la distribution d’une variable numérique. Il montre où se concentrent vos données (le pic) et leur dispersion (étalement).';
    case 'box':
      return 'La boîte à moustaches résume graphiquement la dispersion : le rectangle délimite les quartiles Q1 à Q3 (50% de vos données), le trait central est la médiane. Les points isolés signalent des anomalies potentielles (valeurs aberrantes).';
    case 'violin':
      return 'Le diagramme en violon associe une boîte à moustaches et une estimation de densité. Il permet de voir plus précisément la symétrie, l’étalement et d’éventuelles distributions multimodales.';
    case 'pie':
      return 'Le diagramme circulaire illustre la répartition proportionnelle de vos catégories. Recommandé pour des comparaisons d’ensembles simples n’excédant pas 5 ou 6 parts.';
    case 'scatter':
      return 'Le nuage de points affiche l’interaction entre deux variables numériques. Il permet de détecter visuellement des tendances, des regroupements (clusters) ou des valeurs isolées.';
    case 'bubble':
      return 'Le graphique à bulles enrichit le nuage de points en ajoutant une troisième dimension numérique représentée par le diamètre des bulles.';
    case 'bar':
    case 'stacked_bar':
      return 'Le graphique à barres compare les amplitudes de différentes catégories ou groupes de données.';
    default:
      return 'Visualisation de données interactive. Utilisez les outils de zoom, survol et déplacement pour explorer précisément chaque point.';
  }
}

/**
 * Exporte les données des traces du graphique au format CSV.
 */
export function exportChartDataToCsv(data: any[], chartTitle?: string): void {
  const validTraces = data.filter(t => Array.isArray(t.x) && Array.isArray(t.y));
  if (validTraces.length === 0) return;

  const allX = Array.from(new Set(validTraces.flatMap(t => t.x as any[]))).sort(
    (a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    }
  );

  const headers = ['Axe_X', ...validTraces.map((t, i) => t.name || `Variable_${i + 1}`)];
  const rows = allX.map(xVal => {
    const row = [String(xVal)];
    validTraces.forEach(t => {
      const xIdx = (t.x as any[]).indexOf(xVal);
      if (xIdx !== -1) {
        const yVal = (t.y as any[])[xIdx];
        row.push(yVal !== undefined && yVal !== null ? String(yVal) : '');
      } else {
        row.push('');
      }
    });
    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(chartTitle || 'data').toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporte la spécification Plotly au format JSON brut.
 */
export function exportChartSpecToJson(
  data: any[],
  layout: any,
  config: any,
  chartTitle?: string
): void {
  const jsonStr = JSON.stringify({ data, layout, config }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(chartTitle || 'chart').toLowerCase().replace(/[^a-z0-9]/g, '_')}_spec.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
