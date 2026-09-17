import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { NAV_ENTRIES } from './NavRail';
import type { DatasetSummary } from '../../types';

export interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  datasets: DatasetSummary[];
  activeId: string | null;
  onSelectDataset: (id: string) => void;
  onNavigate: (path: string) => void;
  extraCommands?: Command[];
}

/**
 * Palette de commandes (Ctrl/Cmd+K).
 *
 * Donne un accès clavier à la navigation, au changement de dataset et aux
 * actions contextuelles — ce qui distingue un outil d'une suite de pages.
 */
export default function CommandPalette({
  open, onClose, datasets, activeId, onSelectDataset, onNavigate, extraCommands = [],
}: Props) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navigation = NAV_ENTRIES.map(entry => ({
      id: `nav:${entry.path}`,
      group: 'Aller à',
      label: entry.label,
      hint: entry.hint,
      keywords: entry.path,
      shortcut: entry.shortcut ? `Alt ${entry.shortcut}` : undefined,
      run: () => onNavigate(entry.path),
    }));

    const switching = datasets.map(ds => ({
      id: `ds:${ds.id}`,
      group: 'Dataset actif',
      label: ds.name,
      hint: `${ds.shape.rows.toLocaleString('fr-FR')} lignes × ${ds.shape.columns} colonnes`
        + (ds.id === activeId ? ' — actif' : ''),
      keywords: ds.id,
      run: () => onSelectDataset(ds.id),
    }));

    return [...extraCommands, ...navigation, ...switching];
  }, [datasets, activeId, onNavigate, onSelectDataset, extraCommands]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => { setCursor(0); }, [query, open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Garde l'élément sélectionné visible pendant la navigation au clavier.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[cursor];
      if (chosen) { chosen.run(); onClose(); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: 'rgba(2, 6, 16, 0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      <div
        className="w-full max-w-[560px] rounded-[var(--ui-radius-lg)] overflow-hidden"
        style={{
          background: 'var(--ui-bg-overlay)',
          border: '1px solid var(--ui-border-strong)',
          boxShadow: 'var(--ui-shadow-lg)',
        }}
      >
        <div className="flex items-center gap-2 px-3" style={{ height: 42, borderBottom: '1px solid var(--ui-border)' }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ui-text-faint)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Rechercher une commande, un écran, un dataset…"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 'var(--ui-fs-md)', color: 'var(--ui-text)' }}
            aria-label="Rechercher une commande"
          />
          <kbd className="ui-mono px-1 rounded shrink-0" style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)', color: 'var(--ui-text-faint)' }}>
            Échap
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[46vh] overflow-y-auto ui-scroll py-1">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center ui-t-muted" style={{ fontSize: 'var(--ui-fs-sm)' }}>
              Aucune commande ne correspond à « {query} »
            </li>
          )}
          {results.map((command, index) => {
            const showGroup = command.group !== lastGroup;
            lastGroup = command.group;
            const selected = index === cursor;
            return (
              <li key={command.id}>
                {showGroup && (
                  <div className="ui-label px-3 pt-2 pb-1">{command.group}</div>
                )}
                <button
                  data-index={index}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => { command.run(); onClose(); }}
                  className="w-full flex items-center gap-2.5 px-3 text-left"
                  style={{
                    height: 'var(--ui-row-h)',
                    background: selected ? 'var(--ui-accent-soft)' : 'transparent',
                  }}
                >
                  <span
                    className="truncate shrink-0"
                    style={{
                      fontSize: 'var(--ui-fs-sm)',
                      fontWeight: 600,
                      color: selected ? 'var(--ui-accent-text)' : 'var(--ui-text)',
                    }}
                  >
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="truncate flex-1 ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
                      {command.hint}
                    </span>
                  )}
                  {command.shortcut && (
                    <kbd
                      className="ui-mono px-1 rounded shrink-0 ml-auto"
                      style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)', color: 'var(--ui-text-faint)' }}
                    >
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          className="flex items-center gap-3 px-3 ui-t-faint"
          style={{ height: 28, borderTop: '1px solid var(--ui-border)', fontSize: 'var(--ui-fs-xs)' }}
        >
          <span className="flex items-center gap-1"><ArrowUp className="w-2.5 h-2.5" /><ArrowDown className="w-2.5 h-2.5" /> naviguer</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-2.5 h-2.5" /> ouvrir</span>
          <span className="ml-auto ui-num">{results.length} résultat{results.length > 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
