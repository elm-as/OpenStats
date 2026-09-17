import { useEffect, useMemo, useState } from 'react';
import { Play, Square, Sparkles, RotateCcw, AlertCircle, Search } from 'lucide-react';
import FindingCard from './FindingCard';
import { CovariateRanking, HonestyPanel, ProbePlan, ReasoningTrace } from './ExplorerTrace';
import { factLabel } from './explorerTypes';
import { useExplorer } from './useExplorer';
import { useStatus } from '../shell/StatusBar';

const BUDGETS = [
  { value: 20, label: 'Rapide' },
  { value: 45, label: 'Standard' },
  { value: 120, label: 'Approfondi' },
];

interface Props {
  datasetId: string;
  datasetName?: string;
}

export default function ExplorerPanel({ datasetId, datasetName }: Props) {
  const {
    capabilities, loadingCapabilities, target, setTarget,
    running, trace, findings, facts, result, error, elapsed, run, stop, reset,
  } = useExplorer(datasetId);

  const [budget, setBudget] = useState(45);
  const { setStatus } = useStatus();

  const columns = useMemo(() => {
    if (!capabilities) return [];
    return [...capabilities.columns.numeric, ...capabilities.columns.categorical];
  }, [capabilities]);

  const started = trace.length > 0 || Boolean(result);

  // Le châssis affiche l'état de la recherche dans la barre de statut.
  useEffect(() => {
    if (running) {
      const current = trace[trace.length - 1];
      setStatus({
        busy: true,
        message: current ? `Sonde : ${current.label}` : 'Préparation du contexte',
        items: [
          { id: 'probes', label: `${trace.length} sondes` },
          { id: 'found', label: `${findings.length} trouvailles`, tone: 'accent' },
          { id: 'time', label: `${elapsed.toFixed(1)} s` },
        ],
      });
    } else if (result) {
      setStatus({
        busy: false,
        message: null,
        items: [
          { id: 'probes', label: `${result.summary.probes_run}/${result.summary.probes_available} sondes` },
          { id: 'tested', label: `${result.summary.hypotheses_tested} testées` },
          { id: 'fdr', label: `${result.summary.surviving_fdr} retenues`, tone: 'success' },
          { id: 'time', label: `${result.elapsed_sec.toFixed(1)} s` },
        ],
      });
    } else {
      setStatus({ busy: false, message: null, items: [] });
    }
  }, [running, trace, findings.length, result, elapsed, setStatus]);

  useEffect(() => () => setStatus({ busy: false, message: null, items: [] }), [setStatus]);

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-3)' }}>
      {/* ── Barre d'outils de l'écran ── */}
      <div
        className="ui-panel flex items-center flex-wrap"
        style={{ gap: 'var(--ui-gap-3)', padding: '0 var(--ui-pad-x)', minHeight: 46 }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          <span style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700 }}>Explorateur</span>
        </div>

        <span className="ui-sep" aria-hidden />

        <label className="flex items-center gap-2">
          <span className="ui-label">Cible</span>
          <select
            value={target ?? ''}
            onChange={e => { setTarget(e.target.value || null); reset(); }}
            disabled={running || loadingCapabilities}
            className="ui-select ui-focusable"
            style={{ minWidth: 180 }}
          >
            <option value="">Sans cible (exploration libre)</option>
            {columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="ui-label">Budget</span>
          <div
            className="flex rounded-[var(--ui-radius-sm)] overflow-hidden"
            style={{ border: '1px solid var(--ui-border)' }}
          >
            {BUDGETS.map(option => (
              <button
                key={option.value}
                onClick={() => setBudget(option.value)}
                disabled={running}
                className="ui-focusable px-2.5"
                style={{
                  height: 'calc(var(--ui-control-h) - 2px)',
                  fontSize: 'var(--ui-fs-xs)',
                  fontWeight: 700,
                  background: budget === option.value ? 'var(--ui-accent-soft)' : 'transparent',
                  color: budget === option.value ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </label>

        <div className="flex-1" />

        {started && !running && (
          <button onClick={reset} className="ui-btn ui-btn-ghost ui-focusable" title="Effacer la session">
            <RotateCcw className="w-3 h-3" />
            Effacer
          </button>
        )}

        {running ? (
          <button onClick={stop} className="ui-btn ui-focusable">
            <Square className="w-3 h-3" />
            Arrêter
          </button>
        ) : (
          <button onClick={() => run(budget)} className="ui-btn ui-btn-primary ui-focusable">
            <Play className="w-3 h-3" />
            {started ? 'Relancer' : 'Explorer'}
          </button>
        )}
      </div>

      {/* ── Faits établis : l'état de connaissance du moteur ── */}
      {facts.length > 0 && (
        <div
          className="ui-panel flex items-center flex-wrap gap-1.5"
          style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}
        >
          <span className="ui-label shrink-0" style={{ marginRight: 4 }}>Ce que je sais</span>
          {facts.map(fact => (
            <span key={fact} className="ui-tag ui-tag-accent">{factLabel(fact)}</span>
          ))}
        </div>
      )}

      {error && (
        <div
          className="ui-panel flex items-start gap-2"
          style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)', borderColor: 'var(--ui-danger)' }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ui-danger)' }} />
          <p style={{ fontSize: 'var(--ui-fs-sm)', color: 'var(--ui-danger)' }}>{error}</p>
        </div>
      )}

      {/* ── Corps ── */}
      <div
        className="grid items-start"
        style={{ gap: 'var(--ui-gap-3)', gridTemplateColumns: 'minmax(0, 1fr) 316px' }}
      >
        <div className="flex flex-col min-w-0" style={{ gap: 'var(--ui-gap-2)' }}>
          {result && (
            <HonestyPanel
              tested={result.summary.hypotheses_tested}
              surviving={result.summary.surviving_fdr}
              descriptive={result.summary.descriptive_findings}
              probesRun={result.summary.probes_run}
              probesAvailable={result.summary.probes_available}
              elapsed={result.elapsed_sec}
              budgetExhausted={result.budget_exhausted}
            />
          )}

          {findings.length > 0 ? (
            <>
              <div className="flex items-center justify-between" style={{ padding: '2px 2px 0' }}>
                <span className="ui-label">
                  {result ? 'Découvertes, classées par intérêt' : 'Découvertes en cours'}
                </span>
                <span className="ui-num ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
                  {findings.length}
                </span>
              </div>
              <div className="flex flex-col" style={{ gap: 'var(--ui-gap-1)' }}>
                {findings.map((finding, index) => (
                  <FindingCard
                    key={`${finding.probe}-${finding.kind}-${finding.variables.join('-')}-${index}`}
                    finding={finding}
                    rank={index + 1}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              className="ui-panel flex flex-col items-center justify-center text-center"
              style={{ minHeight: 260, padding: 'var(--ui-gap-5)' }}
            >
              {running ? (
                <>
                  <div
                    className="w-5 h-5 rounded-full animate-spin mb-3"
                    style={{ border: '2px solid var(--ui-border)', borderTopColor: 'var(--ui-accent)' }}
                  />
                  <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)' }}>Analyse en cours…</p>
                </>
              ) : (
                <>
                  <Search className="w-6 h-6 mb-2.5" style={{ color: 'var(--ui-text-faint)' }} />
                  <p style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700, marginBottom: 4 }}>
                    {started ? 'Aucune découverte retenue' : 'Prêt à explorer'}
                  </p>
                  <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)', maxWidth: 420, lineHeight: 1.6 }}>
                    {started
                      ? 'Les sondes applicables ont toutes été exécutées sans rien trouver qui dépasse le seuil d’intérêt. C’est un résultat en soi : le signal recherché n’est pas dans ces colonnes.'
                      : `Choisissez une cible dans ${datasetName ?? 'ce dataset'}, puis lancez la recherche. Chaque analyse en déclenche d’autres selon ce qu’elle trouve.`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Colonne d'inspection ── */}
        <aside className="flex flex-col" style={{ gap: 'var(--ui-gap-2)', position: 'sticky', top: 0 }}>
          <Panel title="Raisonnement" badge={trace.length ? `${trace.length}` : undefined}>
            <ReasoningTrace trace={trace} running={running} />
          </Panel>

          <Panel title="Variables informatives" badge="IM">
            <CovariateRanking ranking={result?.covariate_ranking ?? capabilities?.covariate_ranking ?? []} />
          </Panel>

          {capabilities && (
            <Panel title="Plan d’analyse" badge={`${capabilities.n_admissible}/${capabilities.probes.length}`}>
              <ProbePlan probes={capabilities.probes} />
            </Panel>
          )}

          {result && result.notes.length > 0 && (
            <Panel title="Réserves">
              <ul className="flex flex-col" style={{ gap: 6 }}>
                {result.notes.map((note, index) => (
                  <li key={index} className="ui-t-muted flex gap-1.5" style={{ fontSize: 'var(--ui-fs-xs)', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--ui-warning)' }}>•</span>
                    {note}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span>{title}</span>
        {badge && <span className="ui-num" style={{ fontWeight: 600 }}>{badge}</span>}
      </header>
      <div className="ui-scroll" style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)', maxHeight: 380, overflowY: 'auto' }}>
        {children}
      </div>
    </section>
  );
}
