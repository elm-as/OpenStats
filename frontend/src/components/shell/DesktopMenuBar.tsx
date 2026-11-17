import { useEffect, useRef, useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  shortcut?: string;
  action: string;
  separatorBefore?: boolean;
  desktopOnly?: boolean;
}

interface MenuGroup {
  key: string;
  label: string;
  items: MenuItem[];
}

const MENU_GROUPS: readonly MenuGroup[] = [
  {
    key: 'file',
    label: 'Fichier',
    items: [
      { id: 'data', label: 'Poste Données & Variables', shortcut: 'Alt+1', action: 'navigate:/' },
      { id: 'import', label: 'Importer un jeu de données…', shortcut: 'Ctrl+O', action: 'navigate:/workflow' },
      { id: 'settings', label: 'Paramètres & Diagnostics locaux', action: 'navigate:/settings', separatorBefore: true },
      { id: 'quit', label: 'Quitter OpenStats', shortcut: 'Alt+F4', action: 'window:quit', separatorBefore: true, desktopOnly: true },
    ],
  },
  {
    key: 'analyses',
    label: 'Analyses',
    items: [
      { id: 'explorer', label: 'Explorateur Adaptatif (FDR)', shortcut: 'Alt+3', action: 'navigate:/explorer' },
      { id: 'method', label: 'Méthodologie itérative (11 ét.)', shortcut: 'Alt+4', action: 'navigate:/analyzer' },
      { id: 'studio', label: 'Atelier Statistique Libre', shortcut: 'Alt+Shift+4', action: 'navigate:/analyzer?tab=studio' },
      { id: 'canvas', label: 'Studio Canvas Nodal', shortcut: 'Alt+5', action: 'navigate:/canvas', separatorBefore: true },
      { id: 'recipes', label: 'Recettes & Extensions', shortcut: 'Alt+6', action: 'navigate:/marketplace' },
    ],
  },
  {
    key: 'view',
    label: 'Affichage',
    items: [
      { id: 'theme', label: 'Basculer Thème Clair / Sombre', shortcut: 'Ctrl+Shift+T', action: 'toggle:theme' },
      { id: 'density', label: 'Basculer Densité Compacte / Confortable', shortcut: 'Ctrl+Shift+D', action: 'toggle:density' },
      { id: 'pinned', label: 'Ouvrir / Fermer le Bloc-notes', action: 'toggle:pinned' },
      { id: 'zoomReset', label: 'Zoom par défaut', action: 'window:zoomReset', separatorBefore: true, desktopOnly: true },
      { id: 'zoomIn', label: 'Zoom avant', action: 'window:zoomIn', desktopOnly: true },
      { id: 'zoomOut', label: 'Zoom arrière', action: 'window:zoomOut', desktopOnly: true },
      { id: 'fullscreen', label: 'Plein écran', action: 'window:fullscreen', separatorBefore: true, desktopOnly: true },
      { id: 'devtools', label: 'Console développeur', action: 'window:devtools', desktopOnly: true },
    ],
  },
  {
    key: 'help',
    label: 'Aide',
    items: [
      { id: 'docs', label: 'Guide des analyses (intégré)', shortcut: 'F1', action: 'navigate:/docs' },
      { id: 'palette', label: 'Palette de commandes', shortcut: 'Ctrl+K', action: 'open:palette' },
      { id: 'about', label: 'À propos d’OpenStats Desktop', action: 'window:about', separatorBefore: true, desktopOnly: true },
    ],
  },
];

interface Props {
  isDesktop: boolean;
  onAction: (action: string) => void;
}

/**
 * Barre de menus intégrée dans l'en-tête fenêtre (style logiciel natif Windows/IDE).
 * Remplace la bande Win32 sombre dépareillée lorsque la barre de titre est unifiée.
 */
export default function DesktopMenuBar({ isDesktop, onAction }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenKey(null);
    };
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [openKey]);

  return (
    <div
      ref={barRef}
      role="menubar"
      aria-label="Menu principal"
      className="flex items-center gap-0.5 shrink-0"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      {MENU_GROUPS.map(group => {
        const isOpen = openKey === group.key;
        const visibleItems = group.items.filter(item => !item.desktopOnly || isDesktop);
        return (
          <div key={group.key} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-expanded={isOpen}
              onClick={() => setOpenKey(prev => (prev === group.key ? null : group.key))}
              onMouseEnter={() => { if (openKey && openKey !== group.key) setOpenKey(group.key); }}
              className="ui-focusable px-2 rounded-[var(--ui-radius-sm)] transition-colors"
              style={{
                height: 24,
                fontSize: 'var(--ui-fs-sm)',
                fontWeight: 500,
                background: isOpen ? 'var(--ui-bg-raised)' : 'transparent',
                color: isOpen ? 'var(--ui-text)' : 'var(--ui-text-secondary)',
              }}
            >
              {group.label}
            </button>

            {isOpen && (
              <div
                role="menu"
                className="absolute left-0 top-[calc(100%+2px)] min-w-[260px] py-1 z-50 rounded-[var(--ui-radius)]"
                style={{
                  background: 'var(--ui-bg-overlay)',
                  border: '1px solid var(--ui-border-strong)',
                  boxShadow: 'var(--ui-shadow-md)',
                }}
              >
                {visibleItems.map(item => (
                  <div key={item.id}>
                    {item.separatorBefore && (
                      <div className="my-1" style={{ height: 1, background: 'var(--ui-border)' }} />
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setOpenKey(null); onAction(item.action); }}
                      className="ui-focusable w-full flex items-center justify-between gap-4 px-3 text-left transition-colors hover:bg-[var(--ui-accent-soft)]"
                      style={{ height: 26, fontSize: 'var(--ui-fs-sm)', color: 'var(--ui-text)' }}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.shortcut && (
                        <span className="ui-mono shrink-0" style={{ fontSize: 'var(--ui-fs-xs)', color: 'var(--ui-text-faint)' }}>
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
