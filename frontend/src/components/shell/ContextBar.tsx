import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, ChevronDown, Search, Check, Upload, Command, Sun, Moon,
  Rows3, Rows4, RefreshCw, Bookmark,
} from 'lucide-react';
import logoOS from '../../assets/logoOS.png';
import type { DatasetSummary } from '../../types';
import DesktopMenuBar from './DesktopMenuBar';

interface Props {
  datasets: DatasetSummary[];
  active: DatasetSummary | null;
  isFetching: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onOpenPalette: () => void;
  onMenuAction: (action: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  density: 'compact' | 'comfortable';
  onToggleDensity: () => void;
  pinnedCount?: number;
  onTogglePinned?: () => void;
}

const NO_DRAG = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

/**
 * Barre de titre et de contexte unifiée (style logiciel natif).
 * Regroupe menus applicatifs, dataset actif, outils rapides et zone de déplacement fenêtre.
 */
export default function ContextBar({
  datasets, active, isFetching, onSelect, onRefresh, onOpenPalette, onMenuAction,
  theme, onToggleTheme, density, onToggleDensity, pinnedCount = 0, onTogglePinned,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const isDesktop = typeof window !== 'undefined'
    && Boolean((window as unknown as { electronAPI?: { isDesktop?: boolean } }).electronAPI?.isDesktop);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? datasets.filter(d => d.name.toLowerCase().includes(q)) : datasets;
  }, [datasets, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <header
      className="flex items-center gap-1.5 pl-2 shrink-0"
      style={{
        height: 'var(--ui-topbar-h)',
        paddingRight: isDesktop ? 142 : 8,
        background: 'var(--ui-bg-sunken)',
        borderBottom: '1px solid var(--ui-border)',
        ...(isDesktop ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined),
      }}
    >
      <Link
        to="/"
        className="ui-focusable flex items-center gap-1.5 px-1 shrink-0"
        title="OpenStats"
        style={NO_DRAG}
      >
        <img src={logoOS} alt="OpenStats" className="w-4 h-4 object-contain" />
        {!isDesktop && (
          <span className="hidden md:block" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 700 }}>
            OpenStats
          </span>
        )}
      </Link>

      <DesktopMenuBar isDesktop={isDesktop} onAction={onMenuAction} />

      <span className="ui-sep mx-0.5" aria-hidden />

      {/* ── Sélecteur de dataset actif ── */}
      <div className="relative flex items-center gap-1" ref={popoverRef} style={NO_DRAG}>
        <button
          onClick={() => { setOpen(o => !o); setQuery(''); }}
          className="ui-focusable flex items-center gap-1.5 rounded-[var(--ui-radius-sm)] px-2 max-w-[320px] hover:bg-[var(--ui-bg-raised)] transition-colors"
          style={{
            height: 24,
            background: open ? 'var(--ui-bg-raised)' : 'transparent',
            border: open ? '1px solid var(--ui-border-strong)' : '1px solid var(--ui-border)',
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Database className="w-3 h-3 shrink-0" style={{ color: 'var(--ui-accent)' }} />
          <span
            className="truncate"
            style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600, color: 'var(--ui-text)' }}
          >
            {active?.name ?? 'Aucun dataset'}
          </span>
          {active && (
            <span className="hidden lg:inline ui-num shrink-0" style={{ fontSize: 'var(--ui-fs-xs)', color: 'var(--ui-text-faint)' }}>
              · {active.shape.rows.toLocaleString('fr-FR')}×{active.shape.columns}
              {active.versions_count != null && active.versions_count > 1 ? ` · v${active.versions_count}` : ''}
            </span>
          )}
          <ChevronDown
            className="w-3 h-3 shrink-0"
            style={{ color: 'var(--ui-text-faint)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.12s' }}
          />
        </button>

