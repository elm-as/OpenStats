import React from 'react';
import { SlidersHorizontal, Info, Download, FileSpreadsheet, FileCode } from 'lucide-react';

interface PlotlyToolbarProps {
  chartTitle: string;
  showSettings: boolean;
  showInterpretation: boolean;
  onToggleSettings: () => void;
  onToggleInterpretation: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export function PlotlyToolbar({
  chartTitle,
  showSettings,
  showInterpretation,
  onToggleSettings,
  onToggleInterpretation,
  onExportCsv,
  onExportJson,
}: PlotlyToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2.5">
      <div className="flex items-center gap-2">
        {chartTitle ? (
          <span className="text-xs font-semibold text-surface-200 tracking-wide uppercase">
            {chartTitle}
          </span>
        ) : (
          <span className="text-xs font-semibold text-surface-400 uppercase">
            Graphe Interactif
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onToggleSettings}
          className={`p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium ${
            showSettings ? 'bg-white/5 text-accent-400' : ''
          }`}
          title="Personnaliser le graphique"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Style
        </button>

        <button
          onClick={onToggleInterpretation}
          className={`p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium ${
            showInterpretation ? 'bg-white/5 text-accent-400' : ''
          }`}
          title="Comprendre le graphique"
        >
          <Info className="w-3.5 h-3.5" />
          Interpréter
        </button>

        <div className="relative group/export">
          <button className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-white/5 transition-all flex items-center gap-1 text-[11px] font-medium">
            <Download className="w-3.5 h-3.5" />
            Exporter
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-surface-950 border border-white/10 shadow-2xl p-1 opacity-0 pointer-events-none group-hover/export:opacity-100 group-hover/export:pointer-events-auto transition-all z-20">
            <button
              onClick={onExportCsv}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-surface-300 hover:text-surface-100 hover:bg-white/5 flex items-center gap-2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Données (.CSV)
            </button>
            <button
              onClick={onExportJson}
              className="w-full text-left px-2.5 py-1.5 rounded-md text-[11px] text-surface-300 hover:text-surface-100 hover:bg-white/5 flex items-center gap-2"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-400" />
              Spécification (.JSON)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
