import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Database, ChevronDown, Search, Check, Upload, Command, Sun, Moon,
  Rows3, Rows4, RefreshCw, Monitor,
} from 'lucide-react';
import logoOS from '../../assets/logoOS.png';
import type { DatasetSummary } from '../../types';

interface Props {
  datasets: DatasetSummary[];
  active: DatasetSummary | null;
  isFetching: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onOpenPalette: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  density: 'compact' | 'comfortable';
  onToggleDensity: () => void;
}

/**
 * Barre de contexte : elle répond en permanence à « sur quoi je travaille ? ».
 *
 * C'est le seul sélecteur de dataset de l'application ; les écrans consomment
 * le contexte au lieu de proposer chacun le leur.
 */
export default function ContextBar({
  datasets, active, isFetching, onSelect, onRefresh, onOpenPalette,
  theme, onToggleTheme, density, onToggleDensity,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

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
      className="flex items-center gap-2 px-2 shrink-0"
      style={{
        height: 'var(--ui-topbar-h)',
        background: 'var(--ui-bg-panel)',
        borderBottom: '1px solid var(--ui-border)',
      }}
    >
      <Link to="/" className="ui-focusable flex items-center gap-2 pl-1 pr-2 shrink-0" title="OpenStats">
        <img src={logoOS} alt="" className="w-[18px] h-[18px] object-contain" />
        <span className="hidden md:block" style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 800, letterSpacing: '-0.01em' }}>
          OpenStats
        </span>
      </Link>

      <span className="ui-sep" aria-hidden />

      {/* ── Sélecteur de dataset : le contexte de travail ── */}
      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => { setOpen(o => !o); setQuery(''); }}
          className="ui-focusable flex items-center gap-2 rounded-[var(--ui-radius-sm)] px-2 max-w-[340px]"
          style={{
            height: 'var(--ui-control-h)',
            background: open ? 'var(--ui-bg-raised)' : 'transparent',
            border: '1px solid var(--ui-border)',
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <Database className="w-[13px] h-[13px] shrink-0" style={{ color: 'var(--ui-accent)' }} />
          <span
            className="truncate"
            style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 700, color: 'var(--ui-text)' }}
          >
            {active?.name ?? 'Aucun dataset'}
          </span>
          <ChevronDown
            className="w-[13px] h-[13px] shrink-0"
            style={{ color: 'var(--ui-text-faint)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.12s' }}
          />
        </button>

        {open && (
          <div
            className="absolute left-0 top-[calc(100%+4px)] w-[360px] rounded-[var(--ui-radius)] overflow-hidden z-50"
            style={{
              background: 'var(--ui-bg-overlay)',
              border: '1px solid var(--ui-border-strong)',
              boxShadow: 'var(--ui-shadow-lg)',
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

            <ul className="max-h-[320px] overflow-y-auto ui-scroll py-1">
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

      {/* ── Métadonnées du dataset actif, toujours visibles ── */}
      {active && (
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="ui-tag ui-tag-neutral ui-num">
            {active.shape.rows.toLocaleString('fr-FR')} × {active.shape.columns}
          </span>
          {active.versions_count != null && active.versions_count > 1 && (
            <span className="ui-tag ui-tag-neutral">v{active.versions_count}</span>
          )}
        </div>
      )}

      <button
        onClick={onRefresh}
        className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable shrink-0"
        title="Rafraîchir la liste des datasets"
        aria-label="Rafraîchir"
      >
        <RefreshCw className={`w-[13px] h-[13px] ${isFetching ? 'animate-spin' : ''}`} />
      </button>

      <div className="flex-1" />

      {/* ── Commandes ── */}
      <button
        onClick={onOpenPalette}
        className="ui-focusable hidden sm:flex items-center gap-1.5 rounded-[var(--ui-radius-sm)] px-2"
        style={{
          height: 'var(--ui-control-h)',
          background: 'var(--ui-bg-input)',
          border: '1px solid var(--ui-border)',
          color: 'var(--ui-text-muted)',
          fontSize: 'var(--ui-fs-sm)',
        }}
        title="Palette de commandes"
      >
        <Command className="w-3 h-3" />
        <span>Commandes</span>
        <kbd
          className="ui-mono ml-1 px-1 rounded"
          style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}
        >
          Ctrl K
        </kbd>
      </button>

      <span className="ui-sep hidden sm:block" aria-hidden />

      <button
        onClick={onToggleDensity}
        className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
        title={density === 'compact' ? 'Passer en densité confortable' : 'Passer en densité compacte'}
        aria-label="Changer la densité"
      >
        {density === 'compact' ? <Rows4 className="w-[13px] h-[13px]" /> : <Rows3 className="w-[13px] h-[13px]" />}
      </button>

      <button
        onClick={onToggleTheme}
        className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
        title={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
        aria-label="Changer de thème"
      >
        {theme === 'dark' ? <Sun className="w-[13px] h-[13px]" /> : <Moon className="w-[13px] h-[13px]" />}
      </button>

      <span
        className="ui-tag ui-tag-success hidden xl:inline-flex mr-1"
        title="Traitement effectué sur cette machine"
      >
        <Monitor className="w-3 h-3" />
        Local
      </span>
    </header>
  );
}
