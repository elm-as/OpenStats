import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Sparkles, Settings2, Database, Upload, Workflow } from 'lucide-react';
import AutoPipelinePanel from '../components/AutoPipelinePanel';
import InsightsPanel from '../components/InsightsPanel';
import DataPrepPanel from '../components/DataPrepPanel';
import MethodologyPanel from '../components/methodology/MethodologyPanel';
import { useWorkspace } from '../components/shell/useWorkspace';
import { useNavigate } from 'react-router-dom';

const TABS = [
  { key: 'methodology' as const, label: 'Analyse méthodique', icon: Workflow },
  { key: 'overview' as const, label: 'Pipeline automatique', icon: Activity },
  { key: 'insights' as const, label: 'Insights & corrélations', icon: Sparkles },
  { key: 'prep' as const, label: 'Préparation', icon: Settings2 },
];

/**
 * Écran Analyse auto.
 *
 * Le dataset actif vient du châssis : plus de sélecteur local ni de bannière,
 * l'espace est rendu au contenu.
 */
export default function AnalyzerPage() {
  const { active, isLoading, datasets } = useWorkspace();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'methodology' | 'overview' | 'insights' | 'prep'>('methodology');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
        <div
          className="w-5 h-5 rounded-full animate-spin"
          style={{ border: '2px solid var(--ui-border)', borderTopColor: 'var(--ui-accent)' }}
        />
      </div>
    );
  }

  if (datasets.length === 0 || !active) {
    return (
      <div
        className="ui-panel flex flex-col items-center justify-center text-center"
        style={{ minHeight: '46vh', padding: 'var(--ui-gap-5)' }}
      >
        <Database className="w-8 h-8 mb-3" style={{ color: 'var(--ui-text-faint)' }} />
        <p style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700, marginBottom: 4 }}>
          Aucun dataset disponible
        </p>
        <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)', marginBottom: 16 }}>
          Importez un fichier CSV, XLSX ou JSON pour commencer.
        </p>
        <Link to="/workflow" className="ui-btn ui-btn-primary ui-focusable">
          <Upload className="w-3.5 h-3.5" />
          Importer un dataset
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--ui-gap-3)' }}>
      {/* Barre d'onglets de l'écran */}
      <div
        className="ui-panel flex items-center"
        style={{ padding: '0 var(--ui-pad-x)', gap: 'var(--ui-gap-1)', minHeight: 40 }}
        role="tablist"
      >
        {TABS.map(entry => {
          const selected = tab === entry.key;
          return (
            <button
              key={entry.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(entry.key)}
              className="ui-focusable flex items-center gap-1.5 px-2.5 rounded-[var(--ui-radius-sm)]"
              style={{
                height: 'var(--ui-control-h)',
                fontSize: 'var(--ui-fs-sm)',
                fontWeight: 600,
                background: selected ? 'var(--ui-accent-soft)' : 'transparent',
                color: selected ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
              }}
            >
              <entry.icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {tab === 'methodology' && (
        <MethodologyPanel key={active.id} datasetId={active.id} datasetName={active.name} />
      )}

      {tab === 'overview' && (
        <AutoPipelinePanel
          key={active.id}
          datasetId={active.id}
          datasetName={active.name}
          onComplete={execution => {
            if (execution) {
              navigate('/analyzer/results', {
                state: { autoPipelineExecution: execution, datasetId: active.id },
              });
            }
          }}
        />
      )}

      {tab === 'insights' && <InsightsPanel key={active.id} datasetId={active.id} />}
      {tab === 'prep' && <DataPrepPanel key={active.id} datasetId={active.id} />}
    </div>
  );
}
