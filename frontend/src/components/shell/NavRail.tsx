import { Link } from 'react-router-dom';
import {
  Home, Play, Network, Sparkles, Compass, Store, FileText, Settings,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

export interface NavEntry {
  label: string;
  hint: string;
  icon: typeof Home;
  path: string;
  match: (pathname: string) => boolean;
  shortcut?: string;
}

export const NAV_ENTRIES: NavEntry[] = [
  { label: 'Accueil', hint: 'Vue d’ensemble et bibliothèque', icon: Home, path: '/', match: p => p === '/', shortcut: '1' },
  { label: 'Import & Préparation', hint: 'Charger, profiler, nettoyer', icon: Play, path: '/workflow', match: p => p.startsWith('/workflow'), shortcut: '2' },
  { label: 'Explorateur', hint: 'Recherche adaptative de résultats', icon: Compass, path: '/explorer', match: p => p.startsWith('/explorer'), shortcut: '3' },
  { label: 'Analyse auto', hint: 'Pipeline automatique', icon: Sparkles, path: '/analyzer', match: p => p.startsWith('/analyzer'), shortcut: '4' },
  { label: 'Canvas', hint: 'Pipeline nodal', icon: Network, path: '/canvas', match: p => p.startsWith('/canvas'), shortcut: '5' },
  { label: 'Marketplace', hint: 'Modèles de pipelines', icon: Store, path: '/marketplace', match: p => p.startsWith('/marketplace'), shortcut: '6' },
];

const FOOTER_ENTRIES: NavEntry[] = [
  { label: 'Documentation', hint: 'Aide et références', icon: FileText, path: '/docs', match: p => p.startsWith('/docs') },
  { label: 'Paramètres', hint: 'Configuration', icon: Settings, path: '/settings', match: p => p.startsWith('/settings') },
];

interface Props {
  pathname: string;
  expanded: boolean;
  onToggle: () => void;
  buildHref: (path: string) => string;
}

export default function NavRail({ pathname, expanded, onToggle, buildHref }: Props) {
  return (
    <nav
      className="flex flex-col shrink-0 h-full"
      style={{
        width: expanded ? 'var(--ui-rail-w-open)' : 'var(--ui-rail-w)',
        background: 'var(--ui-bg-sunken)',
        borderRight: '1px solid var(--ui-border)',
        transition: 'width 0.14s ease',
      }}
      aria-label="Navigation principale"
    >
      <ul className="flex-1 py-1.5 px-1.5 space-y-0.5 overflow-y-auto ui-scroll">
        {NAV_ENTRIES.map(entry => (
          <RailItem key={entry.path} entry={entry} pathname={pathname} expanded={expanded} buildHref={buildHref} />
        ))}
      </ul>

      <ul className="py-1.5 px-1.5 space-y-0.5" style={{ borderTop: '1px solid var(--ui-border)' }}>
        {FOOTER_ENTRIES.map(entry => (
          <RailItem key={entry.path} entry={entry} pathname={pathname} expanded={expanded} buildHref={buildHref} />
        ))}
        <li>
          <button
            onClick={onToggle}
            className="ui-focusable w-full flex items-center gap-2.5 rounded-[var(--ui-radius-sm)] px-2"
            style={{ height: 'var(--ui-control-h)', color: 'var(--ui-text-faint)' }}
            title={expanded ? 'Replier le menu' : 'Déplier le menu'}
            aria-label={expanded ? 'Replier le menu' : 'Déplier le menu'}
          >
            {expanded
              ? <PanelLeftClose className="w-[15px] h-[15px] shrink-0" />
              : <PanelLeftOpen className="w-[15px] h-[15px] shrink-0" />}
            {expanded && <span style={{ fontSize: 'var(--ui-fs-sm)' }}>Replier</span>}
          </button>
        </li>
      </ul>
    </nav>
  );
}

function RailItem({
  entry, pathname, expanded, buildHref,
}: { entry: NavEntry; pathname: string; expanded: boolean; buildHref: (p: string) => string }) {
  const active = entry.match(pathname);
  const Icon = entry.icon;

  return (
    <li>
      <Link
        to={buildHref(entry.path)}
        title={expanded ? entry.hint : `${entry.label} — ${entry.hint}`}
        aria-current={active ? 'page' : undefined}
        className="ui-focusable relative flex items-center gap-2.5 rounded-[var(--ui-radius-sm)] px-2"
        style={{
          height: 'var(--ui-control-h)',
          background: active ? 'var(--ui-accent-soft)' : 'transparent',
          color: active ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
        }}
      >
        {/* Repère d'onglet actif, lisible même quand le rail est replié. */}
        {active && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
            style={{ width: 2, height: 16, background: 'var(--ui-accent)' }}
          />
        )}
        <Icon className="w-[15px] h-[15px] shrink-0" />
        {expanded && (
          <span className="truncate" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600 }}>
            {entry.label}
          </span>
        )}
      </Link>
    </li>
  );
}
