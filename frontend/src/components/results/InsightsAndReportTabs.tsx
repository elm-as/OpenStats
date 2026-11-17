import React from 'react';
import { BarChart2, Info, Activity, FileText, Download, Loader2 } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import type { ShapResult, InsightsResult } from './ResultsWizardTypes';

export function ShapTab({ result }: { result?: ShapResult }) {
  if (!result) return <EmptyState message="Pas de résultats SHAP disponibles" />;

  if (result.note) {
    return (
      <div className="ui-panel p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ui-warning)' }} />
        <div className="text-xs space-y-1">
          <h3 className="font-semibold" style={{ color: 'var(--ui-text)' }}>Explicabilité SHAP</h3>
          <p className="ui-t-secondary">{result.note}</p>
        </div>
      </div>
    );
  }

  const importance = result.global_importance || [];
  const waterfall = result.waterfall_example || [];

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <BarChart2 className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Importance des variables (SHAP)
        </span>
      </header>

      <div className="p-3 space-y-4">
        {importance.length > 0 ? (
          <div className="space-y-2 ui-num">
            {importance.map((imp: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="ui-t-secondary w-44 shrink-0 break-words" title={imp.feature}>{imp.feature}</span>
                <div className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--ui-bg-sunken)' }}>
                  <div
                    className="h-full"
                    style={{
                      background: 'var(--ui-accent)',
                      width: `${Math.min((imp.mean_shap / importance[0].mean_shap) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="ui-t-accent w-16 text-right font-semibold">
                  {imp.mean_shap.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucune importance SHAP disponible" />
        )}

        {waterfall.length > 0 && (
          <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--ui-border)' }}>
            <h4 className="ui-label">Exemple local (waterfall)</h4>
            {waterfall.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs ui-num">
                <span className="ui-t-secondary w-44 shrink-0 break-words" title={item.feature}>{item.feature}</span>
                <div className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--ui-bg-sunken)' }}>
                  <div
                    className="h-full"
                    style={{
                      background: item.shap_value >= 0 ? 'var(--ui-success)' : 'var(--ui-danger)',
                      width: `${Math.min(Math.abs(item.shap_value) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span
                  className="w-16 text-right font-semibold"
                  style={{ color: item.shap_value >= 0 ? 'var(--ui-success)' : 'var(--ui-danger)' }}
                >
                  {item.shap_value.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function InsightsTab({ result }: { result?: InsightsResult }) {
  if (!result) return <EmptyState message="Pas d'insights disponibles" />;

  if ((result as any).note) {
    return (
      <div className="ui-panel p-3 flex items-start gap-2.5 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ui-warning)' }} />
        <p className="ui-t-secondary">{(result as any).note}</p>
      </div>
    );
  }

  const insights = result.insights || [];

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Insights générés ({insights.length})
        </span>
      </header>
      <div className="p-3 space-y-2">
        {insights.length > 0 ? (
          insights.map((insight: any, i: number) => {
            const border =
              insight.severity === 'critical' ? 'var(--ui-danger)'
                : insight.severity === 'warning' ? 'var(--ui-warning)'
                : insight.severity === 'success' ? 'var(--ui-success)'
                : 'var(--ui-info)';
            return (
              <div
                key={i}
                className="ui-panel p-2.5 text-xs space-y-1"
                style={{ borderLeft: `3px solid ${border}` }}
              >
                <h4 className="font-semibold" style={{ color: 'var(--ui-text)' }}>{insight.title}</h4>
                <p className="ui-t-secondary">{insight.message}</p>
                {insight.suggestion && <p className="ui-t-muted italic">{insight.suggestion}</p>}
              </div>
            );
          })
        ) : (
          <EmptyState message="Aucun insight généré" />
        )}
      </div>
    </section>
  );
}

export function ReportTab(props: {
  format: 'pdf' | 'docx';
  setFormat: (f: 'pdf' | 'docx') => void;
  onDownload: () => void;
  isGenerating: boolean;
  hasResults: boolean;
}) {
  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <FileText className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Export de rapport
        </span>
      </header>

      <div className="p-3 space-y-3">
        <div>
          <p className="ui-label mb-1.5">Format de sortie</p>
          <div className="flex gap-2">
            <button
              onClick={() => props.setFormat('pdf')}
              className={`ui-btn flex-1 justify-center text-xs ${props.format === 'pdf' ? 'ui-btn-primary' : ''}`}
            >
              PDF
            </button>
            <button
              onClick={() => props.setFormat('docx')}
              className={`ui-btn flex-1 justify-center text-xs ${props.format === 'docx' ? 'ui-btn-primary' : ''}`}
            >
              Word (DOCX)
            </button>
          </div>
        </div>

        <button
          onClick={props.onDownload}
          disabled={props.isGenerating || !props.hasResults}
          className="ui-btn ui-btn-primary ui-focusable w-full justify-center text-xs"
        >
          {props.isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération en cours…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" /> Télécharger le rapport {props.format.toUpperCase()}
            </>
          )}
        </button>

        {!props.hasResults && (
          <p className="text-xs ui-t-warning text-center">
            Exécutez d&apos;abord le pipeline pour générer un rapport.
          </p>
        )}
      </div>
    </section>
  );
}
