import { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import type { Data, Layout } from 'plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG } from '../viz/PlotlyBase';
import type { MultivariateTimeSeriesResults } from '../../types';
import { COLORS, FORECAST_COLORS } from './constants';

export function MultiForecastChart({
  model,
  granularity,
  compact = false,
}: {
  model: NonNullable<MultivariateTimeSeriesResults['models'][string]>;
  granularity: 'auto' | 'day' | 'month' | 'year';
  compact?: boolean;
}) {
  const hist = model.history;
  const fc = model.forecast;
  const vars = model.variables;
  const [normalize, setNormalize] = useState(false);
  const [dualAxis, setDualAxis] = useState(false);
  const [axisByVar, setAxisByVar] = useState<Record<string, 'left' | 'right'>>({});
  const [focusVar, setFocusVar] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'detail' | 'compare'>('detail');
  const resolvedGranularity = useMemo(() => {
    if (granularity !== 'auto') return granularity;
    const points = hist.dates.length + fc.dates.length;
    if (points > 15000) return 'year';
    if (points > 1500) return 'month';
    return 'day';
  }, [granularity, hist.dates.length, fc.dates.length]);

  useEffect(() => {
    const next: Record<string, 'left' | 'right'> = {};
    vars.forEach((v, i) => {
      next[v] = i === 0 ? 'left' : 'right';
    });
    setAxisByVar(next);

    // Mode simple par défaut : une variable pour mieux voir l'historique vs la prévision.
    if (vars.length > 0 && focusVar === 'all') {
      setFocusVar(vars[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars.join('|')]);

  const stats = useMemo(() => {
    const out: Record<string, { mean: number; std: number }> = {};
    vars.forEach((v) => {
      const values = [
        ...(hist.series[v] || []).filter((x): x is number => typeof x === 'number'),
        ...(fc.series[v] || []).filter((x): x is number => typeof x === 'number'),
      ];
      if (!values.length) {
        out[v] = { mean: 0, std: 1 };
        return;
      }
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance) || 1;
      out[v] = { mean, std };
    });
    return out;
  }, [vars, hist.series, fc.series]);

  const visibleVars = useMemo(() => {
    if (focusVar === 'all') return vars;
    return vars.includes(focusVar) ? [focusVar] : vars;
  }, [focusVar, vars]);

  const norm = (v: number | null | undefined, key: string) => {
    if (!normalize || v == null || typeof v !== 'number') return v;
    const st = stats[key];
    return (v - st.mean) / st.std;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    if (resolvedGranularity === 'year') return String(y);
    if (resolvedGranularity === 'month') return `${y}-${m}`;
    return `${y}-${m}-${day}`;
  };

  const chartData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];

    for (let i = 0; i < hist.dates.length; i++) {
      const row: Record<string, unknown> = {
        date: formatDate(hist.dates[i]),
        phase: 'history',
      };
      for (const v of vars) {
        row[`${v}_obs`] = norm(hist.series[v]?.[i] ?? null, v);
        row[`${v}_fit`] = norm(hist.fitted[v]?.[i] ?? null, v);
      }
      rows.push(row);
    }

    for (let i = 0; i < fc.dates.length; i++) {
      const row: Record<string, unknown> = {
        date: formatDate(fc.dates[i]),
        phase: 'forecast',
      };
      for (const v of vars) {
        row[`${v}_fc`] = norm(fc.series[v]?.[i] ?? null, v);
      }
      rows.push(row);
    }

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc.dates, fc.series, hist.dates, hist.fitted, hist.series, vars, normalize, stats, resolvedGranularity]);

  const aggregatedData = useMemo(() => {
    const buckets = new Map<string, { count: number; sums: Record<string, number> }>();
    for (const row of chartData) {
      const key = String(row.date || '');
      if (!buckets.has(key)) {
        buckets.set(key, { count: 0, sums: {} });
      }
      const bucket = buckets.get(key)!;
      bucket.count += 1;
      for (const [k, v] of Object.entries(row)) {
        if (k === 'date') continue;
        if (typeof v === 'number' && Number.isFinite(v)) {
          bucket.sums[k] = (bucket.sums[k] || 0) + v;
        }
      }
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, agg]) => {
        const out: Record<string, unknown> = { date };
        for (const [k, sum] of Object.entries(agg.sums)) {
          out[k] = sum / agg.count;
        }
        return out;
      });
  }, [chartData]);

  const forecastStart = formatDate(fc.dates[0] || '');
  const forecastEnd = formatDate(fc.dates[fc.dates.length - 1] || '');

  const detailVar = focusVar !== 'all' && vars.includes(focusVar) ? focusVar : vars[0];
  const compareVars = viewMode === 'detail' ? [detailVar] : visibleVars;

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-3">
        <p className="text-xs font-medium text-gray-600">Historique, ajustement et prévisions</p>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Vue
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as 'detail' | 'compare')} className="text-xs">
            <option value="detail">Détaillée</option>
            <option value="compare">Comparée</option>
          </select>
        </label>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Variable
          <select value={focusVar} onChange={(e) => setFocusVar(e.target.value)} className="text-xs">
            <option value="all">Toutes</option>
            {vars.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} />
          Normaliser
        </label>
        {!compact && (
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input type="checkbox" checked={dualAxis} onChange={(e) => setDualAxis(e.target.checked)} />
            Double axe Y
          </label>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {normalize
          ? 'Mode normalisé : comparaison des tendances entre variables.'
          : 'Mode valeurs réelles : les unités d\'origine sont conservées.'}
      </p>
      <p className="text-xs text-cyan-300 mb-2">
        Prévision affichée de {forecastStart} à {forecastEnd} ({fc.dates.length} pas)
      </p>

      {!compact && dualAxis && viewMode === 'compare' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          {vars.map((v) => (
            <label key={v} className="text-xs text-gray-600 flex items-center justify-between gap-2 bg-gray-50 rounded p-2">
              <span>{v}</span>
              <select
                value={axisByVar[v] || 'left'}
                onChange={(e) => setAxisByVar((prev) => ({ ...prev, [v]: e.target.value as 'left' | 'right' }))}
                className="text-xs"
              >
                <option value="left">Axe gauche</option>
                <option value="right">Axe droit</option>
              </select>
            </label>
          ))}
        </div>
      )}

      <PlotlyMultiForecast
        data={aggregatedData}
        forecastStart={forecastStart}
        forecastEnd={forecastEnd}
        viewMode={viewMode}
        detailVar={detailVar}
        compareVars={compareVars}
        axisByVar={axisByVar}
        dualAxis={!compact && dualAxis}
        height={compact ? 300 : 400}
      />
    </div>
  );
}