        <button
          onClick={onRefresh}
          className="ui-btn ui-btn-ghost ui-focusable shrink-0"
          style={{ width: 24, height: 24, padding: 0 }}
          title="Rafraîchir les datasets"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
        </button>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+3px)] w-[350px] rounded-[var(--ui-radius)] overflow-hidden z-50"
            style={{
              background: 'var(--ui-bg-overlay)',
              border: '1px solid var(--ui-border-strong)',
              boxShadow: 'var(--ui-shadow-md)',
            }}
            role="listbox"
          >
            <div className="p-1.5" style={{ borderBottom: '1px solid var(--ui-border)' }}>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--ui-text-faint)' }} />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filtrer les datasets…"
                  className="ui-input w-full"
                  style={{ paddingLeft: 24 }}
                />
              </div>
            </div>

            <ul className="max-h-[300px] overflow-y-auto ui-scroll py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)' }}>
                  Aucun dataset ne correspond
                </li>
              ) : (
                filtered.map(ds => (
                  <li key={ds.id}>
                    <button
                      onClick={() => { onSelect(ds.id); setOpen(false); }}
                      className="ui-focusable w-full flex items-center gap-2 px-2.5 text-left"
                      style={{
                        height: 'var(--ui-row-h)',
                        background: ds.id === active?.id ? 'var(--ui-accent-soft)' : 'transparent',
                      }}
                      role="option"
                      aria-selected={ds.id === active?.id}
                    >
                      <span className="flex-1 min-w-0 truncate" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600 }}>
                        {ds.name}
                      </span>
                      <span className="ui-num shrink-0" style={{ fontSize: 'var(--ui-fs-xs)', color: 'var(--ui-text-faint)' }}>
                        {ds.shape.rows.toLocaleString('fr-FR')}×{ds.shape.columns}
                      </span>
                      {ds.id === active?.id && (
                        <Check className="w-3 h-3 shrink-0" style={{ color: 'var(--ui-accent)' }} />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="p-1.5" style={{ borderTop: '1px solid var(--ui-border)' }}>
              <Link to="/workflow" onClick={() => setOpen(false)} className="ui-btn w-full ui-focusable">
                <Upload className="w-3 h-3" />
                Importer un dataset
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-[24px]" />

      {/* ── Outils poste de travail ── */}
      <div className="flex items-center gap-0.5 shrink-0" style={NO_DRAG}>
        <button
          onClick={onOpenPalette}
          className="ui-btn ui-btn-ghost ui-focusable hidden sm:inline-flex px-2"
          style={{ height: 24 }}
          title="Palette de commandes (Ctrl+K)"
        >
          <Command className="w-3 h-3" />
          <span className="hidden xl:inline">Commandes</span>
          <kbd className="ui-mono" style={{ color: 'var(--ui-text-faint)' }}>Ctrl+K</kbd>
        </button>

        <button
          onClick={onToggleDensity}
          className="ui-btn ui-btn-ghost ui-focusable"
          style={{ width: 24, height: 24, padding: 0 }}
          title={density === 'compact' ? 'Densité confortable' : 'Densité compacte'}
          aria-label="Changer la densité"
        >
          {density === 'compact' ? <Rows4 className="w-3.5 h-3.5" /> : <Rows3 className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={onToggleTheme}
          className="ui-btn ui-btn-ghost ui-focusable"
          style={{ width: 24, height: 24, padding: 0 }}
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          aria-label="Changer de thème"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>

        {onTogglePinned && (
          <button
            onClick={onTogglePinned}
            className="ui-btn ui-btn-ghost ui-focusable px-2"
            style={{
              height: 24,
              color: pinnedCount > 0 ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
              background: pinnedCount > 0 ? 'var(--ui-accent-soft)' : 'transparent',
            }}
            title="Carnet de bord de l’analyste"
            aria-label="Carnet de bord de l’analyste"
          >
            <Bookmark className="w-3 h-3" />
            <span className="hidden md:inline">Bloc-notes</span>
            {pinnedCount > 0 && <span className="ui-mono ui-num">{pinnedCount}</span>}
          </button>
        )}
      </div>
    </header>
  );
}
