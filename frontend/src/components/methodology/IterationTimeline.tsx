import { useState } from 'react';
import {
  ChevronRight, ArrowRight, CheckCircle2, XCircle, Undo2, TrendingDown, Ban,
} from 'lucide-react';
import type { AppliedRemedy, ColumnStats, CorrectionReport, Iteration } from './methodologyTypes';
import { issueLabel, STRUCTURAL_ACTIONS } from './methodologyTypes';

const METRIC_LABELS: Record<keyof ColumnStats, string> = {
  n: 'n', missing: 'manquants', mean: 'moyenne', std: 'écart-type',
  skew: 'asymétrie', outlier_ratio: 'extrêmes', rows: 'lignes', columns: 'colonnes',
};

const RATIO_METRICS = new Set(['missing', 'outlier_ratio']);

function formatMetric(key: string, value: number): string {
  if (RATIO_METRICS.has(key)) return `${(value * 100).toFixed(1)} %`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(3);
}

/** Comparatif chiffré avant/après pour les colonnes touchées par une correction. */
function BeforeAfter({ applied }: { applied: AppliedRemedy }) {
  const columns = Object.keys(applied.before ?? {});
  if (!columns.length) return null;

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-2)', marginTop: 6 }}>
      {columns.map(column => {
        const before = applied.before[column] ?? {};
        const after = applied.after?.[column] ?? {};
        const keys = (Object.keys(before) as (keyof ColumnStats)[])
          .filter(k => after[k] !== undefined && before[k] !== after[k]);
        if (!keys.length) return null;

        return (
          <div key={column}>
            <span className="ui-mono ui-t-muted">{column}</span>
            <div className="flex flex-wrap" style={{ gap: 'var(--ui-gap-3)', marginTop: 3 }}>
              {keys.map(key => {
                const from = before[key] as number;
                const to = after[key] as number;
                const improved = RATIO_METRICS.has(key) || key === 'skew'
                  ? Math.abs(to) < Math.abs(from)
                  : null;
                return (
                  <span key={key} className="flex items-center gap-1" style={{ fontSize: 'var(--ui-fs-xs)' }}>
                    <span className="ui-t-faint">{METRIC_LABELS[key] ?? key}</span>
                    <span className="ui-num ui-t-muted">{formatMetric(key, from)}</span>
                    <ArrowRight className="w-2.5 h-2.5" style={{ color: 'var(--ui-text-faint)' }} />
                    <span
                      className="ui-num"
                      style={{
                        fontWeight: 700,
                        color: improved === null ? 'var(--ui-text)'
                          : improved ? 'var(--ui-success)' : 'var(--ui-warning)',
                      }}
                    >
                      {formatMetric(key, to)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IterationBlock({ iteration }: { iteration: Iteration }) {
  const [open, setOpen] = useState(iteration.index === 1);
  const kept = iteration.kept;

  return (
    <li className="ui-panel overflow-hidden" style={{ opacity: kept ? 1 : 0.75 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="ui-focusable w-full flex items-center gap-2 text-left"
        style={{ padding: '7px var(--ui-pad-x)' }}
        aria-expanded={open}
      >
        <ChevronRight
          className="w-3 h-3 shrink-0"
          style={{
            color: 'var(--ui-text-faint)',
            transform: open ? 'rotate(90deg)' : undefined,
            transition: 'transform 0.12s',
          }}
        />
        <span className="ui-tag ui-tag-neutral shrink-0">Itération {iteration.index}</span>

        <span className="flex items-center gap-1.5 shrink-0 ui-num" style={{ fontSize: 'var(--ui-fs-sm)' }}>
          <span className="ui-t-muted">{iteration.severity_before.toFixed(2)}</span>
          <ArrowRight className="w-3 h-3" style={{ color: 'var(--ui-text-faint)' }} />
          <span style={{ fontWeight: 700, color: kept ? 'var(--ui-success)' : 'var(--ui-text-muted)' }}>
            {iteration.severity_after.toFixed(2)}
          </span>
        </span>

        {iteration.gain > 0 && (
          <span className="ui-tag ui-tag-success shrink-0">
            <TrendingDown className="w-2.5 h-2.5" />
            −{iteration.gain.toFixed(2)}
          </span>
        )}

        <span className="flex-1" />

        <span className="ui-t-muted shrink-0" style={{ fontSize: 'var(--ui-fs-xs)' }}>
          {iteration.applied.length} correction{iteration.applied.length > 1 ? 's' : ''}
          {iteration.resolved.length > 0 && ` · ${iteration.resolved.length} résolu${iteration.resolved.length > 1 ? 's' : ''}`}
        </span>

        {kept ? (
          <span className="ui-tag ui-tag-success shrink-0">retenue</span>
        ) : (
          <span className="ui-tag ui-tag-warning shrink-0" title="Aucun gain mesurable : ces corrections ont été annulées.">
            <Undo2 className="w-2.5 h-2.5" />
            annulée
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '0 var(--ui-pad-x) var(--ui-gap-3) 26px' }}>
          {!kept && (
            <p className="ui-t-warning" style={{ fontSize: 'var(--ui-fs-xs)', marginBottom: 8 }}>
              Ces corrections n’ont apporté aucun gain mesurable : elles ont été annulées
              et ne figurent pas dans le jeu de données final.
            </p>
          )}

          <ul className="flex flex-col" style={{ gap: 'var(--ui-gap-2)' }}>
            {iteration.applied.map((applied, index) => (
              <li key={`${applied.action}-${index}`}>
                <div className="flex items-start gap-2">
                  {applied.ok
                    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: kept ? 'var(--ui-success)' : 'var(--ui-text-faint)' }} />
                    : <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ui-danger)' }} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600 }}>{applied.label}</span>
                      {applied.aggressive && (
                        <span className="ui-tag ui-tag-warning" title="Modifie l’échelle ou la forme de la variable.">
                          transforme l’échelle
                        </span>
                      )}
                      {STRUCTURAL_ACTIONS.has(applied.action) && (
                        <span className="ui-tag ui-tag-neutral">structurel</span>
                      )}
                    </div>
                    <p className="ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)', marginTop: 1 }}>
                      {applied.rationale || applied.message}
                    </p>
                    {applied.ok && kept && <BeforeAfter applied={applied} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

export default function IterationTimeline({ report }: { report: CorrectionReport }) {
  const kept = report.iterations.filter(i => i.kept).length;

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-2)' }}>
      {/* Bilan de la boucle */}
      <div className="ui-panel" style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}>
        <div className="flex items-center flex-wrap" style={{ gap: 'var(--ui-gap-3)' }}>
          <Metric label="Gravité initiale" value={report.initial.severity_total.toFixed(2)} />
          <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--ui-text-faint)' }} />
          <Metric label="Gravité finale" value={report.final.severity_total.toFixed(2)} tone="success" />
          <span className="ui-sep" aria-hidden />
          <Metric label="Problèmes" value={`${report.initial.count} → ${report.final.count}`} />
          <Metric label="Itérations retenues" value={`${kept}/${report.iterations.length}`} />
          <Metric
            label="Dimensions"
            value={`${report.shape_before.rows}×${report.shape_before.columns} → ${report.shape_after.rows}×${report.shape_after.columns}`}
          />
          <span className="flex-1" />
          <span className={`ui-tag ${report.ready_for_modeling ? 'ui-tag-success' : 'ui-tag-warning'}`}>
            {report.ready_for_modeling ? 'prêt pour la modélisation' : 'problèmes bloquants restants'}
          </span>
        </div>

        <p className="ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)', marginTop: 6 }}>
          Arrêt de la boucle : {report.stop_reason}.
          {report.columns_removed.length > 0 && (
            <> Colonnes retirées : <span className="ui-mono">{report.columns_removed.join(', ')}</span>.</>
          )}
        </p>
      </div>

      <ol className="flex flex-col" style={{ gap: 'var(--ui-gap-1)' }}>
        {report.iterations.map(iteration => (
          <IterationBlock key={iteration.index} iteration={iteration} />
        ))}
      </ol>

      {report.remaining_issues.length > 0 && (
        <div className="ui-panel overflow-hidden">
          <header className="ui-panel-header">
            <span>Problèmes non résolus</span>
            <span className="ui-num">{report.remaining_issues.length}</span>
          </header>
          <ul style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}>
            {report.remaining_issues.map(issue => (
              <li key={issue.key} className="flex items-start gap-2" style={{ marginBottom: 6 }}>
                <Ban className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--ui-warning)' }} />
                <div className="min-w-0">
                  <span style={{ fontSize: 'var(--ui-fs-sm)' }}>{issue.title}</span>
                  <span className="ui-tag ui-tag-neutral" style={{ marginLeft: 6 }}>
                    {issueLabel(issue.code)}
                  </span>
                  {issue.blocks_modeling && (
                    <span className="ui-tag ui-tag-warning" style={{ marginLeft: 4 }}>bloquant</span>
                  )}
                  <p className="ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)', marginTop: 1 }}>
                    {issue.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <span className="flex flex-col">
      <span className="ui-label" style={{ fontSize: '9.5px' }}>{label}</span>
      <span
        className="ui-num"
        style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700,
                 color: tone === 'success' ? 'var(--ui-success)' : 'var(--ui-text)' }}
      >
        {value}
      </span>
    </span>
  );
}
