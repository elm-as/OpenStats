import React from 'react';
import { Filter, BarChart3, CheckCircle2, Zap } from 'lucide-react';
import { EmptyState, SummaryCell, TypeBadge, formatNumber } from './ResultAtoms';

export function CleaningTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de résultats de nettoyage disponibles" />;

  const actions = result.actions || [];
  const duplicatesAction = actions.find((a: any) => a.action === 'remove_duplicates');
  const imputeAction = actions.find((a: any) => a.action === 'impute_missing');
  const dropMissingAction = actions.find((a: any) => a.action === 'drop_high_missing_cols');
  const dropConstantAction = actions.find((a: any) => a.action === 'drop_constant_cols');

  const duplicatesRemoved = duplicatesAction?.removed ?? result.duplicates_removed ?? 0;
  const missingImputed = imputeAction?.n_imputed ?? result.missing_imputed ?? 0;
  const columnsDropped =
    (dropMissingAction?.dropped?.length || 0) + (dropConstantAction?.dropped?.length || 0);

  const beforeRows = result.before_rows ?? result.shape_before?.rows;
  const afterRows = result.after_rows ?? result.shape_after?.rows;
  const beforeCols = result.before_cols ?? result.shape_before?.columns;
  const afterCols = result.after_cols ?? result.shape_after?.columns;

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
            <Filter className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            Nettoyage des données
          </span>
          {(beforeRows !== undefined || beforeCols !== undefined) && (
            <span className="ui-num text-xs ui-t-muted">
              {beforeRows}×{beforeCols} → <strong style={{ color: 'var(--ui-success)' }}>{afterRows}×{afterCols}</strong>
            </span>
          )}
        </header>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ui-num">
            <SummaryCell label="Doublons supprimés" value={duplicatesRemoved} />
            <SummaryCell label="Valeurs imputées" value={missingImputed} />
            <SummaryCell label="Colonnes supprimées" value={columnsDropped} />
            <SummaryCell label="Lignes retirées" value={(beforeRows || 0) - (afterRows || 0)} tone="success" />
          </div>

          {actions.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto ui-scroll">
              {actions.map((action: any, i: number) => (
                <div
                  key={i}
                  className="text-xs ui-t-secondary flex items-start gap-2 px-2.5 py-1.5 rounded-[var(--ui-radius-sm)]"
                  style={{ background: 'var(--ui-bg-sunken)' }}
                >
                  <span className="ui-mono ui-t-faint">[{action.action}]</span>
                  <span className="truncate">{JSON.stringify(action)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function DescriptiveTab({ result }: { result?: any }) {
  if (!result) return <EmptyState message="Pas de statistiques descriptives disponibles" />;

  const stats = (result.statistics || result.stats || result || {}) as Record<string, any>;
  const columns = Object.keys(stats);

  if (columns.length === 0) {
    return (
      <div className="ui-panel p-4">
        <EmptyState message="Aucune statistique disponible" />
      </div>
    );
  }

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--ui-success)' }} />
          Statistiques descriptives
        </span>
        <span className="ui-tag ui-num">{columns.length}</span>
      </header>

      <div className="overflow-x-auto">
        <table className="ui-table w-full text-xs">
          <thead>
            <tr>
              <th className="text-left">Variable</th>
              <th className="text-left">Type</th>
              <th className="ui-th-num">N</th>
              <th className="ui-th-num">Moyenne</th>
              <th className="ui-th-num" title="Erreur-type de la moyenne (s / √n)">SE</th>
              <th className="ui-th-num" title="Intervalle de confiance à 95 %">IC 95 %</th>
              <th className="ui-th-num">Médiane</th>
              <th className="ui-th-num">Écart-type</th>
              <th className="ui-th-num">Min</th>
              <th className="ui-th-num">Max</th>
              <th className="ui-th-num">Manquants</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(col => {
              const s = stats[col] || {};
              const missingRate = s.null_rate || s.missing_rate || 0;
              return (
                <tr key={col}>
                  <td className="font-semibold" style={{ color: 'var(--ui-text)' }}>{col}</td>
                  <td><TypeBadge type={s.type || 'numeric'} /></td>
                  <td className="ui-td-num">{s.count ?? s.n ?? '—'}</td>
                  <td className="ui-td-num font-semibold">{formatNumber(s.mean)}</td>
                  <td className="ui-td-num ui-t-accent">
                    {s.std_error != null ? formatNumber(s.std_error) : '—'}
                  </td>
                  <td className="ui-td-num ui-t-muted">
                    {s.ci_95 ? `[${formatNumber(s.ci_95.lower)}, ${formatNumber(s.ci_95.upper)}]` : '—'}
                  </td>
                  <td className="ui-td-num">{formatNumber(s.median)}</td>
                  <td className="ui-td-num">{formatNumber(s.std)}</td>
                  <td className="ui-td-num ui-t-muted">{formatNumber(s.min)}</td>
                  <td className="ui-td-num ui-t-muted">{formatNumber(s.max)}</td>
                  <td className="ui-td-num" style={{ color: missingRate > 0.1 ? 'var(--ui-danger)' : undefined }}>
                    {(missingRate * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TransformsTab(props: { recommendations?: any; applied?: any }) {
  const recs = props.recommendations?.recommendations || props.recommendations || [];
  const logs = props.applied?.logs || (Array.isArray(props.applied) ? props.applied : []);

  return (
    <div className="space-y-3">
      {logs.length > 0 && (
        <section className="ui-panel overflow-hidden">
          <header className="ui-panel-header">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ui-success)' }} />
              Transformations appliquées ({logs.length})
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left">Variable</th>
                  <th className="text-left">Transformation</th>
                  <th className="ui-th-num">Moyenne avant → après</th>
                  <th className="ui-th-num">Écart-type avant → après</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => (
                  <tr key={i}>
                    <td className="ui-mono font-semibold">{log.column}</td>
                    <td style={{ color: 'var(--ui-success)' }}>
                      {log.label || log.transform}
                      {log.new_column && log.new_column !== log.column ? ` (${log.new_column})` : ''}
                    </td>
                    <td className="ui-td-num">
                      {log.before && log.after
                        ? `${log.before.mean?.toFixed(2)} → ${log.after.mean?.toFixed(2)}`
                        : '—'}
                    </td>
                    <td className="ui-td-num">
                      {log.before && log.after
                        ? `${log.before.std?.toFixed(2)} → ${log.after.std?.toFixed(2)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--ui-warning)' }} />
            Recommandations de transformation
          </span>
        </header>
        {recs.length > 0 ? (
          <div className="p-2.5 space-y-1.5">
            {recs.map((rec: any, i: number) => (
              <div key={i} className="ui-panel px-2.5 py-2 flex items-center gap-2 text-xs" style={{ background: 'var(--ui-bg-sunken)' }}>
                <span className="ui-mono font-semibold">{rec.column}</span>
                <span className="ui-t-warning">→</span>
                <span>{rec.recommended_transform}</span>
                <span className="ui-t-muted flex-1">{rec.rationale}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            message={
              logs.length > 0
                ? 'Aucune transformation supplémentaire recommandée'
                : 'Aucune recommandation de transformation'
            }
          />
        )}
      </section>
    </div>
  );
}
