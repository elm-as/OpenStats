import React from 'react';
import {
  BarChart2,
  AlertCircle,
  FileText,
  Download,
  CheckCircle2,
  Database,
  Layers,
  Activity,
  Zap,
  Hash,
} from 'lucide-react';
import { Section, SummaryStrip, DataTable, RenderJson } from './ResultAtoms';
import { ChartRenderer } from '../../chartBuilder/ChartRenderers';

export const VisualizationResultView = ({ resultData }: { resultData: any }) => {
  if (resultData.data && resultData.chart_type) {
    const metaItems = [
      { label: 'Type', value: resultData.chart_type },
      ...(resultData.x_col ? [{ label: 'Axe X', value: resultData.x_col }] : []),
      ...(resultData.y_col ? [{ label: 'Axe Y', value: resultData.y_col }] : []),
      ...(resultData.color_col ? [{ label: 'Couleur', value: resultData.color_col }] : []),
    ];
    return (
      <Section title="Graphique généré" icon={BarChart2} color="#8b5cf6">
        <div className="ui-panel p-1 overflow-hidden">
          <ChartRenderer
            data={resultData}
            chartType={resultData.chart_type as any}
            yCols={resultData.series || (resultData.y_col ? [resultData.y_col] : [])}
          />
        </div>
        <div className="mt-3">
          <SummaryStrip items={metaItems} />
        </div>
      </Section>
    );
  }
  return (
    <Section title="Configuration du graphique" icon={BarChart2} color="#8b5cf6">
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 text-sm text-amber-200">
        <AlertCircle className="text-amber-400 shrink-0" size={18} />
        <p>Le nœud n'a pas renvoyé de données graphiques. Vérifiez la configuration de vos colonnes.</p>
      </div>
    </Section>
  );
};

export const OutputReportResultView = ({ resultData }: { resultData: any }) => {
  const format = (resultData.format || 'pdf').toLowerCase();
  const fmtUpper = format.toUpperCase();
  const dsId = resultData.dataset_id;
  const downloadUrl = resultData.download_url;
  const filename =
    resultData.filename || `rapport_${resultData.dataset_id || 'export'}.${format}`;

  return (
    <Section title={`Export / Rapport généré (${fmtUpper})`} icon={FileText} color="#ef4444">
      <div className="ui-panel p-4 space-y-3">
        <SummaryStrip
          items={[
            { label: 'Format', value: fmtUpper },
            { label: 'Statut', value: 'Prêt au téléchargement', tone: 'success' },
          ]}
        />
        {downloadUrl ? (
          <div className="pt-2 flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/[0.06]">
            <div>
              <p className="text-xs font-bold text-surface-100">{filename}</p>
              <p className="text-[10px] text-surface-400 mt-0.5">
                Le fichier de rapport est disponible pour consultation et archivage.
              </p>
            </div>
            <a
              href={downloadUrl}
              download={filename}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-surface-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
            >
              <Download size={14} /> Télécharger
            </a>
          </div>
        ) : dsId ? (
          <div className="text-center pt-2">
            <a
              href={`${import.meta.env.VITE_API_URL || ''}/api/v1/datasets/${dsId}/report/professional/${format}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Download size={18} />
              Télécharger le rapport
            </a>
          </div>
        ) : null}
      </div>
    </Section>
  );
};

export const SimulationResultView = ({ resultData }: { resultData: any }) => {
  const simType = resultData.simulation_type || 'Simulation';
  const mean = resultData.mean_outcome ?? resultData.mean;
  const std = resultData.std_outcome ?? resultData.std;
  const var95 = resultData.var_95 ?? resultData.VaR;
  const quantiles = resultData.quantiles || {};

  const simItems = [
    ...(mean !== undefined ? [{ label: 'Moyenne estimée', value: mean }] : []),
    ...(std !== undefined ? [{ label: 'Écart-type', value: std }] : []),
    ...(var95 !== undefined ? [{ label: 'VaR (95%)', value: var95 }] : []),
    ...(resultData.n_simulations ? [{ label: 'Simulations', value: resultData.n_simulations }] : []),
  ];

  return (
    <div className="space-y-4">
      <Section title={`Résultat de Simulation (${simType})`} icon={Zap} color="#ec4899">
        {simItems.length > 0 && <SummaryStrip items={simItems} />}
      </Section>

      {quantiles && typeof quantiles === 'object' && Object.keys(quantiles).length > 0 && (
        <Section title="Distribution des quantiles" icon={BarChart2} color="#ec4899">
          <DataTable
            headers={['Quantile', 'Valeur estimée']}
            rows={Object.entries(quantiles).map(([q, v]) => [q, v])}
          />
        </Section>
      )}
    </div>
  );
};

export const ScriptAndCustomResultView = ({
  nodeType,
  resultData,
}: {
  nodeType: string;
  resultData: any;
}) => {
  if (nodeType === 'ai') {
    const analysis =
      resultData.synthesis || resultData.analysis || resultData.content || resultData.message;
    return (
      <Section title="Analyse IA et Recommandations" icon={Zap} color="#8b5cf6">
        <div className="bg-surface-800/40 rounded-xl p-5 border border-white/[0.04] space-y-4">
          {analysis && (
            <div className="text-xs text-surface-200 leading-relaxed whitespace-pre-wrap font-sans">
              {analysis}
            </div>
          )}
        </div>
      </Section>
    );
  }

  if (nodeType === 'extension') {
    return (
      <Section title="Exécution de l'Extension" icon={Activity} color="#10b981">
        <div className="ui-panel p-4 space-y-3">
          <SummaryStrip
            items={[
              { label: 'Extension', value: resultData.name || 'Custom Extension' },
              { label: 'Statut', value: resultData.status || 'OK', tone: 'success' },
            ]}
          />
          {resultData.stdout && (
            <div className="bg-black/40 p-3 rounded-lg border border-white/[0.06]">
              <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider mb-1">
                Sortie Console (stdout)
              </div>
              <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all">
                {resultData.stdout}
              </pre>
            </div>
          )}
        </div>
      </Section>
    );
  }

  if (nodeType === 'sql' || nodeType === 'python') {
    const isSql = nodeType === 'sql';
    return (
      <Section
        title={isSql ? 'Résultat de la requête SQL (DuckDB)' : 'Résultat du script Python'}
        icon={isSql ? Database : Activity}
        color={isSql ? '#3b82f6' : '#10b981'}
      >
        <div className="ui-panel p-4 space-y-3">
          <SummaryStrip
            items={[
              { label: 'Lignes générées', value: resultData.rows ?? 0 },
              { label: 'Colonnes', value: resultData.columns ?? 0 },
            ]}
          />
          {(resultData.query || resultData.code) && (
            <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
              <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider mb-1">
                {isSql ? 'Requête exécutée' : 'Code exécuté'}
              </div>
              <pre
                className={`text-xs font-mono ${
                  isSql ? 'text-accent-300' : 'text-amber-300'
                } whitespace-pre-wrap break-all`}
              >
                {resultData.query || resultData.code}
              </pre>
            </div>
          )}
          {Array.isArray(resultData.head) && resultData.head.length > 0 && (() => {
            const cols = Object.keys(resultData.head[0]);
            return (
              <Section
                title={`Aperçu (.head ${resultData.head.length} lignes)`}
                icon={Database}
                color={isSql ? '#3b82f6' : '#10b981'}
              >
                <DataTable headers={cols} rows={resultData.head.map((r: any) => cols.map(c => r[c]))} />
              </Section>
            );
          })()}
        </div>
      </Section>
    );
  }

  return null;
};
