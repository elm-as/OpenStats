import { useState } from 'react';
import { useRunTimeSeriesMutation } from '../store/api';
import type { TimeSeriesResults, DataCapabilities } from '../types';
import {
  TrendingUp, Activity, ArrowLeft, Play, CheckCircle2,
  AlertTriangle, BarChart3, Trophy,
} from 'lucide-react';
import { TSForecast, TSDecomposition, ACFPlot, QQPlot } from './viz';
import { Card, Badge, Button, Section, Stat, StatGrid } from './ui';

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  configValues: Record<string, string>;
  onBack: () => void;
}

export default function TimeSeriesPanel({
  datasetId,
  capabilities: _caps,
  configValues,
  onBack,
}: Props) {
  void _caps;
  const [runTimeSeries, { isLoading }] = useRunTimeSeriesMutation();
  const [results, setResults] = useState<TimeSeriesResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const dateCol = configValues.date_col || '';
  const valueCol = configValues.value_col || '';
  const forecastSteps = parseInt(configValues.forecast_steps || '10', 10);

  const handleRun = async () => {
    if (!dateCol || !valueCol) {
      setError('Sélectionnez une colonne date et une colonne valeur');
      return;
    }
    setError(null);
    try {
      const res = await runTimeSeries({
        id: datasetId,
        date_col: dateCol,
        value_col: valueCol,
        forecast_steps: forecastSteps,
      }).unwrap();
      if (res.error) {
        setError(res.error);
      } else {
        setResults(res);
        setSelectedModel(res.best_model || null);
      }
    } catch (err: any) {
      setError(err?.data?.error || "Erreur lors de l'analyse");
    }
  };

  if (!results && !isLoading) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-400" />
            <h3 className="section-title">Séries temporelles</h3>
          </div>
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Retour
          </Button>
        </div>

        <Card>
          <p className="text-default text-sm mb-4">
            Analyse de <code className="text-accent-300 text-xs">{valueCol}</code> en fonction de{' '}
            <code className="text-accent-300 text-xs">{dateCol}</code> — horizon :{' '}
            <Badge variant="info">{forecastSteps} pas</Badge>
          </p>
          {error && (
            <Card variant="flat" className="!bg-red-500/5 !border-red-500/30 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </Card>
          )}
          <Button onClick={handleRun} icon={<Play className="w-4 h-4" />}>
            Lancer l'analyse
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-accent-500/30 border-t-accent-400 rounded-full mx-auto" />
        <p className="text-muted mt-4 text-sm">Analyse en cours… (ajustement ARIMA/SARIMA)</p>
      </Card>
    );
  }

  if (error || !results) {
    return (
      <Card className="!bg-red-500/5 !border-red-500/30">
        <p className="text-red-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={onBack} className="mt-3">Retour</Button>
      </Card>
    );
  }

  const currentModelResult = selectedModel ? results.models[selectedModel] : null;

  return (
    <div className="section">
      <div className="section-header">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <h3 className="section-title">Résultats — Séries temporelles</h3>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
          Nouvelle analyse
        </Button>
      </div>

      {/* Overview KPIs */}
      <StatGrid>
        <Stat
          label="Observations"
          value={results.n_observations.toLocaleString()}
          icon={<BarChart3 className="w-3 h-3" />}
        />
        <Stat
          label="Fréquence"
          value={results.frequency}
          icon={<Activity className="w-3 h-3" />}
        />
        <Stat
          label="Saisonnalité"
          value={String(results.seasonal_period)}
          icon={<TrendingUp className="w-3 h-3" />}
          hint={results.seasonal_period > 1 ? 'détectée' : 'aucune'}
        />
        <Stat
          label="Stationnarité"
          value={results.stationarity.is_stationary ? 'OK' : 'Non'}
          iconColor={results.stationarity.is_stationary ? 'text-emerald-400' : 'text-amber-400'}
          icon={results.stationarity.is_stationary
            ? <CheckCircle2 className="w-3 h-3" />
            : <AlertTriangle className="w-3 h-3" />}
        />
      </StatGrid>

      {/* Stationnarité détails */}
      <Section
        title="Tests de stationnarité"
        icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
        subtitle={results.stationarity.conclusion}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {'adf' in results.stationarity && !('error' in (results.stationarity.adf as any)) && (
            <Card variant="flat">
              <p className="text-xs text-muted uppercase tracking-wider mb-2">ADF — H₀ : non-stationnaire</p>
              <div className="num text-sm space-y-1">
                <div className="text-default">stat = <span className="text-strong">{(results.stationarity.adf as any).statistic}</span></div>
                <div>p = <span className={(results.stationarity.adf as any).p_value < 0.05 ? 'text-emerald-300 font-bold' : 'text-red-300'}>
                  {(results.stationarity.adf as any).p_value < 0.001 ? '< 0.001' : (results.stationarity.adf as any).p_value}
                </span></div>
              </div>
              <p className="text-xs text-muted mt-2">{(results.stationarity.adf as any).interpretation}</p>
            </Card>
          )}
          {'kpss' in results.stationarity && !('error' in (results.stationarity.kpss as any)) && (
            <Card variant="flat">
              <p className="text-xs text-muted uppercase tracking-wider mb-2">KPSS — H₀ : stationnaire</p>
              <div className="num text-sm space-y-1">
                <div className="text-default">stat = <span className="text-strong">{(results.stationarity.kpss as any).statistic}</span></div>
                <div>p = <span className={(results.stationarity.kpss as any).p_value > 0.05 ? 'text-emerald-300 font-bold' : 'text-red-300'}>
                  {(results.stationarity.kpss as any).p_value}
                </span></div>
              </div>
              <p className="text-xs text-muted mt-2">{(results.stationarity.kpss as any).interpretation}</p>
            </Card>
          )}
        </div>
      </Section>

      {/* Décomposition Plotly stacked */}
      {results.decomposition && (
        <Section
          title="Décomposition de la série"
          icon={<Activity className="w-4 h-4 text-accent-400" />}
          subtitle={`Modèle ${results.decomposition.model} • période ${results.decomposition.period}`}
        >
          <Card noPadding className="!p-0">
            <TSDecomposition
              dates={results.decomposition.dates}
              observed={results.decomposition.observed.map(v => v ?? NaN)}
              trend={results.decomposition.trend.map(v => v ?? NaN)}
              seasonal={results.decomposition.seasonal.map(v => v ?? NaN)}
              residuals={results.decomposition.residual.map(v => v ?? 0)}
            />
          </Card>
        </Section>
      )}

      {/* Model ranking */}
      {results.ranking.length > 0 && (
        <Section
          title="Classement des modèles"
          icon={<Trophy className="w-4 h-4 text-amber-400" />}
          subtitle="Sélectionnez un modèle pour voir ses prévisions"
        >
          <div className="space-y-1.5">
            {results.ranking.map((r, i) => {
              const active = selectedModel === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setSelectedModel(r.key)}
                  className={`w-full text-left p-3 rounded-lg border transition-all focus-ring ${
                    active
                      ? 'border-accent-500/40 bg-accent-500/10 shadow-[0_0_0_1px_rgba(6,182,212,0.15)]'
                      : 'border-white/8 bg-white/[0.02] hover:bg-white/5 hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {i === 0 ? (
                        <Trophy className="w-4 h-4 text-amber-400" />
                      ) : (
                        <span className="w-4 text-center text-xs text-muted font-mono">#{i + 1}</span>
                      )}
                      <span className={`font-medium ${active ? 'text-accent-200' : 'text-strong'}`}>{r.model}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs num">
                      <span className="text-muted">AIC <span className="text-default">{r.aic.toFixed(1)}</span></span>
                      {r.bic != null && <span className="text-muted">BIC <span className="text-default">{r.bic.toFixed(1)}</span></span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Prévision du modèle choisi */}
      {currentModelResult && !currentModelResult.error && (
        <Section
          title={
            <>
              {currentModelResult.model}
              {currentModelResult.order && <span className="text-muted ml-1 text-xs">({currentModelResult.order.join(',')})</span>}
              {currentModelResult.seasonal_order && <span className="text-muted ml-1 text-xs">× ({currentModelResult.seasonal_order.join(',')})</span>}
            </>
          }
          icon={<TrendingUp className="w-4 h-4 text-accent-400" />}
        >
          <Card>
            {/* Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {currentModelResult.aic != null && <Badge variant="info">AIC {currentModelResult.aic.toFixed(2)}</Badge>}
              {currentModelResult.bic != null && <Badge variant="info">BIC {currentModelResult.bic.toFixed(2)}</Badge>}
              {currentModelResult.residuals_mean != null && <Badge variant="neutral">Résidus μ {currentModelResult.residuals_mean.toFixed(4)}</Badge>}
              {currentModelResult.residuals_std != null && <Badge variant="neutral">Résidus σ {currentModelResult.residuals_std.toFixed(4)}</Badge>}
            </div>

            {/* Plotly forecast */}
            <TSForecast
              history={{
                dates: currentModelResult.history.dates,
                values: currentModelResult.history.values.map(v => v ?? NaN),
              }}
              fitted={{
                dates: currentModelResult.history.dates,
                values: currentModelResult.history.fitted.map(v => v ?? NaN),
              }}
              forecast={{
                dates: currentModelResult.forecast.dates,
                values: currentModelResult.forecast.values.map(v => v ?? NaN),
                lower: currentModelResult.forecast.lower_ci?.map(v => v ?? NaN),
                upper: currentModelResult.forecast.upper_ci?.map(v => v ?? NaN),
              }}
              yLabel={valueCol}
            />
          </Card>

          {/* Diagnostics résidus */}
          {(currentModelResult as any).residuals && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {(currentModelResult as any).acf && (
                <Card>
                  <h4 className="text-strong mb-3">ACF des résidus</h4>
                  <ACFPlot
                    values={(currentModelResult as any).acf}
                    sampleSize={results.n_observations}
                    type="ACF"
                  />
                </Card>
              )}
              <Card>
                <h4 className="text-strong mb-3">Q-Q plot des résidus</h4>
                <QQPlot values={(currentModelResult as any).residuals} />
              </Card>
            </div>
          )}
        </Section>
      )}

      {currentModelResult?.error && (
        <Card className="!bg-red-500/5 !border-red-500/30">
          <p className="text-red-300 text-sm">{currentModelResult.error}</p>
        </Card>
      )}
    </div>
  );
}
