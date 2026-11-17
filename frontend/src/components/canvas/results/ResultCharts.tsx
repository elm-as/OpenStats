import React from 'react';
import { safeMin, safeMax } from '../../viz/chartAnalyticsExport';
import { useCurrentTheme } from '../../viz/PlotlyBase';
import {
  getPointLabelProps,
  interpolateHexColor,
  computeBarChartLayout,
  computeHeatmapLayout,
} from './resultChartGeometry';

function useSvgTheme() {
  const isLight = useCurrentTheme() === 'light';
  return {
    isLight,
    gridStroke: isLight ? '#cbd5e1' : '#334155',
    circleStroke: isLight ? '#94a3b8' : '#475569',
    axisFill: isLight ? '#475569' : '#94a3b8',
    labelFill: isLight ? '#0f172a' : '#cbd5e1',
    defaultStart: isLight ? '#f1f5f9' : '#1e293b',
  };
}

export const SvgScatterPlot = ({
  points,
  colors,
  title,
  xLabel,
  yLabel,
  showCircle,
}: {
  points: { x: number; y: number; label: string; color?: string }[];
  labelKey?: string;
  colors?: string[];
  title: string;
  xLabel: string;
  yLabel: string;
  showCircle?: boolean;
}) => {
  const { gridStroke, circleStroke, axisFill, labelFill } = useSvgTheme();
  if (points.length === 0) return null;
  const W = 540;
  const H = 380;
  const padL = 56;
  const padR = 64;
  const padT = 32;
  const padB = 48;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = safeMin(xs);
  const xMax = safeMax(xs);
  const yMin = safeMin(ys);
  const yMax = safeMax(ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xLo = xMin - xRange * 0.16;
  const xHi = xMax + xRange * 0.16;
  const yLo = yMin - yRange * 0.16;
  const yHi = yMax + yRange * 0.16;
  const sx = (v: number) => padL + ((v - xLo) / (xHi - xLo)) * (W - padL - padR);
  const sy = (v: number) => H - padB - ((v - yLo) / (yHi - yLo)) * (H - padT - padB);
  const cx = sx(0);
  const cy = sy(0);
  const palette = colors || ['#0284c7', '#059669', '#d97706', '#dc2626', '#0ea5e9', '#0d9488', '#475569'];

  return (
    <div className="ui-panel p-3 overflow-x-auto">
      {title && <p className="text-xs font-bold mb-2" style={{ color: 'var(--ui-text)' }}>{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[620px]" style={{ minWidth: 400 }}>
        <line x1={padL} y1={cy} x2={W - padR} y2={cy} stroke={gridStroke} strokeWidth="1" strokeDasharray="4,4" />
        <line x1={cx} y1={padT} x2={cx} y2={H - padB} stroke={gridStroke} strokeWidth="1" strokeDasharray="4,4" />
        {showCircle && (
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(1, Math.min(sx(1) - sx(0), sy(0) - sy(1)))}
            fill="none"
            stroke={circleStroke}
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}
        <text x={padL + (W - padL - padR) / 2} y={H - 10} fill={axisFill} fontSize="11" textAnchor="middle">
          {xLabel}
        </text>
        <text
          x={16}
          y={padT + (H - padT - padB) / 2}
          fill={axisFill}
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90, 16, ${padT + (H - padT - padB) / 2})`}
        >
          {yLabel}
        </text>
        {points.map((p, i) => {
          const col = p.color || palette[i % palette.length];
          const px = sx(p.x);
          const py = sy(p.y);
          const lbl = getPointLabelProps({ x: px, y: py, label: p.label }, { width: W, padR, padT });
          return (
            <g key={i}>
              <title>{`${p.label} (${p.x}, ${p.y})`}</title>
              <circle cx={px} cy={py} r={4} fill={col} opacity={0.88} />
              {showCircle && <line x1={cx} y1={cy} x2={px} y2={py} stroke={col} strokeWidth="1" opacity={0.45} />}
              {points.length <= 30 && (
                <text x={lbl.x} y={lbl.y} fill={labelFill} fontSize="9" textAnchor={lbl.textAnchor}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const SvgBarChart = ({
  values,
  labels,
  title,
  color = '#0284c7',
}: {
  values: number[];
  labels: string[];
  title: string;
  color?: string;
}) => {
  const { gridStroke, axisFill, labelFill } = useSvgTheme();
  if (values.length === 0) return null;
  const maxLblLen = labels.reduce((m, s) => Math.max(m, String(s ?? '').length), 0);
  const layout = computeBarChartLayout(values, labels);
  const { padL, padR, padT, plotH, width: W, height: H, rotateLabels, slotW, barW, span, y0, labelOffset, allProportions } = layout;

  return (
    <div className="ui-panel p-3 overflow-x-auto">
      {title && <p className="text-xs font-bold mb-2" style={{ color: 'var(--ui-text)' }}>{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[640px]" style={{ minWidth: 340 }}>
        <line x1={padL} y1={y0} x2={W - padR} y2={y0} stroke={gridStroke} strokeWidth="1" />
        {values.map((rawVal, i) => {
          const v = Number.isFinite(rawVal) ? rawVal : 0;
          const cx = padL + (i + 0.5) * slotW;
          const x = cx - barW / 2;
          const barH = (Math.abs(v) / span) * plotH;
          const rectY = v >= 0 ? y0 - barH : y0;
          const valY = v >= 0 ? rectY - 6 : y0 + barH + 11;
          const displayLabel = allProportions ? `${(v * 100).toFixed(1)}%` : (Number.isInteger(v) ? String(v) : v.toFixed(2));
          const lblText = String(labels[i] ?? '');
          const labelY = padT + plotH + labelOffset;
          return (
            <g key={i}>
              <title>{`${lblText}: ${displayLabel}`}</title>
              <rect x={x} y={rectY} width={barW} height={barH} fill={color} rx={2} opacity={0.85} />
              <text
                x={cx}
                y={valY}
                fill={labelFill}
                fontSize="10"
                textAnchor="middle"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {displayLabel}
              </text>
              <text
                x={cx}
                y={labelY}
                fill={axisFill}
                fontSize="9"
                textAnchor={rotateLabels ? 'end' : 'middle'}
                transform={rotateLabels ? `rotate(-35, ${cx}, ${labelY})` : undefined}
              >
                {lblText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const SvgHeatmap = ({
  matrix,
  labels,
  title,
  colorStart,
  colorEnd = '#0284c7',
}: {
  matrix: number[][];
  labels?: string[];
  title: string;
  colorStart?: string;
  colorEnd?: string;
}) => {
  const { isLight, axisFill, labelFill, defaultStart } = useSvgTheme();
  if (!matrix || matrix.length === 0 || !matrix[0]?.length) return null;
  const startHex = !colorStart || (isLight && colorStart.toLowerCase() === '#1e293b') ? defaultStart : colorStart;
  const { rows: n, cols: m, padL, padT, cell, width: W, height: H, rotateX, maxVal } = computeHeatmapLayout(matrix, labels);

  return (
    <div className="ui-panel p-3 overflow-x-auto flex flex-col items-center">
      {title && <p className="text-xs font-bold mb-2 w-full text-left" style={{ color: 'var(--ui-text)' }}>{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px]">
        <text
          x={14}
          y={padT + (n * cell) / 2}
          fill={axisFill}
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90, 14, ${padT + (n * cell) / 2})`}
        >
          Réel
        </text>
        {labels?.map((lbl, i) => (
          <text
            key={`yl-${i}`}
            x={padL - 8}
            y={padT + (i + 0.5) * cell + 4}
            fill={labelFill}
            fontSize="10"
            textAnchor="end"
          >
            {lbl}
          </text>
        ))}

        <text x={padL + (m * cell) / 2} y={H - 10} fill={axisFill} fontSize="11" textAnchor="middle">
          Prédit
        </text>
        {labels?.map((lbl, j) => {
          const lx = padL + (j + 0.5) * cell;
          const ly = padT + n * cell + 14;
          return (
            <text
              key={`xl-${j}`}
              x={lx}
              y={ly}
              fill={labelFill}
              fontSize="10"
              textAnchor={rotateX ? 'end' : 'middle'}
              transform={rotateX ? `rotate(-35, ${lx}, ${ly})` : undefined}
            >
              {lbl}
            </text>
          );
        })}

        {matrix.map((row, i) =>
          row.map((val, j) => (
            <g key={`cell-${i}-${j}`}>
              <rect
                x={padL + j * cell}
                y={padT + i * cell}
                width={cell - 1}
                height={cell - 1}
                fill={interpolateHexColor(val, maxVal, { startHex, endHex: colorEnd })}
                rx={2}
              />
              <text
                x={padL + (j + 0.5) * cell}
                y={padT + (i + 0.5) * cell + 4}
                fill={val > maxVal * 0.45 ? '#ffffff' : labelFill}
                fontSize="11"
                textAnchor="middle"
                fontWeight="bold"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {val}
              </text>
            </g>
          ))
        )}
      </svg>
    </div>
  );
};
