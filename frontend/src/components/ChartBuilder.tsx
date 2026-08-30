import { useState } from 'react';
import { useGetChartDataMutation } from '../store/api';
import type { ChartDataResponse, DataCapabilities } from '../types';
import {
  BarChart3, TrendingUp, PieChart as PieIcon, Maximize2,
  Play, ArrowLeft, Box as BoxIcon, Activity, AreaChart as AreaIcon, GitBranch,
} from 'lucide-react';
import { Card, Button, Badge } from './ui';
import { CHART_TYPES, AGGREGATIONS, type ChartType } from './chartBuilder/chartBuilderConstants';
import { ChartRenderer } from './chartBuilder/ChartRenderers';

const CHART_ICONS: Record<string, any> = {
  line: TrendingUp, bar: BarChart3, stacked_bar: BarChart3, pie: PieIcon,
  scatter: Maximize2, bubble: Maximize2, area: AreaIcon,
  histogram: Activity, box: BoxIcon, violin: GitBranch,
  heatmap: Activity, radar: PieIcon,
};

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  onBack: () => void;
}

export default function ChartBuilder({ datasetId, capabilities, onBack }: Props) {
  const [getChartData, { isLoading }] = useGetChartDataMutation();

  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [xCol, setXCol] = useState('');
  const [yCols, setYCols] = useState<string[]>([]);
  const [groupCol, setGroupCol] = useState('');
  const [aggregation, setAggregation] = useState('mean');
  const [timeGranularity, setTimeGranularity] = useState<'auto' | 'day' | 'month' | 'year'>('auto');
  const [colorCol, setColorCol] = useState('');
  const [sizeCol, setSizeCol] = useState('');
  const [chartTitle, setChartTitle] = useState('');
  const [logScale, setLogScale] = useState(false);
  const [chartData, setChartData] = useState<ChartDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allCols = [
    ...capabilities.columns.numeric,
    ...capabilities.columns.categorical,
    ...capabilities.columns.temporal,
  ];
  const numericCols = capabilities.columns.numeric;
  const categoricalCols = [...capabilities.columns.categorical, ...capabilities.columns.temporal];
  const temporalCols = capabilities.columns.temporal;

  const isUnivariate = chartType === 'histogram' || chartType === 'box' || chartType === 'violin';

  const handleGenerate = async () => {
    if (!chartType) return;
    setError(null);

    if (chartType === 'pie') {
      if (!xCol) { setError("Sélectionnez une colonne d'étiquettes"); return; }
    } else if (chartType === 'scatter') {
      if (!xCol) { setError('Sélectionnez la variable X'); return; }
      if (yCols.length === 0) { setError('Sélectionnez au moins une variable Y'); return; }
    } else if (isUnivariate) {
      if (yCols.length === 0) { setError('Sélectionnez au moins une variable numérique'); return; }
    } else {
      if (!xCol) { setError("Sélectionnez la variable pour l'axe X"); return; }
      if (yCols.length === 0) { setError('Sélectionnez au moins une variable Y (numérique)'); return; }
    }

    if (isUnivariate) {
      try {
        const result = await getChartData({
          id: datasetId,
          chart_type: 'raw_values' as any,
          y_cols: yCols,
        }).unwrap();
        if (result.error) setError(result.error);
        else setChartData({ ...result, chart_type: chartType } as any);
      } catch (err: any) {
        setError(err?.data?.error || 'Erreur lors de la récupération des données');
      }
      return;
    }

    try {
      const result = await getChartData({
        id: datasetId,
        chart_type: chartType as any,
        x_col: xCol || undefined,
        y_cols: yCols.length > 0 ? yCols : undefined,
        group_col: groupCol || undefined,
        color_col: colorCol || undefined,
        size_col: sizeCol || undefined,
        chart_title: chartTitle || undefined,
        log_y: logScale || undefined,
        aggregation: aggregation as any,
        time_granularity:
          xCol && temporalCols.includes(xCol) && chartType !== 'scatter' && chartType !== 'bubble'
            ? timeGranularity
            : undefined,
      }).unwrap();

      if (result.error) setError(result.error);
      else setChartData(result);
    } catch (err: any) {
      setError(err?.data?.error || 'Erreur lors de la génération du graphique');
    }
  };

  const toggleYCol = (col: string) => {
    setYCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  if (!chartType) {
    return (
      <div className="section">
        <div className="section-header">
          <h3 className="section-title">Choisir un type de graphique</h3>
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Retour
          </Button>
        </div>
        <div className="grid-auto-fit">
          {CHART_TYPES.map((ct) => {
            const Icon = CHART_ICONS[ct.key];
            return (
              <button
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                className="card text-left p-4 hover:border-accent-500/40 hover:bg-accent-500/5 transition-all focus-ring group"
              >
                <Icon className="w-5 h-5 text-accent-400 mb-2 group-hover:scale-110 transition-transform" />
                <h4 className="text-strong text-sm font-semibold">{ct.label}</h4>
                <p className="text-xs text-muted mt-1 line-clamp-2">{ct.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentLabel = CHART_TYPES.find((c) => c.key === chartType)?.label;

  return (
    <div className="section">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <h3 className="section-title">{currentLabel}</h3>
          <Badge variant="info">configuration</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setChartType(null); setChartData(null); }}>
            Changer de type
          </Button>
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Retour
          </Button>
        </div>
      </div>

      <Card>
        <h4 className="text-strong mb-3 text-sm">Configuration</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {chartType !== 'pie' && !isUnivariate && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Axe X {chartType === 'scatter' ? '(numérique)' : '(catégorie/valeur)'} <span className="text-red-400">*</span>
              </label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} title="Axe X">
                <option value="">Sélectionner…</option>
                {(chartType === 'scatter' ? numericCols : allCols).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {chartType === 'pie' && (
            <>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Étiquettes <span className="text-red-400">*</span>
                </label>
                <select value={xCol} onChange={(e) => setXCol(e.target.value)} title="Étiquettes">
                  <option value="">Sélectionner…</option>
                  {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                  Valeurs <span className="text-faint normal-case">(vide = comptage)</span>
                </label>
                <select
                  value={yCols[0] || ''}
                  onChange={(e) => setYCols(e.target.value ? [e.target.value] : [])}
                  title="Valeurs"
                >
                  <option value="">Comptage automatique</option>
                  {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {chartType !== 'pie' && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                {isUnivariate ? 'Variable(s) numérique(s)' : 'Valeur(s) Y'} <span className="text-red-400">*</span>
              </label>
              <div className="max-h-36 overflow-y-auto rounded-lg p-1.5 space-y-0.5 bg-white/[0.02] border border-white/8">
                {numericCols.map((c) => {
                  const checked = yCols.includes(c);
                  return (
                    <label key={c} className={`flex items-center gap-2 text-xs cursor-pointer p-1.5 rounded transition-colors ${checked ? 'bg-accent-500/10 text-accent-200' : 'text-default hover:bg-white/5'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleYCol(c)} className="accent-accent-500 !w-3.5 !h-3.5" />
                      {c}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {['scatter', 'bubble', 'bar', 'line'].includes(chartType) && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Couleur <span className="text-faint normal-case">(optionnel)</span>
              </label>
              <select value={colorCol} onChange={(e) => setColorCol(e.target.value)} title="Couleur">
                <option value="">Aucune</option>
                {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {chartType === 'bubble' && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Taille des bulles <span className="text-red-400">*</span>
              </label>
              <select value={sizeCol} onChange={(e) => setSizeCol(e.target.value)} title="Taille">
                <option value="">Sélectionner…</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {chartType !== 'scatter' && !isUnivariate && (chartType !== 'pie' || yCols.length > 0) && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Agrégation</label>
              <select value={aggregation} onChange={(e) => setAggregation(e.target.value)} title="Agrégation">
                {AGGREGATIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </div>
          )}

          {chartType !== 'scatter' && !isUnivariate && xCol && temporalCols.includes(xCol) && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">Granularité temporelle</label>
              <select value={timeGranularity} onChange={(e) => setTimeGranularity(e.target.value as any)} title="Granularité">
                <option value="auto">Auto (selon le volume)</option>
                <option value="day">Jour</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
              </select>
            </div>
          )}

          {(chartType === 'bar' || chartType === 'stacked_bar' || chartType === 'line') && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Grouper par <span className="text-faint normal-case">(optionnel)</span>
              </label>
              <select value={groupCol} onChange={(e) => setGroupCol(e.target.value)} title="Grouper par">
                <option value="">Aucun</option>
                {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5 uppercase tracking-wider">
                Titre personnalisé <span className="text-faint normal-case">(optionnel)</span>
              </label>
              <input type="text" value={chartTitle} onChange={(e) => setChartTitle(e.target.value)} placeholder="Ex: Évolution du CA" className="w-full bg-surface-900 border border-white/10 rounded-md px-3 py-1.5 text-sm text-surface-200" />
            </div>
            {['line', 'bar', 'scatter', 'bubble', 'area'].includes(chartType) && (
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-surface-200">
                  <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} className="accent-accent-500 w-4 h-4" />
                  Échelle logarithmique (Axe Y)
                </label>
              </div>
            )}
          </div>
        </div>

        {error && (
          <Card variant="flat" className="!bg-red-500/5 !border-red-500/30 mt-4">
            <p className="text-red-300 text-sm">{error}</p>
          </Card>
        )}

        <div className="mt-4">
          <Button onClick={handleGenerate} disabled={isLoading} loading={isLoading} icon={<Play className="w-4 h-4" />}>
            {isLoading ? 'Génération…' : 'Générer le graphique'}
          </Button>
        </div>
      </Card>

      {chartData && !chartData.error && (
        <Card>
          <ChartRenderer data={chartData} chartType={chartType} yCols={yCols} />
        </Card>
      )}
    </div>
  );
}

// Re-exports pour rétrocompatibilité
export { ChartRenderer, PlotlyChartFromBackend } from './chartBuilder/ChartRenderers';
