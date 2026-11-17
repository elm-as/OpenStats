import { safeMin, safeMax } from '../../viz/chartAnalyticsExport';

export interface PointLabelInput {
  x: number;
  y: number;
  label: string;
}

export interface PlotLabelBounds {
  width: number;
  padR: number;
  padT: number;
}

/**
 * Calcule le placement d'une étiquette de point SVG sans dépassement des bords.
 * Bascule à gauche si l'étiquette dépasse le bord droit et borne dans [8, width - 8].
 */
export function getPointLabelProps(
  point: PointLabelInput,
  bounds: PlotLabelBounds,
) {
  const labelLen = String(point.label ?? '').length;
  const estWidth = labelLen * 5.4;
  const leftLimit = 8;
  const rightLimit = bounds.width - 8;
  const y = point.y < bounds.padT + 14 ? point.y + 12 : point.y - 6;

  if (point.x + 6 + estWidth <= rightLimit) {
    return { x: point.x + 6, y, textAnchor: 'start' as const };
  }
  if (point.x - 6 - estWidth >= leftLimit) {
    return { x: point.x - 6, y, textAnchor: 'end' as const };
  }
  if (estWidth <= rightLimit - leftLimit) {
    return { x: Math.max(point.x - 6, leftLimit + estWidth), y, textAnchor: 'end' as const };
  }
  return { x: leftLimit, y, textAnchor: 'start' as const };
}

export function interpolateHexColor(
  val: number,
  maxVal: number,
  palette: { startHex: string; endHex: string },
): string {
  const pct = maxVal > 0 ? Math.min(Math.max(val / maxVal, 0), 1) : 0;
  const c1 = [
    parseInt(palette.startHex.slice(1, 3), 16),
    parseInt(palette.startHex.slice(3, 5), 16),
    parseInt(palette.startHex.slice(5, 7), 16),
  ];
  const c2 = [
    parseInt(palette.endHex.slice(1, 3), 16),
    parseInt(palette.endHex.slice(3, 5), 16),
    parseInt(palette.endHex.slice(5, 7), 16),
  ];
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * pct);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * pct);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * pct);
  return `rgb(${r},${g},${b})`;
}

export interface BarChartLayout {
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  plotH: number;
  width: number;
  height: number;
  rotateLabels: boolean;
  slotW: number;
  barW: number;
  yMin: number;
  yMax: number;
  span: number;
  y0: number;
  labelOffset: number;
  allProportions: boolean;
}

/**
 * Calcule la géométrie dynamique d'un histogramme SVG (marges rotation et ligne de base zéro).
 */
export function computeBarChartLayout(values: number[], labels: string[]): BarChartLayout {
  const maxLblLen = labels.reduce((max, l) => Math.max(max, String(l ?? '').length), 0);
  const rotateLabels = labels.length > 4 || maxLblLen > 9;
  const cos35 = Math.cos((35 * Math.PI) / 180);
  const sin35 = Math.sin((35 * Math.PI) / 180);
  const slotFloor = 52;
  let padL = rotateLabels ? 48 : 44;

  if (rotateLabels) {
    for (let i = 0; i < values.length; i += 1) {
      const lblLen = String(labels[i] ?? '').length;
      const leftReach = lblLen * 5.6 * cos35 + 6;
      const neededPadL = Math.ceil(leftReach - (i + 0.5) * slotFloor) + 10;
      padL = Math.max(padL, neededPadL);
    }
  }

  const finiteVals = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const yMin = Math.min(0, safeMin(finiteVals));
  const yMax = Math.max(0, safeMax(finiteVals));
  const span = Math.max(yMax - yMin, 1e-6);
  const hasNegative = yMin < 0;
  const padR = 24;
  const padT = 26;
  const plotH = 115;
  const labelOffset = hasNegative ? 28 : 14;
  const rotVert = rotateLabels ? Math.ceil(maxLblLen * 5.6 * sin35) + 20 : 22;
  const padB = labelOffset + rotVert;
  const width = Math.max(480, padL + padR + values.length * slotFloor);
  const height = padT + plotH + padB;
  const slotW = (width - padL - padR) / values.length;
  const barW = Math.min(38, Math.max(14, slotW - 8));
  const y0 = yMin === 0 && yMax === 0 ? padT + plotH : padT + (yMax / span) * plotH;
  const allProportions = values.every(v => Number.isFinite(v) && v >= 0 && v <= 1);

  return {
    padL, padR, padT, padB, plotH, width, height,
    rotateLabels, slotW, barW, yMin, yMax, span, y0, labelOffset, allProportions,
  };
}

export interface HeatmapLayout {
  rows: number;
  cols: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  cell: number;
  width: number;
  height: number;
  rotateX: boolean;
  maxVal: number;
}

/**
 * Calcule la géométrie dynamique d'une matrice de confusion SVG sans chevauchement de libellés.
 */
export function computeHeatmapLayout(matrix: number[][], labels?: string[]): HeatmapLayout {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const maxLblLen = labels && labels.length > 0
    ? Math.max(...labels.map(l => String(l ?? '').length), 1)
    : 0;
  const rotateX = cols > 2 || maxLblLen > 6;
  const padL = maxLblLen > 0 ? Math.max(84, Math.ceil(maxLblLen * 6.2) + 42) : 44;
  const sin35 = Math.sin((35 * Math.PI) / 180);
  const padB = rotateX ? Math.max(66, Math.ceil(maxLblLen * 6.0 * sin35) + 44) : 56;
  const padT = 24;
  const padR = 24;
  const cell = Math.max(44, Math.min(64, Math.floor(220 / Math.max(rows, cols, 1))));
  const width = padL + cols * cell + padR;
  const height = padT + rows * cell + padB;
  const maxVal = Math.max(0, ...matrix.flat().filter(v => typeof v === 'number' && Number.isFinite(v)));

  return { rows, cols, padL, padR, padT, padB, cell, width, height, rotateX, maxVal };
}
