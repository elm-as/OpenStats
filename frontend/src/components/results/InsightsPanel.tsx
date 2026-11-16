import { useState, useMemo } from 'react';
import {
  Sparkles, AlertCircle, AlertTriangle, Info, CheckCircle2, Lightbulb,
  ChevronDown, RefreshCw, Filter,
} from 'lucide-react';
import { useGetInsightsQuery } from '../../store/api';

type Severity = 'critical' | 'warning' | 'info' | 'success' | 'methodological';
type Confidence = 'high' | 'medium' | 'low';

interface Insight {
  title: string;
  message: string;
  severity: Severity;
  category: string;
  confidence: Confidence;
  suggestion?: string | null;
  evidence?: Record<string, unknown>;
  variables?: string[];
  score: number;
  tags?: string[];
}

const SEVERITY_META: Record<Severity, {
  icon: typeof Sparkles;
  iconColor: string;
  ring: string;
  accent: string;
  label: string;
  pillBg: string;
  pillText: string;
}> = {
  critical: {
    icon: AlertCircle,
    iconColor: 'text-red-400',
    ring: 'border-red-500/35',
    accent: 'bg-red-500',
    label: 'Critique',
    pillBg: 'bg-red-500/15 border-red-500/30',
    pillText: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    ring: 'border-amber-500/35',
    accent: 'bg-amber-500',
    label: 'Attention',
    pillBg: 'bg-amber-500/15 border-amber-500/30',
    pillText: 'text-amber-400',
  },
  methodological: {
    icon: Lightbulb,
    iconColor: 'text-teal-400',
    ring: 'border-teal-500/35',
    accent: 'bg-teal-500',
    label: 'Méthodo',
    pillBg: 'bg-teal-500/15 border-teal-500/30',
    pillText: 'text-teal-400',
  },
  success: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
    ring: 'border-emerald-500/35',
    accent: 'bg-emerald-500',
    label: 'Positif',
    pillBg: 'bg-emerald-500/15 border-emerald-500/30',
    pillText: 'text-emerald-400',
  },
  info: {
    icon: Info,
    iconColor: 'text-sky-400',
    ring: 'border-sky-500/35',
    accent: 'bg-sky-500',
    label: 'Info',
    pillBg: 'bg-sky-500/15 border-sky-500/30',
    pillText: 'text-sky-400',
  },
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Confiance élevée',
  medium: 'Confiance modérée',
  low: 'Indicatif',
};

