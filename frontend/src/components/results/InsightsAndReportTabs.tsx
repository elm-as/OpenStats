import React from 'react';
import { Sparkles, Info, Activity, FileText, Download } from 'lucide-react';
import { EmptyState } from './ResultAtoms';
import type { ShapResult, InsightsResult } from './ResultsWizardTypes';

export function ShapTab({ result }: { result?: ShapResult }) {
  if (!result) return <EmptyState message="Pas de résultats SHAP disponibles" />;

  if (result.note) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-surface-50 mb-2">Explicabilité SHAP</h3>
            <p className="text-surface-300">{result.note}</p>
            <p className="text-sm text-surface-400 mt-2">
              Utilisez l'onglet "Modélisation" puis l'option SHAP pour générer les explications.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const importance = result.global_importance || [];
  const waterfall = result.waterfall_example || [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-400" />
          Importance des variables (SHAP)
        </h3>

        {importance.length > 0 ? (
          <div className="space-y-2">
            {importance.map((imp: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-surface-300 w-32 truncate">{imp.feature}</span>
                <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-500 rounded-full"
                    style={{
                      width: `${Math.min((imp.mean_shap / importance[0].mean_shap) * 100, 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-mono text-pink-300 w-20 text-right">
                  {imp.mean_shap.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucune importance SHAP disponible" />
        )}

        {waterfall.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-surface-300 mb-3">Exemple local (waterfall)</h4>
            <div className="space-y-2">
              {waterfall.slice(0, 10).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm text-surface-300 w-32 truncate">{item.feature}</span>
                  <div className="flex-1 h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.shap_value >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(Math.abs(item.shap_value) * 100, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-mono w-20 text-right ${
                      item.shap_value >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {item.shap_value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function InsightsTab({ result }: { result?: InsightsResult }) {
  if (!result) return <EmptyState message="Pas d'insights disponibles" />;

  if ((result as any).note) {
    return (
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-surface-50 mb-2">Insights IA</h3>
            <p className="text-surface-300">{(result as any).note}</p>
          </div>
        </div>
      </div>
    );
  }

  const insights = result.insights || [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4">
        <h3 className="text-lg font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-400" />
          Insights générés
        </h3>

        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${
                  insight.severity === 'critical'
                    ? 'bg-red-500/10 border-red-500/30'
                    : insight.severity === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : insight.severity === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <h4 className="text-sm font-medium text-surface-200">{insight.title}</h4>
                <p className="text-sm text-surface-300 mt-1">{insight.message}</p>
                {insight.suggestion && (
                  <p className="text-xs text-surface-400 mt-2">{insight.suggestion}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Aucun insight généré" />
        )}
      </div>
    </div>
  );
}

export function ReportTab({
  format,
  setFormat,
  onDownload,
  isGenerating,
  hasResults,
}: {
  format: 'pdf' | 'docx';
  setFormat: (f: 'pdf' | 'docx') => void;
  onDownload: () => void;
  isGenerating: boolean;
  hasResults: boolean;
}) {
  return (
    <div className="card overflow-hidden !p-0">
      <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-orange-500/[0.08] to-red-500/[0.04]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-400/20 blur-lg rounded-full" />
            <FileText className="w-5 h-5 text-orange-400 relative z-10" />
          </div>
          <h3 className="text-sm font-bold text-strong">Génération de rapport professionnel</h3>
        </div>
        <p className="text-xs text-muted mt-1.5">
          Téléchargez un rapport complet au format PDF ou Word avec tous les résultats, graphiques et insights.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
            Format de sortie
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFormat('pdf')}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                format === 'pdf'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-default'
              }`}
            >
              PDF
            </button>
            <button
              onClick={() => setFormat('docx')}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                format === 'docx'
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-muted hover:bg-white/10 hover:text-default'
              }`}
            >
              Word (DOCX)
            </button>
          </div>
        </div>

        <button
          onClick={onDownload}
          disabled={isGenerating || !hasResults}
          className="btn-primary w-full text-sm py-3"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              Génération en cours...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Télécharger le rapport {format.toUpperCase()}
            </>
          )}
        </button>

        {!hasResults && (
          <p className="text-xs text-amber-400 text-center">
            Exécutez d'abord le pipeline pour générer un rapport
          </p>
        )}
      </div>
    </div>
  );
}
