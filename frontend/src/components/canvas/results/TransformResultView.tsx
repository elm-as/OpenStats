import React from 'react';
import {
  Zap,
  Info,
  CheckCircle2,
  Database,
  Layers,
} from 'lucide-react';
import { Section, KpiCard, Badge, RenderJson } from './ResultAtoms';

export const InsightsResultView = ({ resultData }: { resultData: any }) => {
  const insights = resultData.insights || [];
  const severityColors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#10b981',
    info: '#3b82f6',
  };
  return (
    <Section title={`${insights.length} insight(s)`} icon={Zap} color="#a855f7">
      <div className="space-y-3">
        {Array.isArray(insights) ? (
          insights.map((ins: any, idx: number) => {
            const sev = ins.severity || ins.type || 'info';
            const col = severityColors[sev] || '#6b7280';
            return (
              <div
                key={idx}
                className="bg-surface-800/40 rounded-xl p-4 border-l-[3px] border border-white/[0.03]"
                style={{ borderLeftColor: col }}
              >
                <div className="flex items-start gap-3">
                  <Info size={16} className="shrink-0 mt-0.5" style={{ color: col }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-surface-100">{ins.title || 'Insight'}</span>
                      <Badge color={col}>{sev}</Badge>
                    </div>
                    <p className="text-xs text-surface-300 leading-relaxed">{ins.description || ins.text}</p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <RenderJson data={resultData} />
        )}
      </div>
    </Section>
  );
};

export const TransformResultView = ({ resultData }: { resultData: any }) => {
  if (Array.isArray(resultData)) {
    return (
      <Section title="Recommandations de transformation" icon={Zap} color="#6366f1">
        <div className="space-y-3">
          {resultData.map((rec: any, idx: number) => {
            const severityColors: Record<string, string> = {
              high: '#ef4444',
              medium: '#f59e0b',
              low: '#10b981',
              info: '#3b82f6',
            };
            const col = severityColors[rec.severity] || '#6b7280';
            return (
              <div
                key={idx}
                className="bg-surface-800/40 rounded-xl p-4 border border-white/[0.03] hover:border-white/10 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-strong">{rec.column}</span>
                    <Badge color={col}>{rec.issue_label || rec.issue}</Badge>
                    <span className="text-[10px] text-muted capitalize">({rec.category})</span>
                  </div>
                  <p className="text-xs text-default">{rec.detail}</p>
                  {Array.isArray(rec.suggested_transforms) && rec.suggested_transforms.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1">
                      <span className="text-[10px] text-muted font-semibold">Transformations suggérées :</span>
                      {rec.suggested_transforms.map((t: string) => (
                        <span
                          key={t}
                          className="text-[10px] font-mono font-bold bg-accent-500/10 text-accent-400 border border-accent-500/20 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    );
  }
  const logs = resultData.logs || [];
  const shape = resultData.shape || {};
  return (
    <Section title="Transformations appliquées" icon={CheckCircle2} color="#10b981">
      <div className="grid grid-cols-2 gap-3 mb-4">
        {shape.rows && <KpiCard label="Lignes après" value={shape.rows} icon={Database} color="#10b981" />}
        {shape.columns && <KpiCard label="Colonnes après" value={shape.columns} icon={Layers} color="#8b5cf6" />}
      </div>
      <div className="space-y-1.5">
        {logs.map((log: string, idx: number) => (
          <div
            key={idx}
            className="bg-surface-800/30 p-2.5 rounded-lg text-xs text-default flex items-center gap-2 border border-white/[0.03]"
          >
            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
            {log}
          </div>
        ))}
      </div>
    </Section>
  );
};

export const ComputeVariableResultView = ({ resultData }: { resultData: any }) => {
  return (
    <Section title="Variable calculée" icon={Layers} color="#8b5cf6">
      <div className="bg-surface-800/40 rounded-xl p-4 border border-white/[0.03] space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Variable créée" value={resultData.column || 'N/A'} icon={Layers} color="#8b5cf6" />
          <KpiCard
            label="Statut"
            value={resultData.success ? 'Succès' : 'Échec'}
            icon={CheckCircle2}
            color={resultData.success ? '#10b981' : '#ef4444'}
          />
        </div>
        {resultData.formula && (
          <div className="bg-black/20 p-3 rounded-lg border border-white/[0.06]">
            <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">
              Formule appliquée
            </div>
            <code className="text-xs font-mono text-accent-300">{resultData.formula}</code>
          </div>
        )}
        {resultData.message && <p className="text-xs text-default">{resultData.message}</p>}
      </div>
    </Section>
  );
};
