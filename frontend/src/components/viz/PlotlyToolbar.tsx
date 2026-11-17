import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, Download, FileSpreadsheet, FileCode, Image as ImageIcon, FileImage } from 'lucide-react';

export interface PlotlyToolbarSettingsState {
  open: boolean;
  onToggle: () => void;
}

export interface PlotlyToolbarExportHandlers {
  onPng: () => void;
  onSvg: () => void;
  onCsv: () => void;
  onJson: () => void;
}

interface PlotlyToolbarProps {
  chartTitle: string;
  settingsState: PlotlyToolbarSettingsState;
  exportHandlers: PlotlyToolbarExportHandlers;
}

export function PlotlyToolbar({
  chartTitle,
  settingsState,
  exportHandlers,
}: PlotlyToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const runAndClose = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <div
      className="flex items-center justify-between gap-3 pb-2"
      style={{ borderBottom: '1px solid var(--ui-border)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {chartTitle ? (
          <span
            className="text-xs font-semibold tracking-wide truncate"
            style={{ color: 'var(--ui-text)' }}
          >
            {chartTitle}
          </span>
        ) : (
          <span />
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={settingsState.onToggle}
          aria-pressed={settingsState.open}
          className="px-2 py-1 rounded-[var(--ui-radius-sm)] transition-colors flex items-center gap-1 text-[11px] font-medium ui-focusable"
          style={{
            color: settingsState.open ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
            background: settingsState.open ? 'var(--ui-accent-soft)' : 'transparent',
          }}
          title="Personnaliser le graphique"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Style
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="px-2 py-1 rounded-[var(--ui-radius-sm)] transition-colors flex items-center gap-1 text-[11px] font-medium ui-focusable"
            style={{
              color: menuOpen ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
              background: menuOpen ? 'var(--ui-accent-soft)' : 'transparent',
            }}
            title="Exporter l'image ou les données"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-48 rounded-[var(--ui-radius)] p-1 z-30"
              style={{
                background: 'var(--ui-bg-overlay)',
                border: '1px solid var(--ui-border-strong)',
                boxShadow: 'var(--ui-shadow-md)',
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(exportHandlers.onPng)}
                className="w-full text-left px-2.5 py-1.5 rounded-[var(--ui-radius-sm)] text-[11px] flex items-center gap-2 hover:bg-[var(--ui-accent-soft)] ui-focusable"
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
                Image HD (.PNG)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(exportHandlers.onSvg)}
                className="w-full text-left px-2.5 py-1.5 rounded-[var(--ui-radius-sm)] text-[11px] flex items-center gap-2 hover:bg-[var(--ui-accent-soft)] ui-focusable"
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                <FileImage className="w-3.5 h-3.5" style={{ color: 'var(--ui-info)' }} />
                Vectoriel (.SVG)
              </button>
              <div className="my-1" style={{ borderTop: '1px solid var(--ui-border)' }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(exportHandlers.onCsv)}
                className="w-full text-left px-2.5 py-1.5 rounded-[var(--ui-radius-sm)] text-[11px] flex items-center gap-2 hover:bg-[var(--ui-accent-soft)] ui-focusable"
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: 'var(--ui-success)' }} />
                Données (.CSV)
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAndClose(exportHandlers.onJson)}
                className="w-full text-left px-2.5 py-1.5 rounded-[var(--ui-radius-sm)] text-[11px] flex items-center gap-2 hover:bg-[var(--ui-accent-soft)] ui-focusable"
                style={{ color: 'var(--ui-text-secondary)' }}
              >
                <FileCode className="w-3.5 h-3.5" style={{ color: 'var(--ui-warning)' }} />
                Spécification (.JSON)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
