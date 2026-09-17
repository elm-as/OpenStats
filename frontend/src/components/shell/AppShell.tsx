import { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import ContextBar from './ContextBar';
import NavRail, { NAV_ENTRIES } from './NavRail';
import CommandPalette from './CommandPalette';
import StatusBar, { StatusProvider } from './StatusBar';
import { useWorkspace } from './useWorkspace';
import { PinnedDrawer } from '../common/PinnedDrawer';

type Theme = 'dark' | 'light';
type Density = 'compact' | 'comfortable';

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Châssis applicatif : barre de contexte, rail de navigation, zone de travail,
 * barre de statut, palette de commandes.
 *
 * Les écrans n'ont plus à gérer ni le choix du dataset, ni leur propre en-tête
 * de navigation : ils reçoivent une zone de travail et publient leur état dans
 * la barre de statut via `useStatus()`.
 */
export default function AppShell() {
  const navigate = useNavigate();
  const workspace = useWorkspace();

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = readStored<Theme>('theme', ['dark', 'light'], 'dark');
    if (typeof window !== 'undefined' && !localStorage.getItem('theme')) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return stored;
  });

  const [density, setDensity] = useState<Density>(() =>
    readStored<Density>('density', ['compact', 'comfortable'],
      typeof window !== 'undefined' && window.innerWidth >= 1600 ? 'comfortable' : 'compact'),
  );

  const [railExpanded, setRailExpanded] = useState(() =>
    readStored('rail', ['open', 'closed'], 'open') === 'open');

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* ignoré */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try { localStorage.setItem('density', density); } catch { /* ignoré */ }
  }, [density]);

  useEffect(() => {
    try { localStorage.setItem('rail', railExpanded ? 'open' : 'closed'); } catch { /* ignoré */ }
  }, [railExpanded]);

  const buildHref = useCallback(
    (path: string) => (workspace.activeId ? `${path}?dataset=${encodeURIComponent(workspace.activeId)}` : path),
    [workspace.activeId],
  );

  const goTo = useCallback((path: string) => navigate(buildHref(path)), [navigate, buildHref]);

  // ── Raccourcis clavier globaux ──
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(open => !open);
        return;
      }

      if (typing) return;

      // Alt+chiffre : accès direct aux écrans.
      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const entry = NAV_ENTRIES.find(item => item.shortcut === event.key);
        if (entry) {
          event.preventDefault();
          goTo(entry.path);
        }
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setRailExpanded(open => !open);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo]);

  return (
    <StatusProvider>
      <div className="ui-root h-screen flex flex-col overflow-hidden">
        <ContextBar
          datasets={workspace.datasets}
          active={workspace.active}
          isFetching={workspace.isFetching}
          onSelect={workspace.selectDataset}
          onRefresh={workspace.refetch}
          onOpenPalette={() => setPaletteOpen(true)}
          theme={theme}
          onToggleTheme={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          density={density}
          onToggleDensity={() => setDensity(d => (d === 'compact' ? 'comfortable' : 'compact'))}
        />

        <div className="flex-1 flex min-h-0">
          <NavRail
            pathname={workspace.pathname}
            expanded={railExpanded}
            onToggle={() => setRailExpanded(open => !open)}
            buildHref={buildHref}
          />

          <main
            className="flex-1 min-w-0 overflow-y-auto ui-scroll"
            style={{ background: 'var(--ui-bg-app)' }}
          >
            <div style={{ padding: 'var(--ui-gap-4)', maxWidth: 1680, margin: '0 auto' }}>
              <Outlet />
            </div>
          </main>
        </div>

        <StatusBar
          datasetLabel={workspace.active?.name ?? null}
          rows={workspace.active?.shape.rows}
          columns={workspace.active?.shape.columns}
        />

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          datasets={workspace.datasets}
          activeId={workspace.activeId}
          onSelectDataset={workspace.selectDataset}
          onNavigate={goTo}
        />

        <PinnedDrawer />
      </div>
    </StatusProvider>
  );
}