// Markdown ultra-minimaliste : **bold** et `code`
function renderRichText(text: string) {
  const parts: Array<{ type: 'text' | 'bold' | 'code'; value: string }> = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: text.slice(last, m.index) });
    if (m[0].startsWith('**')) parts.push({ type: 'bold', value: m[0].slice(2, -2) });
    else parts.push({ type: 'code', value: m[0].slice(1, -1) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts.map((p, i) => {
    if (p.type === 'bold') return <strong key={i} className="font-semibold text-surface-100">{p.value}</strong>;
    if (p.type === 'code') return <code key={i} className="font-mono text-xs px-1.5 py-0.5 rounded bg-surface-900/70 text-accent-400 border border-white/10">{p.value}</code>;
    return <span key={i}>{p.value}</span>;
  });
}

function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.info;
  const Icon = meta.icon;

  const hasDetails = !!insight.suggestion || (insight.evidence && Object.keys(insight.evidence).length > 0);

  return (
    <div className={`relative overflow-hidden rounded-lg border bg-surface-800/40 hover:bg-surface-800/60 transition-colors ${meta.ring}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${meta.accent}`} />
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left"
        disabled={!hasDetails}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-surface-100">{insight.title}</h4>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${meta.pillBg} ${meta.pillText}`}>
              {meta.label}
            </span>
            {insight.confidence === 'high' && (
              <span className="text-[10px] text-surface-400" title={CONFIDENCE_LABEL[insight.confidence]}>
                ● Fiable
              </span>
            )}
          </div>
          <p className="text-sm text-surface-300 mt-1 leading-relaxed">
            {renderRichText(insight.message)}
          </p>
        </div>
        {hasDetails && (
          <ChevronDown className={`w-4 h-4 mt-1 flex-shrink-0 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
      </button>

      {expanded && hasDetails && (
        <div className="px-4 pb-4 pl-11 space-y-2 border-t border-white/10 pt-3">
          {insight.suggestion && (
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent-400" />
              <p className="text-sm text-surface-300 italic">
                <span className="text-accent-400 font-medium not-italic">Recommandation : </span>
                {renderRichText(insight.suggestion)}
              </p>
            </div>
          )}
          {insight.evidence && Object.keys(insight.evidence).length > 0 && (
            <div className="text-xs text-surface-400 font-mono ui-num space-y-0.5">
              {Object.entries(insight.evidence).slice(0, 6).map(([k, v]) => (
                <div key={k}>
                  <span className="text-surface-400">{k}</span> = <span className="text-surface-200">{formatValue(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'n/a';
  if (typeof v === 'number') {
    if (Math.abs(v) > 1e6 || (Math.abs(v) < 1e-3 && v !== 0)) return v.toExponential(2);
    return Number.isInteger(v) ? v.toString() : v.toFixed(3);
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 50);
  return String(v);
}

interface Props {
  datasetId: string;
  /** Si true, affiche par défaut tout déplié */
  defaultOpen?: boolean;
  /** Limite l'affichage initial à N insights (puis "voir plus") */
  initialLimit?: number;
}

export default function InsightsPanel({ datasetId, defaultOpen = true, initialLimit = 8 }: Props) {
  const { data, isLoading, refetch, isFetching } = useGetInsightsQuery(datasetId);
  const [open, setOpen] = useState(defaultOpen);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [showAll, setShowAll] = useState(false);

  const insights = (data?.insights ?? []) as Insight[];
  const summary = data?.summary;

  const filtered = useMemo(() => {
    if (filter === 'all') return insights;
    return insights.filter(i => i.severity === filter);
  }, [insights, filter]);

  const displayed = showAll ? filtered : filtered.slice(0, initialLimit);

  if (isLoading) {
    return (
      <div className="ui-panel p-4 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-accent-400 animate-pulse" />
        <span className="text-sm text-surface-400">Génération des insights…</span>
      </div>
    );
  }

  if (!data || insights.length === 0) {
    return (
      <div className="ui-panel p-4 text-sm text-surface-400 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-surface-400" />
        Aucun insight disponible. Lancez une analyse pour générer des interprétations automatiques.
      </div>
    );
  }

  return (
    <div className="ui-panel overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 group">
          <Sparkles className="w-4 h-4 text-accent-400" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-surface-100 group-hover:text-accent-400 transition-colors">
              Interprétation automatique
            </h3>
            <p className="text-xs text-surface-400 ui-num">
              {insights.length} insight{insights.length > 1 ? 's' : ''} généré{insights.length > 1 ? 's' : ''} par l'analyseur
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {/* Badges résumé */}
          {summary && (
            <div className="hidden md:flex gap-1.5 text-xs ui-num">
              {summary.critical > 0 && (
                <FilterBadge severity="critical" count={summary.critical} active={filter === 'critical'} onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')} />
              )}
              {summary.warning > 0 && (
                <FilterBadge severity="warning" count={summary.warning} active={filter === 'warning'} onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')} />
              )}
              {summary.methodological > 0 && (
                <FilterBadge severity="methodological" count={summary.methodological} active={filter === 'methodological'} onClick={() => setFilter(filter === 'methodological' ? 'all' : 'methodological')} />
              )}
              {summary.success > 0 && (
                <FilterBadge severity="success" count={summary.success} active={filter === 'success'} onClick={() => setFilter(filter === 'success' ? 'all' : 'success')} />
              )}
              {summary.info > 0 && (
                <FilterBadge severity="info" count={summary.info} active={filter === 'info'} onClick={() => setFilter(filter === 'info' ? 'all' : 'info')} />
              )}
            </div>
          )}

          <button
            onClick={() => refetch()}
            className="ui-btn ui-btn-ghost p-1.5"
            title="Régénérer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={() => setOpen(!open)} className="p-1 text-surface-400 hover:text-surface-200">
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Contenu */}
      {open && (
        <div className="p-4 space-y-2">
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-accent-400 hover:underline mb-2 flex items-center gap-1"
            >
              <Filter className="w-3 h-3" /> Effacer le filtre ({SEVERITY_META[filter].label})
            </button>
          )}

          {displayed.length === 0 && (
            <p className="text-sm text-surface-400 text-center py-4">Aucun insight pour ce filtre.</p>
          )}

          {displayed.map((ins, i) => (
            <InsightCard key={`${ins.severity}-${ins.title}-${i}`} insight={ins} />
          ))}

          {filtered.length > initialLimit && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-sm text-accent-400 hover:text-accent-300 py-2 rounded-lg hover:bg-white/[0.04] transition-colors ui-num"
            >
              Voir les {filtered.length - initialLimit} insights restants
            </button>
          )}
          {showAll && filtered.length > initialLimit && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full text-sm text-surface-400 hover:text-surface-200 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Réduire
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterBadge({ severity, count, active, onClick }: {
  severity: Severity; count: number; active: boolean; onClick: () => void;
}) {
  const meta = SEVERITY_META[severity];
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded border transition-colors ${meta.pillBg} ${meta.pillText} ${active ? 'ring-1 ring-current font-semibold' : 'opacity-85 hover:opacity-100'}`}
      title={`Filtrer : ${meta.label}`}
    >
      {count} {meta.label.toLowerCase()}
    </button>
  );
}
