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

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
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

function resolveTraceCell(trace: any, xVal: any): string {
  const xIdx = (trace.x as any[]).indexOf(xVal);
  if (xIdx === -1) return '';
  const yVal = (trace.y as any[])[xIdx];
  return yVal !== undefined && yVal !== null ? String(yVal) : '';
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporte les données des traces du graphique au format CSV.
 */
export function exportChartDataToCsv(data: any[], chartTitle?: string): void {
  const validTraces = data.filter(t => Array.isArray(t.x) && Array.isArray(t.y));
  if (validTraces.length === 0) return;

  const allX = Array.from(new Set(validTraces.flatMap(t => t.x as any[]))).sort((a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  });

  const headers = ['Axe_X', ...validTraces.map((t, i) => t.name || `Variable_${i + 1}`)];
  const rows = allX.map(xVal => {
    const cells = validTraces.map(t => resolveTraceCell(t, xVal));
    return [String(xVal), ...cells].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `${(chartTitle || 'data').toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`;
  triggerBlobDownload(blob, filename);
}

export interface ExportChartSpecOptions {
  data: any[];
  layout: any;
  config: any;
  chartTitle?: string;
}

/**
 * Exporte la spécification Plotly au format JSON brut.
 */
export function exportChartSpecToJson({
  data,
  layout,
  config,
  chartTitle,
}: ExportChartSpecOptions): void {
  const jsonStr = JSON.stringify({ data, layout, config }, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `${(chartTitle || 'chart').toLowerCase().replace(/[^a-z0-9]/g, '_')}_spec.json`;
  triggerBlobDownload(blob, filename);
}
