import { lazy, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity, Sparkles, Settings2, Database, Upload, Workflow, Sliders,
} from 'lucide-react';
import AutoPipelinePanel from '../components/pipeline/AutoPipelinePanel';
import InsightsPanel from '../components/results/InsightsPanel';
import DataPrepPanel from '../components/transform/DataPrepPanel';
import MethodologyPanel from '../components/methodology/MethodologyPanel';
import { useWorkspace } from '../components/shell/useWorkspace';

const AnalysisWizard = lazy(() => import('../components/wizard/AnalysisWizard'));

const TABS = [
  { key: 'methodology', label: 'Analyse méthodique', icon: Workflow },
  { key: 'studio', label: 'Atelier statistique libre', icon: Sliders },
  { key: 'overview', label: 'Pipeline automatique', icon: Activity },
  { key: 'insights', label: 'Insights & corrélations', icon: Sparkles },
  { key: 'prep', label: 'Préparation', icon: Settings2 },
] as const;

type AnalyzerTab = (typeof TABS)[number]['key'];

function isAnalyzerTab(value: string | null): value is AnalyzerTab {
  return value !== null && TABS.some(t => t.key === value);
}

function StudioFallback() {
  return (
    <div className="ui-panel p-6 flex items-center justify-center gap-2.5" style={{ minHeight: '36vh' }}>
      <div
        className="w-4 h-4 rounded-full animate-spin"
        style={{ border: '2px solid var(--ui-border)', borderTopColor: 'var(--ui-accent)' }}
      />
      <span className="text-xs ui-t-muted">Chargement de l’atelier statistique…</span>
    </div>
  );
}

/**
 * Écran Analyse : Méthodologie 11 étapes, Atelier statistique libre
 * (Tests d'hypothèses, Séries temporelles, ACP/AFC, Scénarios, Extensions),
 * Pipeline automatique, Insights & Préparation.
 */
export default function AnalyzerPage() {
  const { active, isLoading, datasets } = useWorkspace();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const tab: AnalyzerTab = isAnalyzerTab(rawTab) ? rawTab : 'methodology';

  const handleSelectTab = (next: AnalyzerTab) => {
    const updated = new URLSearchParams(searchParams);
    if (next === 'methodology') updated.delete('tab');
    else updated.set('tab', next);
    setSearchParams(updated, { replace: true });
  };

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
      <div
        className="ui-panel flex items-center overflow-x-auto no-scrollbar"
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
              onClick={() => handleSelectTab(entry.key)}
              className="ui-focusable flex items-center gap-1.5 px-2.5 rounded-[var(--ui-radius-sm)] shrink-0"
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

      {tab === 'studio' && (
        <Suspense fallback={<StudioFallback />}>
          <AnalysisWizard key={active.id} datasetId={active.id} />
        </Suspense>
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