// ── Plotly multi-forecast ──
function PlotlyMultiForecast({
  data,
  forecastStart,
  forecastEnd,
  viewMode,
  detailVar,
  compareVars,
  axisByVar,
  dualAxis,
  height,
}: {
  data: Record<string, unknown>[];
  forecastStart: string;
  forecastEnd: string;
  viewMode: 'detail' | 'compare';
  detailVar: string;
  compareVars: string[];
  axisByVar: Record<string, 'left' | 'right'>;
  dualAxis: boolean;
  height: number;
}) {
  const dates = data.map(r => String(r.date || ''));
  const traces: Data[] = [];
  const getCol = (key: string) => data.map(r => {
    const v = r[key];
    return typeof v === 'number' ? v : null;
  });

  if (viewMode === 'detail') {
    const obsColor = COLORS[0];
    const fitColor = '#a78bfa';
    const fcColor = FORECAST_COLORS[0];
    traces.push({
      x: dates, y: getCol(`${detailVar}_obs`),
      type: 'scatter', mode: 'lines', name: `${detailVar} observé`,
      line: { color: obsColor, width: 2 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>observé</extra>',
    } as Data);
    traces.push({
      x: dates, y: getCol(`${detailVar}_fit`),
      type: 'scatter', mode: 'lines', name: `${detailVar} ajusté`,
      line: { color: fitColor, width: 1.6, dash: 'dot' },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>ajusté</extra>',
    } as Data);
    traces.push({
      x: dates, y: getCol(`${detailVar}_fc`),
      type: 'scatter', mode: 'lines+markers', name: `${detailVar} prévision`,
      line: { color: fcColor, width: 2.5 },
      marker: { size: 4 },
      connectgaps: false,
      hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>prévision</extra>',
    } as Data);
  } else {
    compareVars.forEach((v, i) => {
      const yaxis = dualAxis && axisByVar[v] === 'right' ? 'y2' : 'y';
      traces.push({
        x: dates, y: getCol(`${v}_obs`),
        type: 'scatter', mode: 'lines', name: `${v} observé`,
        line: { color: COLORS[i % COLORS.length], width: 1.6 },
        connectgaps: false, yaxis,
        hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>' + v + ' obs.</extra>',
      } as Data);
      traces.push({
        x: dates, y: getCol(`${v}_fc`),
        type: 'scatter', mode: 'lines', name: `${v} prévision`,
        line: { color: FORECAST_COLORS[i % FORECAST_COLORS.length], width: 2.5, dash: 'dash' },
        connectgaps: false, yaxis,
        hovertemplate: '<b>%{x}</b><br>%{y:.4f}<extra>' + v + ' prév.</extra>',
      } as Data);
    });
  }

  const shapes: any[] = [];
  if (forecastStart && forecastEnd) {
    shapes.push({
      type: 'rect', xref: 'x', yref: 'paper',
      x0: forecastStart, x1: forecastEnd, y0: 0, y1: 1,
      fillcolor: 'rgba(6, 182, 212, 0.08)',
      line: { width: 0 },
      layer: 'below',
    });
  }
  if (forecastStart) {
    shapes.push({
      type: 'line', xref: 'x', yref: 'paper',
      x0: forecastStart, x1: forecastStart, y0: 0, y1: 1,
      line: { color: '#67e8f9', width: 1.5, dash: 'dot' },
    });
  }

  const annotations: any[] = forecastStart ? [{
    x: forecastStart, y: 1.02, xref: 'x', yref: 'paper',
    text: 'Prévision', showarrow: false,
    font: { size: 10, color: '#67e8f9' },
  }] : [];

  const layout: Partial<Layout> = {
    ...DARK_TEMPLATE,
    autosize: true,
    margin: { l: 60, r: dualAxis ? 60 : 20, t: 30, b: 60 },
    xaxis: { ...DARK_TEMPLATE.xaxis, tickangle: -25 },
    yaxis: { ...DARK_TEMPLATE.yaxis, title: { text: 'Valeur', font: { color: '#dfe3ee', size: 10 } } },
    yaxis2: dualAxis ? {
      title: { text: 'Valeur (axe droit)', font: { color: '#fcd34d', size: 10 } },
      overlaying: 'y', side: 'right',
      gridcolor: 'transparent', zeroline: false,
      tickfont: { color: '#fcd34d', size: 9 },
    } : undefined,
    legend: { orientation: 'h', y: -0.18, font: { color: '#dfe3ee', size: 10 } },
    shapes,
    annotations,
    hovermode: 'x unified',
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={DEFAULT_CONFIG}
      style={{ width: '100%', height }}
      useResizeHandler
    />
  );
}
