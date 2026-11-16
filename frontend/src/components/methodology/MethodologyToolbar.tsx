import { AlertCircle, Play, RotateCcw, Square, Workflow } from 'lucide-react';

interface Props {
  columns: string[];
  target: string | null;
  setTarget: (target: string | null) => void;
  maxIterations: number;
  setMaxIterations: (n: number) => void;
  allowAggressive: boolean;
  setAllowAggressive: (val: boolean) => void;
  running: boolean;
  started: boolean;
  error: string | null;
  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
}

export default function MethodologyToolbar({
  columns,
  target,
  setTarget,
  maxIterations,
  setMaxIterations,
  allowAggressive,
  setAllowAggressive,
  running,
  started,
  error,
  onRun,
  onStop,
  onReset,
}: Props) {
  return (
    <>
      <div
        className="ui-panel flex items-center flex-wrap"
        style={{ gap: 'var(--ui-gap-3)', padding: '0 var(--ui-pad-x)', minHeight: 46 }}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Workflow className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          <span style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700 }}>Méthodologie itérative</span>
        </div>

        <span className="ui-sep" aria-hidden />

        <label className="flex items-center gap-2">
          <span className="ui-label">Cible</span>
          <select
            value={target ?? ''}
            onChange={e => { setTarget(e.target.value || null); onReset(); }}
            disabled={running}
            className="ui-select ui-focusable"
            style={{ minWidth: 170 }}
          >
            <option value="">Sans cible</option>
            {columns.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="ui-label">Itérations max</span>
          <input
            type="number" min={1} max={10} value={maxIterations}
            onChange={e => setMaxIterations(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
            disabled={running}
            className="ui-input ui-focusable ui-num"
            style={{ width: 56 }}
          />
        </label>

        <label className="flex items-center gap-1.5" title="Autorise log, Box-Cox, différenciation… qui modifient l’échelle des variables.">
          <input
            type="checkbox" checked={allowAggressive}
            onChange={e => setAllowAggressive(e.target.checked)}
            disabled={running}
          />
          <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Transformations d’échelle</span>
        </label>

        <span className="flex-1" />

        {started && !running && (
          <button onClick={onReset} className="ui-btn ui-btn-ghost ui-focusable">
            <RotateCcw className="w-3 h-3" />
            Effacer
          </button>
        )}
        {running ? (
          <button onClick={onStop} className="ui-btn ui-focusable">
            <Square className="w-3 h-3" />
            Arrêter
          </button>
        ) : (
          <button
            onClick={onRun}
            className="ui-btn ui-btn-primary ui-focusable"
          >
            <Play className="w-3 h-3" />
            {started ? 'Relancer' : 'Lancer l’analyse'}
          </button>
        )}
      </div>

      {error && (
        <div
          className="ui-panel flex items-start gap-2"
          style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)', borderColor: 'var(--ui-danger)' }}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--ui-danger)' }} />
          <span style={{ fontSize: 'var(--ui-fs-sm)', color: 'var(--ui-danger)' }}>{error}</span>
        </div>
      )}
    </>
  );
}
