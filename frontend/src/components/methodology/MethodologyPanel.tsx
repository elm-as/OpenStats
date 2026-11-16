import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, CircleDashed, Loader2, MinusCircle, Workflow } from 'lucide-react';
import StageView from './StageView';
import ResultSummary from './ResultSummary';
import ResultActions from './ResultActions';
import RemedyApplication from './RemedyApplication';
import MethodologyToolbar from './MethodologyToolbar';
import { useMethodology } from './useMethodology';
import type { CorrectionReport, MethodologyResult, Remedy, Stage } from './methodologyTypes';
import { useStatus } from '../shell/StatusBar';

/** Les 12 étapes attendues, pour afficher la progression avant même de les recevoir. */
const EXPECTED = [
  'Comprendre le problème', 'Comprendre les données', 'Nettoyage & qualité',
  'Analyse univariée', 'Analyse bivariée & multivariée', 'Diagnostic des problèmes',
  'Transformations & re-diagnostic', 'Analyse univariée (après correction)',
  'Modélisation', 'Validation', 'Interprétation',
];

interface Props {
  datasetId: string;
  datasetName?: string;
}

export default function MethodologyPanel({ datasetId, datasetName }: Props) {
  const {
    columns, stages, running, done, error, run, stop, reset,
    applyRemedies, applying, applyResult,
  } = useMethodology(datasetId);
  const { setStatus } = useStatus();

  const [target, setTarget] = useState<string | null>(null);
  const [maxIterations, setMaxIterations] = useState(5);
  const [allowAggressive, setAllowAggressive] = useState(true);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // L'étape en cours devient l'étape affichée, tant que l'utilisateur ne navigue pas.
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned && stages.length) setActive(stages.length - 1);
  }, [stages.length, pinned]);

  const correction = useMemo(() => {
    const stage = stages.find(s => s.key === 'correction');
    return stage ? (stage.data as unknown as CorrectionReport) : null;
  }, [stages]);

  /** Corrections retenues par la boucle, proposées à l'application définitive. */
  const acceptedRemedies = useMemo<Remedy[]>(() => {
    if (!correction) return [];
    const out: Remedy[] = [];
    for (const iteration of correction.iterations) {
      if (!iteration.kept) continue;
      for (const applied of iteration.applied) {
        if (!applied.ok || applied.action === 'robust_se') continue;
        out.push({
          action: applied.action, columns: applied.columns, label: applied.label,
          rationale: applied.rationale, params: applied.params, aggressive: applied.aggressive,
        });
      }
    }
    return out;
  }, [correction]);

  useEffect(() => {
    setSelected(new Set(acceptedRemedies.map(r => `${r.action}::${r.columns.join(',')}`)));
  }, [acceptedRemedies]);

  useEffect(() => {
    if (running) {
      setStatus({
        busy: true,
        message: stages.length ? `Étape ${stages.length}/11 — ${stages[stages.length - 1].title}` : 'Démarrage',
        items: [{ id: 'stages', label: `${stages.length}/11 étapes` }],
      });
    } else if (done && correction) {
      setStatus({
        busy: false, message: null,
        items: [
          { id: 'sev', label: `gravité ${correction.initial.severity_total.toFixed(2)} → ${correction.final.severity_total.toFixed(2)}`, tone: 'success' },
          { id: 'iter', label: `${correction.iterations.filter(i => i.kept).length} itération(s)` },
          { id: 'ready', label: correction.ready_for_modeling ? 'modélisable' : 'bloquants restants',
            tone: correction.ready_for_modeling ? 'success' : 'warning' },
        ],
      });
    } else {
      setStatus({ busy: false, message: null, items: [] });
    }
  }, [running, done, stages, correction, setStatus]);

  useEffect(() => () => setStatus({ busy: false, message: null, items: [] }), [setStatus]);

  const toggleRemedy = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = () => {
    const chosen = acceptedRemedies.filter(r => selected.has(`${r.action}::${r.columns.join(',')}`));
    if (chosen.length) applyRemedies(chosen, target, 'Corrections méthodologiques');
  };

  const started = stages.length > 0;

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-3)' }}>
      <MethodologyToolbar
        columns={columns}
        target={target}
        setTarget={setTarget}
        maxIterations={maxIterations}
        setMaxIterations={setMaxIterations}
        allowAggressive={allowAggressive}
        setAllowAggressive={setAllowAggressive}
        running={running}
        started={started}
        error={error}
        onRun={() => { setPinned(false); run({ target, maxIterations, allowAggressive }); }}
        onStop={stop}
        onReset={reset}
      />

      {done && stages.length > 0 && (
        <ResultSummary
          stages={stages}
          elapsed={stages.reduce((total, stage) => total + stage.duration_ms, 0) / 1000}
        />
      )}

      {!started && !running ? (
        <div
          className="ui-panel flex flex-col items-center justify-center text-center"
          style={{ minHeight: 240, padding: 'var(--ui-gap-5)' }}
        >
          <Workflow className="w-7 h-7 mb-3" style={{ color: 'var(--ui-text-faint)' }} />
          <p style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700, marginBottom: 6 }}>
            Analyse méthodique complète
          </p>
          <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)', maxWidth: 560, lineHeight: 1.65 }}>
            Onze étapes, du cadrage du problème à l’interprétation. Entre le diagnostic et la
            modélisation, une boucle applique des corrections, re-diagnostique, et recommence
            tant que la qualité des données progresse. Rien n’est écrit sur vos données sans
            votre accord explicite.
          </p>
        </div>
      ) : (
        <div
          className="grid items-start"
          style={{ gap: 'var(--ui-gap-3)', gridTemplateColumns: '236px minmax(0, 1fr)' }}
        >
          {/* ── Progression par étape ── */}
          <nav className="ui-panel overflow-hidden" style={{ position: 'sticky', top: 0 }}>
            <header className="ui-panel-header">
              <span>Étapes</span>
              <span className="ui-num">{stages.length}/11</span>
            </header>
            <ol style={{ padding: 'var(--ui-gap-1)' }}>
              {EXPECTED.map((title, index) => {
                const stage: Stage | undefined = stages[index];
                const isActive = index === active;
                const isRunning = running && index === stages.length;
                return (
                  <li key={title}>
                    <button
                      onClick={() => { if (stage) { setActive(index); setPinned(true); } }}
                      disabled={!stage}
                      className="ui-focusable w-full flex items-center gap-2 text-left rounded-[var(--ui-radius-sm)] px-2"
                      style={{
                        minHeight: 26,
                        background: isActive ? 'var(--ui-accent-soft)' : 'transparent',
                        color: isActive ? 'var(--ui-accent-text)'
                          : stage ? 'var(--ui-text-secondary)' : 'var(--ui-text-faint)',
                        cursor: stage ? 'pointer' : 'default',
                        opacity: stage || isRunning ? 1 : 0.5,
                      }}
                    >
                      <span className="shrink-0" style={{ width: 13 }}>
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--ui-accent)' }} />
                          : stage?.status === 'success' ? <Check className="w-3 h-3" style={{ color: 'var(--ui-success)' }} />
                          : stage?.status === 'skipped' ? <MinusCircle className="w-3 h-3" style={{ color: 'var(--ui-text-faint)' }} />
                          : <CircleDashed className="w-3 h-3" />}
                      </span>
                      <span className="truncate" style={{ fontSize: 'var(--ui-fs-xs)', fontWeight: isActive ? 700 : 500 }}>
                        {title}
                      </span>
                      {stage && stage.charts.length > 0 && (
                        <span
                          className="ui-num ml-auto shrink-0 ui-t-faint inline-flex items-center gap-0.5"
                          style={{ fontSize: '9.5px' }}
                          title={`${stage.charts.length} graphique(s)`}
                        >
                          {stage.charts.length}
                          <BarChart3 className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* ── Contenu de l'étape ── */}
          <div className="flex flex-col min-w-0" style={{ gap: 'var(--ui-gap-3)' }}>
            {stages[active]
              ? <StageView stage={stages[active]} />
              : (
                <div className="ui-panel flex items-center justify-center" style={{ minHeight: 200 }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ui-accent)' }} />
                </div>
              )}

            {/* ── Application définitive des corrections ── */}
            {done && (
              <ResultActions
                datasetId={datasetId}
                datasetName={datasetName}
                result={{
                  elapsed_sec: stages.reduce((t, s) => t + s.duration_ms, 0) / 1000,
                  problem_type: String(stages[0]?.data?.problem_type ?? 'exploration'),
                  target,
                  shape_before: { rows: 0, columns: 0 },
                  shape_after: { rows: 0, columns: 0 },
                  stages,
                } as MethodologyResult}
              />
            )}

            {done && acceptedRemedies.length > 0 && (
              <RemedyApplication
                remedies={acceptedRemedies}
                selected={selected}
                onToggle={toggleRemedy}
                onApply={handleApply}
                applying={applying}
                result={applyResult}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
