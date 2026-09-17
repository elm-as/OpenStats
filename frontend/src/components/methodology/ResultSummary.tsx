import { ArrowRight, Target, Layers, Timer, ShieldCheck, ShieldAlert, Gauge } from 'lucide-react';
import type { CorrectionReport, Stage } from './methodologyTypes';

interface Props {
  stages: Stage[];
  elapsed: number;
}

const PROBLEM_LABELS: Record<string, string> = {
  regression: 'Régression',
  forecast: 'Prévision temporelle',
  classification_binaire: 'Classification binaire',
  classification_multiclasse: 'Classification multiclasse',
  exploration: 'Exploration',
};

/**
 * Bandeau de synthese : ce qu'il faut retenir avant d'entrer dans le detail.
 *
 * Une analyse en onze etapes produit beaucoup de tableaux ; sans ce resume,
 * l'essentiel — la cible, la qualite obtenue, la performance — se perd.
 */
export default function ResultSummary({ stages, elapsed }: Props) {
  const byKey = new Map(stages.map(stage => [stage.key, stage]));
  const problem = byKey.get('problem');
  const correction = byKey.get('correction')?.data as unknown as CorrectionReport | undefined;
  const modeling = byKey.get('modeling');
  const validation = byKey.get('validation');

  const target = (problem?.data?.target as string | null) ?? null;
  const problemType = (problem?.data?.problem_type as string) ?? 'exploration';
  const score = modeling?.data?.score as number | undefined;
  const bestModel = modeling?.data?.best as string | undefined;
  const metric = modeling?.data?.metric as string | undefined;
  // La prevision est jugee sur le gain face a la persistance, pas sur un R².
  const isSkill = metric === 'MAE';
  const healthy = Boolean(validation?.data?.healthy);

  const severityBefore = correction?.initial.severity_total ?? 0;
  const severityAfter = correction?.final.severity_total ?? 0;
  const issuesBefore = correction?.initial.count ?? 0;
  const issuesAfter = correction?.final.count ?? 0;
  const progress = severityBefore > 0
    ? Math.max(0, Math.min(1, 1 - severityAfter / severityBefore))
    : 0;

  return (
    <section
      className="ui-panel overflow-hidden"
      style={{ borderColor: healthy ? 'var(--ui-success)' : 'var(--ui-border-strong)' }}
    >
      <div
        className="flex items-stretch flex-wrap"
        style={{ gap: 0, borderBottom: correction ? '1px solid var(--ui-border)' : undefined }}
      >
        <Cell icon={Target} label="Variable expliquée"
              value={target ?? 'Aucune'} hint={PROBLEM_LABELS[problemType] ?? problemType} />

        {correction && (
          <Cell
            icon={Gauge}
            label="Qualité des données"
            value={`${severityBefore.toFixed(2)} → ${severityAfter.toFixed(2)}`}
            hint={`${issuesBefore} problème${issuesBefore > 1 ? 's' : ''} → ${issuesAfter}`}
            tone={severityAfter < severityBefore ? 'success' : undefined}
          />
        )}

        {score !== undefined && (
          <Cell
            icon={Layers}
            label={isSkill ? 'Gain vs persistance'
              : problemType === 'regression' ? 'R² hors échantillon'
              : 'Exactitude équilibrée'}
            value={isSkill ? `${(score * 100).toFixed(0)} %` : score.toFixed(3)}
            hint={bestModel ?? ''}
            tone={score > 0.6 ? 'success' : score > 0.3 ? undefined : 'warning'}
          />
        )}

        <Cell icon={Timer} label="Durée" value={`${elapsed.toFixed(1)} s`}
              hint={`${stages.length} étapes`} />

        <div
          className="flex items-center gap-2 px-4"
          style={{ borderLeft: '1px solid var(--ui-border)', minWidth: 200, flex: 1 }}
        >
          {healthy
            ? <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: 'var(--ui-success)' }} />
            : <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: 'var(--ui-warning)' }} />}
          <span style={{ fontSize: 'var(--ui-fs-sm)', lineHeight: 1.45 }}>
            {healthy
              ? 'Aucun problème bloquant : les résultats sont interprétables.'
              : 'Des problèmes subsistent — interpréter avec prudence.'}
          </span>
        </div>
      </div>

      {/* Barre de progression de la correction : lecture immédiate du gain. */}
      {correction && severityBefore > 0 && (
        <div style={{ padding: '8px var(--ui-pad-x)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <span className="ui-label">Problèmes résolus par la boucle</span>
            <span className="ui-num ui-t-muted" style={{ fontSize: 'var(--ui-fs-xs)' }}>
              {Math.round(progress * 100)} %
              {correction.columns_removed.length > 0 && (
                <> · {correction.columns_removed.length} colonne
                  {correction.columns_removed.length > 1 ? 's' : ''} retirée
                  {correction.columns_removed.length > 1 ? 's' : ''}</>
              )}
            </span>
          </div>
          <div
            style={{ height: 4, borderRadius: 2, background: 'var(--ui-bg-raised)', overflow: 'hidden' }}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              background: 'var(--ui-success)', transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}
    </section>
  );
}

function Cell({
  icon: Icon, label, value, hint, tone,
}: {
  icon: typeof Target; label: string; value: string; hint?: string;
  tone?: 'success' | 'warning';
}) {
  const color = tone === 'success' ? 'var(--ui-success)'
    : tone === 'warning' ? 'var(--ui-warning)' : 'var(--ui-text)';

  return (
    <div
      className="flex items-start gap-2 px-4 py-2.5"
      style={{ borderLeft: '1px solid var(--ui-border)', minWidth: 168 }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ui-text-faint)', marginTop: 3 }} />
      <div className="min-w-0">
        <div className="ui-label" style={{ fontSize: '9.5px' }}>{label}</div>
        <div className="ui-num truncate" style={{ fontSize: 'var(--ui-fs-lg)', fontWeight: 700, color }}
             title={value}>
          {value}
        </div>
        {hint && (
          <div className="ui-t-faint truncate" style={{ fontSize: 'var(--ui-fs-xs)' }} title={hint}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
