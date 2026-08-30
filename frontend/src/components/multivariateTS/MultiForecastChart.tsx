import { useEffect, useMemo, useState } from 'react';
import type { MultivariateTimeSeriesResults } from '../../types';
import { PlotlyMultiForecast } from './PlotlyMultiForecast';

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

    if (vars.length > 0 && focusVar === 'all') {
      setFocusVar(vars[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vars.join('|')]);

  const stats = useMemo(() => {
    const out: Record<string, { mean: number; std: number }> = {};
    vars.forEach(v => {
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
  }, [fc.series, hist.series, vars]);

  const norm = (val: number | null | undefined, v: string) => {
    if (val === null || val === undefined || !normalize) return val;
    const s = stats[v];
    if (!s || !s.std) return val;
    return (val - s.mean) / s.std;
  };

  const formatDate = (raw: string) => {
    if (!raw) return '';
    if (resolvedGranularity === 'year') return raw.slice(0, 4);
    if (resolvedGranularity === 'month') return raw.slice(0, 7);
    return raw.slice(0, 10);
  };

  const chartData = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    const nHist = hist.dates.length;

    for (let i = 0; i < nHist; i++) {
      const row: Record<string, unknown> = {
        date: formatDate(hist.dates[i]),
        phase: 'history',
      };
      for (const v of vars) {
        row[`${v}_obs`] = norm(hist.series[v]?.[i] ?? null, v);
        row[`${v}_fit`] = norm(hist.fitted?.[v]?.[i] ?? null, v);
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
  }, [
    fc.dates,
    fc.series,
    hist.dates,
    hist.fitted,
    hist.series,
    vars,
    normalize,
    stats,
    resolvedGranularity,
  ]);

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
  const compareVars = viewMode === 'detail' ? [detailVar] : vars;

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-3">
        <p className="text-xs font-medium text-gray-600">Historique, ajustement et prévisions</p>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Vue
          <select
            value={viewMode}
            onChange={e => setViewMode(e.target.value as 'detail' | 'compare')}
            className="text-xs"
          >
            <option value="detail">Détaillée</option>
            <option value="compare">Comparée</option>
          </select>
        </label>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          Variable
          <select
            value={focusVar}
            onChange={e => setFocusVar(e.target.value)}
            className="text-xs"
          >
            <option value="all">Toutes</option>
            {vars.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600 flex items-center gap-2">
          <input
            type="checkbox"
            checked={normalize}
            onChange={e => setNormalize(e.target.checked)}
          />
          Normaliser
        </label>
        {!compact && (
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={dualAxis}
              onChange={e => setDualAxis(e.target.checked)}
            />
            Double axe Y
          </label>
        )}
      </div>

      {dualAxis && !compact && (
        <div className="flex flex-wrap items-center gap-3 p-2 mb-3 bg-white/[0.03] rounded-lg border border-white/10 text-xs">
          <span className="text-surface-400">Affectation des axes :</span>
          {vars.map(v => (
            <label key={v} className="flex items-center gap-1">
              <span className="font-mono text-surface-200">{v}</span>
              <select
                value={axisByVar[v] || 'left'}
                onChange={e =>
                  setAxisByVar(prev => ({ ...prev, [v]: e.target.value as 'left' | 'right' }))
                }
                className="text-[11px] py-0.5"
              >
                <option value="left">Gauche (Y1)</option>
                <option value="right">Droite (Y2)</option>
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="p-3 bg-surface-900/60 rounded-xl border border-white/10">
        <PlotlyMultiForecast
          data={aggregatedData}
          forecastStart={forecastStart}
          forecastEnd={forecastEnd}
          viewMode={viewMode}
          detailVar={detailVar}
          compareVars={compareVars}
          axisByVar={axisByVar}
          dualAxis={dualAxis}
          height={compact ? 300 : 420}
        />
      </div>
    </div>
  );
}
