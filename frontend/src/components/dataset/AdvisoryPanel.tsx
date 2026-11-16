import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertCircle, Info, Sparkles } from 'lucide-react';
import { useGetDiagnosticsQuery } from '../../store/api';

interface Advisory {
  severity: 'critical' | 'warning' | 'info' | 'methodological';
  category: string;
  title: string;
  message: string;
  suggestion?: string;
}

const severityConfig = {
  critical: {
    bg: 'bg-red-500/10 border-red-500/35 hover:bg-red-500/15',
    icon: AlertCircle,
    iconColor: 'text-red-400',
    label: 'Critique',
    labelColor: 'text-red-400 bg-red-500/15',
    title: 'text-red-300',
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/35 hover:bg-amber-500/15',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    label: 'Attention',
    labelColor: 'text-amber-400 bg-amber-500/15',
    title: 'text-amber-300',
  },
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15',
    icon: Info,
    iconColor: 'text-blue-400',
    label: 'Info',
    labelColor: 'text-blue-400 bg-blue-500/15',
    title: 'text-blue-300',
  },
  methodological: {
    bg: 'bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/15',
    icon: Sparkles,
    iconColor: 'text-teal-400',
    label: 'Méthodo',
    labelColor: 'text-teal-400 bg-teal-500/15',
    title: 'text-teal-300',
  },
};

function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[advisory.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={`border rounded-lg ${config.bg} cursor-pointer transition-colors`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <Icon className={`w-4 h-4 flex-shrink-0 ${config.iconColor}`} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${config.title}`}>{advisory.title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.labelColor}`}>
            {config.label}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-surface-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1.5 space-y-2 border-t border-white/10">
          <p className="text-sm text-surface-200 leading-relaxed">{advisory.message}</p>
          {advisory.suggestion && (
            <p className="text-sm text-surface-400 italic flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-accent-400" />
              <span>{advisory.suggestion}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdvisoryPanel({ datasetId }: { datasetId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGetDiagnosticsQuery(datasetId);

  if (isLoading) {
    return (
      <div className="ui-panel p-3 text-sm text-surface-400">
        Analyse des diagnostics en cours...
      </div>
    );
  }
  if (!data || data.advisories.length === 0) return null;

  const advisories = data.advisories as Advisory[];
  const criticals = advisories.filter(a => a.severity === 'critical');
  const warnings = advisories.filter(a => a.severity === 'warning');
  const infos = advisories.filter(a => a.severity === 'info' || a.severity === 'methodological');

  const hasCritical = criticals.length > 0;

  return (
    <div className="ui-panel overflow-hidden">
      {/* Header cliquable */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-4 h-4 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`} />
          <h3 className="text-sm font-semibold text-surface-100">
            Diagnostics
            <span className="ml-2 text-xs font-normal text-surface-400 ui-num">({data.count})</span>
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs ui-num">
            {criticals.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                {criticals.length} critique{criticals.length > 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {warnings.length} attention
              </span>
            )}
            {infos.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {infos.length} info
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-4 h-4 text-surface-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Contenu déroulant */}
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/10">
          {criticals.map((a: Advisory, i: number) => <AdvisoryCard key={`c${i}`} advisory={a} />)}
          {warnings.map((a: Advisory, i: number) => <AdvisoryCard key={`w${i}`} advisory={a} />)}
          {infos.map((a: Advisory, i: number) => <AdvisoryCard key={`i${i}`} advisory={a} />)}
        </div>
      )}
    </div>
  );
}
