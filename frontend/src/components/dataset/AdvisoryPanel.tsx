import { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { useGetDiagnosticsQuery } from '../../store/api';

interface Advisory {
  severity: 'critical' | 'warning' | 'info' | 'methodological';
  category: string;
  title: string;
  message: string;
  suggestion?: string;
}

const SEVERITY_MAP = {
  critical: { icon: AlertCircle, tag: 'ui-tag ui-tag-danger', color: 'var(--ui-danger)', label: 'Critique' },
  warning: { icon: AlertTriangle, tag: 'ui-tag ui-tag-warning', color: 'var(--ui-warning)', label: 'Attention' },
  info: { icon: Info, tag: 'ui-tag ui-tag-info', color: 'var(--ui-info)', label: 'Info' },
  methodological: { icon: CheckCircle2, tag: 'ui-tag ui-tag-ok', color: 'var(--ui-success)', label: 'Méthodo' },
};

function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_MAP[advisory.severity] || SEVERITY_MAP.info;
  const Icon = cfg.icon;

  return (
    <div
      className="ui-panel cursor-pointer transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--ui-text)' }}>
            {advisory.title}
          </span>
          <span className={cfg.tag}>{cfg.label}</span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 ui-t-faint shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </div>
      {expanded && (
        <div className="px-3 pb-2.5 pt-2 space-y-1.5" style={{ borderTop: '1px solid var(--ui-border)' }}>
          <p className="text-xs ui-t-secondary leading-relaxed">{advisory.message}</p>
          {advisory.suggestion && (
            <p className="text-xs ui-t-muted italic">{advisory.suggestion}</p>
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
    return <div className="ui-panel p-2.5 text-xs ui-t-muted">Analyse des diagnostics…</div>;
  }
  if (!data || data.advisories.length === 0) return null;

  const advisories = data.advisories as Advisory[];
  const criticals = advisories.filter(a => a.severity === 'critical');
  const warnings = advisories.filter(a => a.severity === 'warning');
  const infos = advisories.filter(a => a.severity === 'info' || a.severity === 'methodological');

  return (
    <div className="ui-panel overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className="w-3.5 h-3.5"
            style={{ color: criticals.length > 0 ? 'var(--ui-danger)' : 'var(--ui-warning)' }}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--ui-text)' }}>
            Diagnostics <span className="ui-t-muted ui-num">({data.count})</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 ui-num">
          {criticals.length > 0 && <span className="ui-tag ui-tag-danger">{criticals.length} crit.</span>}
          {warnings.length > 0 && <span className="ui-tag ui-tag-warning">{warnings.length} att.</span>}
          {infos.length > 0 && <span className="ui-tag ui-tag-info">{infos.length} info</span>}
          <ChevronDown
            className={`w-3.5 h-3.5 ui-t-faint transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="p-2.5 space-y-1.5" style={{ borderTop: '1px solid var(--ui-border)' }}>
          {criticals.map((a, i) => <AdvisoryCard key={`c${i}`} advisory={a} />)}
          {warnings.map((a, i) => <AdvisoryCard key={`w${i}`} advisory={a} />)}
          {infos.map((a, i) => <AdvisoryCard key={`i${i}`} advisory={a} />)}
        </div>
      )}
    </div>
  );
}
