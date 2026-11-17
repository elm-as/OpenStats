import {
  CheckCircle2, CircleDashed, Loader2, XCircle, MinusCircle, Lock, Unlock, Timer,
} from 'lucide-react';
import { HelpTip } from '../ui/Tooltip';
import { factLabel, type CovariateScore, type ProbeInfo, type TraceStep } from './explorerTypes';

/** Le raisonnement en direct : quelle sonde tourne, et pourquoi elle s'est débloquée. */
export function ReasoningTrace({ trace, running }: { trace: TraceStep[]; running: boolean }) {
  if (trace.length === 0) {
    return (
      <p className="text-xs ui-t-faint py-6 text-center">
        {running ? 'Préparation du contexte…' : 'Le raisonnement s’affichera ici pendant la recherche.'}
      </p>
    );
  }

  return (
    <ol className="space-y-1.5">
      {trace.map((step, index) => {
        const { Icon, spin, color } = statusVisual(step.status);
        return (
          <li
            key={`${step.key}-${index}`}
            className="flex items-start gap-2.5 rounded-lg px-2.5 py-2"
            style={{ background: step.status === 'running' ? 'var(--ui-bg-raised)' : 'transparent' }}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${color} ${spin ? 'animate-spin' : ''}`} />

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold ui-t">{step.label}</span>
                {step.durationMs !== undefined && (
                  <span className="text-[10px] ui-t-faint ui-num">{step.durationMs} ms</span>
                )}
                {step.nFindings !== undefined && step.nFindings > 0 && (
                  <span className="text-[10px] font-semibold ui-t-success">
                    +{step.nFindings} découverte{step.nFindings > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {step.triggeredBy.length > 0 ? (
                <p className="text-[10px] ui-t-accent mt-0.5 flex items-center gap-1">
                  <Unlock className="w-2.5 h-2.5 shrink-0" />
                  débloquée par : {step.triggeredBy.map(factLabel).join(', ')}
                </p>
              ) : (
                <p className="text-[10px] ui-t-faint mt-0.5">{step.explains}</p>
              )}

              {step.error && <p className="text-[10px] ui-t-danger mt-0.5">{step.error}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function statusVisual(status: TraceStep['status']) {
  switch (status) {
    case 'running':
      return { Icon: Loader2, spin: true, color: 'ui-t-accent' };
    case 'success':
      return { Icon: CheckCircle2, spin: false, color: 'ui-t-success' };
    case 'empty':
      return { Icon: MinusCircle, spin: false, color: 'ui-t-faint' };
    case 'error':
      return { Icon: XCircle, spin: false, color: 'ui-t-danger' };
    default:
      return { Icon: CircleDashed, spin: false, color: 'ui-t-faint' };
  }
}

/** Classement des covariables : la réponse à « sur quoi je vais chercher ». */
export function CovariateRanking({ ranking }: { ranking: CovariateScore[] }) {
  if (ranking.length === 0) {
    return <p className="text-xs ui-t-faint">Choisissez une cible pour classer les variables.</p>;
  }

  return (
    <ul className="space-y-2">
      {ranking.slice(0, 10).map(item => (
        <li key={item.column} className="flex items-center gap-2.5">
          <span className="text-[11px] ui-mono ui-t-secondary break-all shrink-0 max-w-[160px]" title={item.column}>
            {item.column}
          </span>
          <span className="flex-1 h-1.5 rounded-sm overflow-hidden" style={{ background: 'var(--ui-bg-raised)' }}>
            <span
              className="block h-full bg-[var(--ui-accent)] transition-all duration-500"
              style={{ width: `${Math.max(2, Math.round(item.mutual_info * 100))}%` }}
            />
          </span>
          <span className="text-[10px] ui-t-muted ui-num w-9 text-right shrink-0">
            {item.mutual_info.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Le plan : ce qui est possible d'emblée, et ce qui attend un résultat. */
export function ProbePlan({ probes }: { probes: ProbeInfo[] }) {
  const admissible = probes.filter(p => p.admissible);
  const excluded = probes.filter(p => !p.admissible);

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {admissible.map(probe => (
          <li key={probe.key} className="flex items-start gap-2">
            {probe.gated ? (
              <Lock className="w-3 h-3 ui-t-warning shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-3 h-3 ui-t-success shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold ui-t-secondary leading-tight">{probe.label}</p>
              <p className="text-[10px] ui-t-faint leading-snug">
                {probe.gated
                  ? `attend : ${probe.triggered_by.map(factLabel).join(' ou ')}`
                  : probe.explains}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {excluded.length > 0 && (
        <details className="pt-1">
          <summary className="text-[10px] ui-t-faint cursor-pointer hover:ui-t-muted transition-colors">
            {excluded.length} sonde{excluded.length > 1 ? 's' : ''} sans objet sur ce dataset
          </summary>
          <ul className="mt-2 space-y-1 pl-1">
            {excluded.map(probe => (
              <li key={probe.key} className="text-[10px] ui-t-faint flex items-center gap-1.5">
                <MinusCircle className="w-2.5 h-2.5 shrink-0" />
                {probe.label}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Le panneau d'honnêteté : combien de fois on a regardé. */
export function HonestyPanel(props: {
  tested: number;
  surviving: number;
  descriptive: number;
  probesRun: number;
  probesAvailable: number;
  elapsed: number;
  budgetExhausted: boolean;
}) {
  return (
    <div
      className="ui-panel"
      style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13px] ui-t-secondary flex items-center gap-1.5 flex-wrap">
          <span>
            <span className="font-bold ui-t ui-num">{props.tested}</span> hypothèse
            {props.tested > 1 ? 's' : ''} testée{props.tested > 1 ? 's' : ''} sur{' '}
            <span className="font-bold ui-t ui-num">{props.probesRun}/{props.probesAvailable}</span> sondes —{' '}
            <span className="font-bold ui-t-success ui-num">{props.surviving}</span> retenue
            {props.surviving > 1 ? 's' : ''} (FDR 5 %)
            {props.descriptive > 0 && (
              <span className="ui-t-muted ui-num">, +{props.descriptive} descriptive{props.descriptive > 1 ? 's' : ''}</span>
            )}
            .
          </span>
          <HelpTip
            label="Contrôle FDR 5 %"
            content={
              'Correction de Benjamini-Hochberg appliquée à l’ensemble des tests exécutés durant la session.'
              + (props.budgetExhausted ? ' Le budget temps a été atteint avant la fin.' : '')
            }
          />
        </p>
        <span className="flex items-center gap-1.5 text-[11px] ui-t-muted ui-num shrink-0">
          <Timer className="w-3.5 h-3.5" />
          {props.elapsed.toFixed(1)} s
        </span>
      </div>
    </div>
  );
}
