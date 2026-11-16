import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ContextBar from './ContextBar';
import DesktopRibbon from './DesktopRibbon';
import { NAV_ENTRIES } from './NavRail';
import CommandPalette, { type Command } from './CommandPalette';
import StatusBar, { StatusProvider } from './StatusBar';
import { useWorkspace } from './useWorkspace';
import { PinnedDrawer } from './PinnedDrawer';
import type { RootState } from '../../store';
import { togglePinnedDrawer } from '../../store/slices/pinnedNotesSlice';

type Theme = 'dark' | 'light';
type Density = 'compact' | 'comfortable';

interface ElectronBridge {
  isDesktop?: boolean;
  on?: (channel: string, handler: (action: string) => void) => (() => void) | void;
}

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
 * Châssis applicatif bureau : barre de contexte, ruban d'analyses,
 * rail latéral compact, zone de travail pleine fenêtre et barre de statut.
 */
export default function AppShell() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const workspace = useWorkspace();
  const pinnedCount = useSelector((state: RootState) => state.pinnedNotes.items.length);

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
    const syncPreferences = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: Theme; density?: Density }>).detail;
      if (detail?.theme) setTheme(detail.theme);
      if (detail?.density) setDensity(detail.density);
    };
    window.addEventListener('openstats:preferences', syncPreferences);
    return () => window.removeEventListener('openstats:preferences', syncPreferences);
  }, []);

  const buildHref = useCallback(
    (path: string) => {
      if (!workspace.activeId) return path;
      const sep = path.includes('?') ? '&' : '?';
      return `${path}${sep}dataset=${encodeURIComponent(workspace.activeId)}`;
    },
    [workspace.activeId],
  );

  const goTo = useCallback((path: string) => navigate(buildHref(path)), [navigate, buildHref]);

  const handleMenuAction = useCallback((action: string) => {
    if (action.startsWith('navigate:')) {
      goTo(action.slice('navigate:'.length));
      return;
    }
    if (action === 'toggle:theme') {
      setTheme(t => (t === 'dark' ? 'light' : 'dark'));
      return;
    }
    if (action === 'toggle:density') {
      setDensity(d => (d === 'compact' ? 'comfortable' : 'compact'));
      return;
    }
    if (action === 'toggle:pinned') {
      dispatch(togglePinnedDrawer());
      return;
    }
    if (action === 'open:palette') {
      setPaletteOpen(true);
    }
  }, [goTo, dispatch]);

  useEffect(() => {
    const bridge = (window as unknown as { electronAPI?: ElectronBridge }).electronAPI;
    if (!bridge?.on) return undefined;
    const unsubscribe = bridge.on('openstats:menu-action', handleMenuAction);
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [handleMenuAction]);

  const extraCommands = useMemo<Command[]>(() => [
    {
      id: 'studio:wizard',
      group: 'Outils rapides',
      label: 'Atelier statistique libre (Tests, Séries, R/Python)',
      hint: 'Tests d’hypothèses, graphiques, ACP/AFC, scénarios & extensions',
      keywords: 'wizard test chi2 anova acp afc scenario monte carlo monaco',
      run: () => goTo('/analyzer?tab=studio'),
    },
    {
      id: 'pref:theme',
      group: 'Préférences',
      label: theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre',
      hint: 'Ajuste instantanément la lisibilité du poste de travail',
      keywords: 'theme light dark clair sombre',
      run: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
    },
    {
      id: 'pref:density',
      group: 'Préférences',
      label: density === 'compact' ? 'Passer en densité confortable' : 'Passer en densité compacte',
      hint: 'Adapte l’espacement des tableaux et panneaux',
      keywords: 'density compact comfortable espacement',
      run: () => setDensity(d => (d === 'compact' ? 'comfortable' : 'compact')),
    },
    {
      id: 'drawer:pinned',
      group: 'Outils rapides',
      label: 'Ouvrir le Carnet de bord de l’Analyste',
      hint: `${pinnedCount} élément${pinnedCount > 1 ? 's' : ''} épinglé${pinnedCount > 1 ? 's' : ''}`,
      keywords: 'notes bookmark memo markdown',
      run: () => dispatch(togglePinnedDrawer()),
    },
  ], [goTo, theme, density, pinnedCount, dispatch]);

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

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 't') {
        event.preventDefault();
        setTheme(t => (t === 'dark' ? 'light' : 'dark'));
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setDensity(d => (d === 'compact' ? 'comfortable' : 'compact'));
        return;
      }

      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const entry = NAV_ENTRIES.find(item => item.shortcut === event.key);
        if (entry) {
          event.preventDefault();
          goTo(entry.path);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo]);

  const isFullBleed = workspace.pathname === '/' || workspace.pathname.startsWith('/canvas');

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
          pinnedCount={pinnedCount}
          onTogglePinned={() => dispatch(togglePinnedDrawer())}
        />

        <DesktopRibbon activeDatasetId={workspace.activeId} buildHref={buildHref} />

        <div className="flex-1 flex min-h-0">
          {isFullBleed ? (
            <main
              className="flex-1 min-w-0 flex flex-col overflow-hidden relative"
              style={{ background: 'var(--ui-bg-app)' }}
            >
              <Outlet />
            </main>
          ) : (
            <main
              className="flex-1 min-w-0 overflow-y-auto ui-scroll"
              style={{ background: 'var(--ui-bg-app)' }}
            >
              <div style={{ padding: 'var(--ui-gap-3)', width: '100%' }}>
                <Outlet />
              </div>
            </main>
          )}
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
          extraCommands={extraCommands}
        />

        <PinnedDrawer />
      </div>
    </StatusProvider>
  );
}
