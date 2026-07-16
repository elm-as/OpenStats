import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Target, Clock, CheckCircle2, XCircle, Loader2,
  ChevronRight, Sparkles, AlertCircle, RefreshCw, Play, Cpu,
  Activity, EyeOff, ChevronDown, Database, Layers,
  Gauge, Hash, Lightbulb,
} from 'lucide-react';
import { useDetectPipelineQuery, useBuildPipelineRecipeMutation, useExecuteAutoPipelineMutation } from '../store/api';
import ResultsWizard from './ResultsWizard';
import LowCodeCanvas from './LowCodeCanvas';

interface Props {
  datasetId: string;
  datasetName?: string;
  onComplete?: (execution?: any) => void;
}

const PROBLEM_LABEL: Record<string, { label: string; icon: typeof Target; color: string; bg: string }> = {
  regression: { label: 'Regression', icon: Target, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  binary_classification: { label: 'Classification binaire', icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  multiclass_classification: { label: 'Classification multi-classe', icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  forecast: { label: 'Prevision', icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  exploration: { label: 'Exploration', icon: Sparkles, color: 'text-accent-400', bg: 'bg-accent-400/10' },
};

const CONFIDENCE_META: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Confiance elevee' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Confiance moderee' },
  low: { color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Confiance faible' },
};

const STEP_COLORS = [
  'border-l-accent-400', 'border-l-purple-400', 'border-l-blue-400',
  'border-l-emerald-400', 'border-l-amber-400', 'border-l-pink-400',
  'border-l-cyan-400', 'border-l-indigo-400',
];

export default function AutoPipelinePanel({ datasetId, datasetName, onComplete }: Props) {
  const [executed, setExecuted] = useState(false);
  const [canvasMode, setCanvasMode] = useState(false);
  const [includeOptional, setIncludeOptional] = useState(false);
  const [manualTarget, setManualTarget] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);
  const [showColumns, setShowColumns] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const columnsInitializedRef = useRef(false);

  const { data: detection, isLoading: isDetecting, refetch: refetchDetect } =
    useDetectPipelineQuery({ id: datasetId });

  const [buildRecipe, { data: recipeData, isLoading: isBuilding }] =
    useBuildPipelineRecipeMutation();

  const [execute, { data: execResult, isLoading: isExecuting }] =
    useExecuteAutoPipelineMutation();

  const profile = detection?.profile;
  const recipe = recipeData?.recipe;
  const execution = execResult?.execution;

  const effectiveTarget = manualTarget ?? profile?.suggested_target ?? null;

  const allColumns = useMemo(() => {
    if (!profile) return [];
    const cols = new Set<string>();
    (profile.numeric_cols || []).forEach((c: string) => cols.add(c));
    (profile.categorical_cols || []).forEach((c: string) => cols.add(c));
    (profile.binary_cols || []).forEach((c: string) => cols.add(c));
    (profile.temporal_cols || []).forEach((c: string) => cols.add(c));
    (profile.discrete_cols || []).forEach((c: string) => cols.add(c));
    (profile.id_cols || []).forEach((c: string) => cols.add(c));
    return Array.from(cols);
  }, [profile]);

  useEffect(() => {
    if (profile && !columnsInitializedRef.current) {
      const autoExcluded = [...(profile.id_cols || []), ...(profile.high_missing_cols || [])];
      if (autoExcluded.length > 0) {
        setExcludedColumns(autoExcluded);
      }
      columnsInitializedRef.current = true;
    }
  }, [profile]);

  const toggleColumn = (col: string) => {
    setExcludedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  useEffect(() => {
    if (isExecuting) {
      setElapsed(0);
      setCurrentStepIdx(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isExecuting]);

  const liveSteps = recipeData?.recipe?.steps ?? (detection && buildRecipeFromProfile(profile));
  const totalSteps = liveSteps?.length ?? 0;
  useEffect(() => {
    if (!isExecuting || totalSteps === 0) return;
    const avgStepMs = ((profile?.suggested_target ? 25 : 10) * 1000) / Math.max(totalSteps, 1);
    stepTimerRef.current = setInterval(() => {
      setCurrentStepIdx(i => Math.min(i + 1, totalSteps - 1));
    }, avgStepMs);
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current); };
  }, [isExecuting, totalSteps]);

  const [execError, setExecError] = useState<string | null>(null);

  const handleExecute = async () => {
    setExecError(null);
    setExecuted(false);
    let currentRecipe = recipe;
    try {
      if (!currentRecipe) {
        const res = await buildRecipe({ id: datasetId, target: effectiveTarget ?? undefined }).unwrap();
        if (!res.recipe) return;
        currentRecipe = res.recipe;
      }
      setCurrentStepIdx(0);
      const result = await execute({
        id: datasetId,
        target: effectiveTarget ?? undefined,
        execute_optional: includeOptional,
        exclude_columns: excludedColumns,
      }).unwrap();
      setCurrentStepIdx(currentRecipe.steps.length);
      setExecuted(true);
      onComplete?.(result.execution);
    } catch (err: any) {
      setExecError(err?.data?.error ?? err?.message ?? 'Erreur inconnue lors de l\'execution');
      setExecuted(true);
    }
  };

  if (isDetecting) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="card flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-accent-400/20 blur-2xl rounded-full" />
            <Loader2 className="w-8 h-8 text-accent-400 animate-spin relative z-10" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-strong">Analyse du dataset en cours...</p>
            <p className="text-xs text-muted mt-1">L'IA examine vos donnees pour identifier le probleme optimal</p>
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-400 animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-accent-400 animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 rounded-full bg-accent-400 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const problemMeta = PROBLEM_LABEL[profile.problem_type] ?? PROBLEM_LABEL.exploration;
  const ProblemIcon = problemMeta.icon;
  const activeCount = allColumns.length - excludedColumns.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Profile Detection Card ── */}
      <div className="card overflow-hidden !p-0">
        <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-accent-500/[0.06] to-transparent">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-accent-400/20 blur-xl rounded-full" />
                <div className={`w-9 h-9 rounded-xl ${problemMeta.bg} flex items-center justify-center relative z-10`}>
                  <ProblemIcon className={`w-5 h-5 ${problemMeta.color}`} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-strong">{problemMeta.label} detecte</h3>
                {datasetName && (
                  <p className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                    <Database className="w-3 h-3" />
                    {datasetName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => refetchDetect()}
              className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-default transition-colors"
              title="Re-detecter"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={ProblemIcon}
              label="Probleme"
              value={problemMeta.label}
              color={problemMeta.color}
              bg={problemMeta.bg}
            />
            <KpiCard
              icon={Target}
              label="Cible"
              value={effectiveTarget ?? 'Aucune'}
              color="text-accent-400"
              bg="bg-accent-400/10"
              mono
            />
            <KpiCard
              icon={Hash}
              label="Variables"
              value={`${profile.numeric_cols.length}N / ${profile.categorical_cols.length}C / ${profile.temporal_cols.length}T`}
              color="text-blue-400"
              bg="bg-blue-400/10"
            />
            <KpiCard
              icon={Layers}
              label="Observations"
              value={profile.n_rows.toLocaleString()}
              color="text-purple-400"
              bg="bg-purple-400/10"
            />
          </div>

          {/* Stationarity */}
          {profile.has_temporal && profile.stationarity_summary && profile.stationarity_summary !== 'unknown' && (() => {
            const S: Record<string, { label: string; cls: string }> = {
              all_stationary:    { label: 'I(0) - stationnaire',          cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' },
              all_nonstationary: { label: profile.cointegration_likely ? 'I(1) - cointegration probable > VECM' : 'I(1) - non-stationnaire', cls: profile.cointegration_likely ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
              mixed:             { label: 'I(0)/I(1) mixte > ARDL',       cls: 'bg-blue-500/10 border-blue-500/30 text-blue-300' },
            };
            const m = S[profile.stationarity_summary];
            if (!m) return null;
            return (
              <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${m.cls}`}>
                <Activity className="w-3 h-3" />
                Stationnarite : {m.label}
              </div>
            );
          })()}

          {/* Candidate targets - redesigned as chips */}
          {profile.candidate_targets && profile.candidate_targets.length > 1 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">Cibles candidates</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.candidate_targets.slice(0, 8).map((c) => (
                  <button
                    key={c.column}
                    onClick={() => setManualTarget(c.column === profile.suggested_target && manualTarget === null ? null : c.column)}
                    className={`chip transition-all ${
                      effectiveTarget === c.column
                        ? 'chip-active ring-1 ring-accent-500/30'
                        : 'hover:border-accent-500/20 hover:text-default'
                    }`}
                  >
                    {c.column}
                    <span className="text-[9px] opacity-40 ml-0.5">{c.type}</span>
                  </button>
                ))}
                {manualTarget !== null && (
                  <button
                    onClick={() => setManualTarget(null)}
                    className="text-[10px] text-muted hover:text-accent-400 transition-colors underline underline-offset-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {profile.notes && profile.notes.length > 0 && (
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 space-y-1">
              {profile.notes.map((note, i) => (
                <p key={i} className="text-xs text-muted flex items-start gap-2">
                  <Lightbulb className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </p>
              ))}
            </div>
          )}

          {/* Flags */}
          {profile.flags && profile.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.flags.map(flag => (
                <span key={flag} className="badge badge-neutral text-[9px]">
                  {flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Column Exclusion Card ── */}
      {allColumns.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowColumns(s => !s)}
            className="w-full flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                <EyeOff className="w-4 h-4 text-muted group-hover:text-accent-400 transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-strong">Colonnes disponibles</p>
                <p className="text-xs text-muted">
                  {activeCount}/{allColumns.length} actives
                  {excludedColumns.length > 0 && (
                    <span className="text-faint ml-1">- {excludedColumns.length} exclues</span>
                  )}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${showColumns ? 'rotate-180' : ''}`} />
          </button>
          {showColumns && (
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="flex flex-wrap gap-1.5">
                {allColumns.map(col => {
                  const isExcluded = excludedColumns.includes(col);
                  const isId = (profile?.id_cols || []).includes(col);
                  const isHighMissing = (profile?.high_missing_cols || []).includes(col);
                  return (
                    <button
                      key={col}
                      onClick={() => toggleColumn(col)}
                      className={`chip text-xs transition-all ${
                        isExcluded
                          ? 'opacity-40 line-through border-white/5 hover:opacity-60'
                          : 'border-accent-500/20 text-accent-300 hover:bg-accent-500/10'
                      }`}
                    >
                      {col}
                      {isId && <span className="text-[9px] opacity-40 ml-0.5">ID</span>}
                      {isHighMissing && <span className="text-[9px] opacity-40 ml-0.5">NaN</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recipe / Pipeline Card ── */}
      {recipe && (
        <div className="card overflow-hidden !p-0 animate-fade-in-up">
          <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-500/[0.06] to-transparent">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-strong flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-purple-400" />
                  {recipe.title}
                </h3>
                <p className="text-xs text-muted mt-1">{recipe.description}</p>
              </div>
              <div className="flex items-center gap-3 text-xs shrink-0">
                {isExecuting ? (
                  <span className="badge badge-info flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {elapsed}s
                  </span>
                ) : (
                  <span className={`badge ${CONFIDENCE_META[recipe.confidence]?.bg ?? 'bg-white/5'} ${CONFIDENCE_META[recipe.confidence]?.color ?? 'text-muted'}`}>
                    {CONFIDENCE_META[recipe.confidence]?.label ?? recipe.confidence}
                  </span>
                )}
                <span className="text-faint flex items-center gap-1">
                  <Clock className="w-3 h-3" /> ~{recipe.estimated_duration_sec}s
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {isExecuting && (
            <div className="w-full h-1 bg-white/[0.04]">
              <div
                className="h-full bg-gradient-to-r from-accent-500 to-purple-500 rounded-r-full transition-all duration-700 ease-out"
                style={{ width: `${Math.round((currentStepIdx / Math.max(recipe.steps.length - 1, 1)) * 100)}%` }}
              />
            </div>
          )}

          {/* Steps Timeline */}
          <div className="px-5 py-4">
            <div className="space-y-0">
              {recipe.steps.map((step, i) => {
                const execStep = execution?.steps[step.key];
                const isActive = isExecuting && i === currentStepIdx;
                const isPast = isExecuting && i < currentStepIdx;
                const borderColor = STEP_COLORS[i % STEP_COLORS.length];
                return (
                  <StepRow
                    key={step.key}
                    index={i + 1}
                    label={step.label}
                    rationale={step.rationale}
                    optional={step.optional}
                    status={execStep?.status ?? (isActive ? 'running' : isPast ? 'past' : undefined)}
                    duration={execStep?.duration_ms}
                    error={execStep?.error}
                    borderColor={borderColor}
                    isLast={i === recipe.steps.length - 1}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {executed && execError && !execution && (
        <div className="card !border-red-500/20 !bg-red-500/[0.03] animate-scale-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Echec de l'execution</p>
              <p className="text-xs text-red-300/70 mt-1">{execError}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {executed && execution && !canvasMode && (
        <div className="animate-fade-in-up">
          <ResultsWizard
            datasetId={datasetId}
            execution={execution}
            execError={execError}
            onReset={() => {
              setExecuted(false);
              setExecError(null);
              setElapsed(0);
              setCurrentStepIdx(0);
              setCanvasMode(false);
            }}
            onLowCode={() => setCanvasMode(true)}
          />
        </div>
      )}

      {executed && canvasMode && (
        <div className="animate-fade-in-up">
          <LowCodeCanvas
            datasetId={datasetId}
            onBack={() => setCanvasMode(false)}
          />
        </div>
      )}

      {/* ── Action Bar ── */}
      <div className="card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeOptional}
            onChange={e => setIncludeOptional(e.target.checked)}
            className="accent-accent-500 rounded"
          />
          Inclure les etapes optionnelles (SHAP, rapport)
        </label>

        <div className="flex gap-2">
          {!recipe ? (
            <button
              onClick={async () => {
                try { await buildRecipe({ id: datasetId, target: effectiveTarget ?? undefined }).unwrap(); }
                catch { /* handled by RTK Query */ }
              }}
              disabled={isBuilding}
              className="btn-primary text-sm"
            >
              {isBuilding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Construction du pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Construire le pipeline
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="btn-primary text-sm"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Execution {currentStepIdx + 1}/{totalSteps}...
                </>
              ) : executed ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Relancer l'analyse
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Analyser pour moi
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── KPI Card (stat system) ── */
function KpiCard({ icon: Icon, label, value, color, bg, mono }: {
  icon: typeof Target;
  label: string;
  value: React.ReactNode;
  color: string;
  bg: string;
  mono?: boolean;
}) {
  return (
    <div className="stat group">
      <div className="stat-label">
        <div className={`w-4 h-4 rounded-md ${bg} flex items-center justify-center`}>
          <Icon className={`w-2.5 h-2.5 ${color}`} />
        </div>
        {label}
      </div>
      <div className={`stat-value ${mono ? 'text-sm font-mono' : 'text-sm'}`}>{value}</div>
    </div>
  );
}

function buildRecipeFromProfile(_profile: any) {
  return null;
}

/* ── Step Timeline Row ── */
function StepRow({ index, label, rationale, optional, status, duration, error, borderColor, isLast }: {
  index: number;
  label: string;
  rationale: string;
  optional: boolean;
  status?: string;
  duration?: number;
  error?: string;
  borderColor: string;
  isLast: boolean;
}) {
  const isRunning = status === 'running';
  const isSuccess = status === 'success';
  const isError = status === 'error';
  const isSkipped = status === 'skipped';
  const isPast = status === 'past';

  return (
    <div className="relative flex gap-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[14px] top-9 bottom-0 w-px bg-white/[0.06]" />
      )}

      {/* Status node */}
      <div className={`relative z-10 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-300 ${
        isSuccess ? 'bg-emerald-500/10 border-emerald-500/30' :
        isError   ? 'bg-red-500/10 border-red-500/30' :
        isRunning ? 'bg-accent-500/10 border-accent-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]' :
        isSkipped ? 'bg-white/[0.02] border-white/10' :
        isPast    ? 'bg-white/[0.02] border-white/10' :
                    'bg-white/[0.02] border-white/[0.06]'
      }`}>
        {isRunning && <Loader2 className="w-3.5 h-3.5 text-accent-400 animate-spin" />}
        {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {isError && <XCircle className="w-3.5 h-3.5 text-red-400" />}
        {isSkipped && <ChevronRight className="w-3 h-3 text-faint" />}
        {!isRunning && !isSuccess && !isError && !isSkipped && (
          <span className={`text-[9px] font-bold ${isPast ? 'text-faint' : 'text-muted'}`}>
            {index}
          </span>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 pb-3 ${isRunning ? 'animate-pulse' : ''}`}>
        <div className={`flex items-center gap-2 flex-wrap border-l-2 pl-3 -ml-px transition-colors ${
          isSuccess ? borderColor :
          isError   ? 'border-l-red-500/30' :
          isRunning ? 'border-l-accent-400' :
                      'border-l-transparent'
        }`}>
          <span className={`text-[13px] font-semibold ${
            isRunning ? 'text-accent-300' :
            isSuccess ? 'text-strong' :
            isError   ? 'text-red-300' :
            isSkipped ? 'text-faint' :
            isPast    ? 'text-default' :
                        'text-muted'
          }`}>
            {label}
          </span>
          {optional && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-faint uppercase tracking-wider">
              optionnel
            </span>
          )}
          {duration !== undefined && (
            <span className="text-[10px] text-faint font-mono">{duration}ms</span>
          )}
        </div>
        <p className="text-[11px] text-faint mt-0.5 pl-3">{rationale}</p>
        {error && (
          <div className="mt-1.5 ml-3 pl-3 py-1.5 rounded-r-lg bg-red-500/5 border-l-2 border-l-red-500/30">
            <p className="text-[11px] text-red-400 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              {error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
