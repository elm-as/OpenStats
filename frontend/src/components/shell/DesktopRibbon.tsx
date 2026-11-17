import { Link, useLocation } from 'react-router-dom';
import {
  Table2, FileSpreadsheet, Compass, Workflow, Sliders, Network,
  Store, Upload, BookOpen, Settings,
} from 'lucide-react';

interface RibbonTab {
  key: string;
  label: string;
  hint: string;
  icon: typeof Table2;
  path: string;
}

interface Props {
  activeDatasetId: string | null;
  buildHref: (path: string) => string;
}

const RIBBON_TABS: readonly RibbonTab[] = [
  { key: 'data', label: 'Données', hint: 'Tableur & variables du jeu actif', icon: Table2, path: '/' },
  { key: 'prep', label: 'Typage & Nettoyage', hint: 'Profilage, types statistiques & versions', icon: FileSpreadsheet, path: '/workflow' },
  { key: 'explorer', label: 'Explorateur FDR', hint: 'Sondes adaptatives & contrôle Benjamini-Hochberg', icon: Compass, path: '/explorer' },
  { key: 'methodology', label: 'Méthodologie (11 ét.)', hint: 'Pipeline guidé, remédiations & benchmark', icon: Workflow, path: '/analyzer' },
  { key: 'studio', label: 'Tests, Séries & Modèles', hint: 'Tests d’hypothèses, OLS/Panel, ACP, ARIMA/VAR, Python/R', icon: Sliders, path: '/analyzer?tab=studio' },
  { key: 'canvas', label: 'Canvas Nodal', hint: 'Graphe visuel DuckDB & export code', icon: Network, path: '/canvas' },
  { key: 'marketplace', label: 'Recettes', hint: 'Modèles réutilisables & extensions', icon: Store, path: '/marketplace' },
];

function resolveRibbonPath(tab: RibbonTab, datasetId: string | null): string {
  if (tab.key === 'prep' && datasetId) {
    return `/workflow/${encodeURIComponent(datasetId)}/profile`;
  }
  return tab.path;
}

function isRibbonTabActive(key: string, pathname: string, search: string): boolean {
  const inAnalyzer = pathname.startsWith('/analyzer');
  const isStudioSub = inAnalyzer && search.includes('tab=') && !search.includes('tab=methodology');
  if (key === 'data') return pathname === '/';
  if (key === 'prep') return pathname.startsWith('/workflow');
  if (key === 'explorer') return pathname.startsWith('/explorer');
  if (key === 'studio') return isStudioSub;
  if (key === 'methodology') return inAnalyzer && !isStudioSub;
  if (key === 'canvas') return pathname.startsWith('/canvas');
  if (key === 'marketplace') return pathname.startsWith('/marketplace');
  return false;
}

/**
 * Ruban logiciel d'analyses (inspiration Jamovi).
 * Donne un accès direct en un clic aux modules d'exploration, tests, modèles et canvas.
 */
export default function DesktopRibbon({ activeDatasetId, buildHref }: Props) {
  const { pathname, search } = useLocation();

  return (
    <div
      className="flex items-center gap-1 px-2 shrink-0 overflow-x-auto no-scrollbar select-none"
      style={{
        height: 36,
        background: 'var(--ui-bg-sunken)',
        borderBottom: '1px solid var(--ui-border)',
      }}
      role="navigation"
      aria-label="Ruban des modules statistiques"
    >
      <div className="flex items-center gap-0.5 min-w-0">
        {RIBBON_TABS.map(tab => {
          const active = isRibbonTabActive(tab.key, pathname, search);
          const Icon = tab.icon;
          const target = buildHref(resolveRibbonPath(tab, activeDatasetId));

          return (
            <Link
              key={tab.key}
              to={target}
              title={tab.hint}
              className="ui-focusable flex items-center gap-1.5 px-2.5 rounded-[var(--ui-radius-sm)] shrink-0 transition-colors"
              style={{
                height: 26,
                fontSize: 'var(--ui-fs-sm)',
                fontWeight: active ? 700 : 600,
                background: active ? 'var(--ui-bg-panel)' : 'transparent',
                color: active ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                border: active ? '1px solid var(--ui-border-strong)' : '1px solid transparent',
              }}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: active ? 'var(--ui-accent)' : 'var(--ui-text-muted)' }} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex-1 min-w-[12px]" />

      <div className="flex items-center gap-1 shrink-0">
        <Link
          to="/workflow"
          className="ui-btn ui-focusable"
          style={{ height: 26, padding: '0 8px' }}
          title="Importer un nouveau fichier (CSV, XLSX, JSON, Parquet)"
        >
          <Upload className="w-3 h-3" />
          <span className="hidden lg:inline">Importer</span>
        </Link>

        <Link
          to="/docs"
          className="ui-btn ui-btn-ghost ui-focusable"
          style={{
            height: 26,
            padding: '0 8px',
            color: pathname.startsWith('/docs') ? 'var(--ui-accent-text)' : undefined,
          }}
          title="Guide des méthodes statistiques (F1)"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Guide</span>
        </Link>

        <Link
          to="/settings"
          className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
          style={{
            width: 26,
            height: 26,
            color: pathname.startsWith('/settings') ? 'var(--ui-accent-text)' : undefined,
          }}
          title="Paramètres & diagnostics locaux"
          aria-label="Paramètres"
        >
          <Settings className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
