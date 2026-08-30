import React from 'react';

export const SvgScatterPlot = ({
  points,
  labelKey,
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
  if (points.length === 0) return null;
  const W = 500;
  const H = 360;
  const PAD = 50;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const margin = 0.15;
  const xLo = xMin - xRange * margin;
  const xHi = xMax + xRange * margin;
  const yLo = yMin - yRange * margin;
  const yHi = yMax + yRange * margin;
  const sx = (v: number) => PAD + ((v - xLo) / (xHi - xLo)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - yLo) / (yHi - yLo)) * (H - 2 * PAD);
  const cx = sx(0);
  const cy = sy(0);
  const palette = colors || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto">
      <p className="text-xs font-bold text-surface-300 mb-2">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px]" style={{ minWidth: 400 }}>
        <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        {showCircle && (
          <circle
            cx={cx}
            cy={cy}
            r={Math.min(sx(1) - sx(0), sy(0) - sy(1))}
            fill="none"
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        )}
        <text x={W / 2} y={H - 8} fill="#94a3b8" fontSize="11" textAnchor="middle">
          {xLabel}
        </text>
        <text
          x={14}
          y={H / 2}
          fill="#94a3b8"
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90, 14, ${H / 2})`}
        >
          {yLabel}
        </text>
        {points.map((p, i) => {
          const col = p.color || palette[i % palette.length];
          return (
            <g key={i}>
              <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={col} opacity={0.85} />
              {showCircle && <line x1={cx} y1={cy} x2={sx(p.x)} y2={sy(p.y)} stroke={col} strokeWidth="1" opacity={0.4} />}
              {points.length <= 30 && (
                <text x={sx(p.x) + 6} y={sy(p.y) - 6} fill="#cbd5e1" fontSize="9">
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
  color = '#06b6d4',
}: {
  values: number[];
  labels: string[];
  title: string;
  color?: string;
}) => {
  if (values.length === 0) return null;
  const W = 500;
  const H = 200;
  const PAD = 50;
  const maxVal = Math.max(...values, 1);
  const barW = Math.min(40, (W - 2 * PAD) / values.length - 4);

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto">
      <p className="text-xs font-bold text-surface-300 mb-2">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[600px]" style={{ minWidth: 350 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#334155" strokeWidth="1" />
        {values.map((v, i) => {
          const x = PAD + (i + 0.5) * ((W - 2 * PAD) / values.length) - barW / 2;
          const barH = (v / maxVal) * (H - 2 * PAD);
          const pct = v > 1 ? v : v * 100;
          return (
            <g key={i}>
              <rect x={x} y={H - PAD - barH} width={barW} height={barH} fill={color} rx={3} opacity={0.8} />
              <text x={x + barW / 2} y={H - PAD - barH - 6} fill="#cbd5e1" fontSize="10" textAnchor="middle">
                {pct.toFixed(1)}%
              </text>
              <text x={x + barW / 2} y={H - PAD + 14} fill="#94a3b8" fontSize="9" textAnchor="middle">
                {labels[i]}
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
  colorStart = '#1e293b',
  colorEnd = '#3b82f6',
}: {
  matrix: number[][];
  labels?: string[];
  title: string;
  colorStart?: string;
  colorEnd?: string;
}) => {
  if (!matrix || matrix.length === 0) return null;
  const W = 300;
  const H = 300;
  const PAD_L = 60;
  const PAD_B = 60;
  const PAD_T = 30;
  const PAD_R = 30;
  const n = matrix.length;
  const m = matrix[0].length;
  const cellW = (W - PAD_L - PAD_R) / m;
  const cellH = (H - PAD_T - PAD_B) / n;

  let maxVal = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (matrix[i][j] > maxVal) maxVal = matrix[i][j];
    }
  }

  const interpolateColor = (val: number) => {
    const pct = maxVal > 0 ? val / maxVal : 0;
    const c1 = [
      parseInt(colorStart.slice(1, 3), 16),
      parseInt(colorStart.slice(3, 5), 16),
      parseInt(colorStart.slice(5, 7), 16),
    ];
    const c2 = [
      parseInt(colorEnd.slice(1, 3), 16),
      parseInt(colorEnd.slice(3, 5), 16),
      parseInt(colorEnd.slice(5, 7), 16),
    ];
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * pct);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * pct);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * pct);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="bg-surface-800/30 rounded-xl border border-white/[0.04] p-3 overflow-x-auto flex flex-col items-center">
      <p className="text-xs font-bold text-surface-300 mb-2 w-full text-left">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[400px]">
        <text
          x={PAD_L / 2}
          y={H / 2}
          fill="#94a3b8"
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90, ${PAD_L / 2}, ${H / 2})`}
        >
          Réel
        </text>
        {labels?.map((lbl, i) => (
          <text
            key={`yl-${i}`}
            x={PAD_L - 8}
            y={PAD_T + (i + 0.5) * cellH + 4}
            fill="#cbd5e1"
            fontSize="10"
            textAnchor="end"
          >
            {lbl}
          </text>
        ))}

        <text x={PAD_L + (W - PAD_L - PAD_R) / 2} y={H - 10} fill="#94a3b8" fontSize="11" textAnchor="middle">
          Prédit
        </text>
        {labels?.map((lbl, j) => (
          <text
            key={`xl-${j}`}
            x={PAD_L + (j + 0.5) * cellW}
            y={H - PAD_B + 16}
            fill="#cbd5e1"
            fontSize="10"
            textAnchor="middle"
          >
            {lbl}
          </text>
        ))}

        {matrix.map((row, i) =>
          row.map((val, j) => (
            <g key={`cell-${i}-${j}`}>
              <rect
                x={PAD_L + j * cellW}
                y={PAD_T + i * cellH}
                width={cellW - 1}
                height={cellH - 1}
                fill={interpolateColor(val)}
                rx={2}
              />
              <text
                x={PAD_L + (j + 0.5) * cellW}
                y={PAD_T + (i + 0.5) * cellH + 4}
                fill={val > maxVal / 2 ? '#ffffff' : '#94a3b8'}
                fontSize="11"
                textAnchor="middle"
                fontWeight="bold"
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
