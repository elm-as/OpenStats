import React from 'react';
import { Database, X, Check, Copy } from 'lucide-react';

interface SqlFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onUpdate: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function SqlFullscreenModal({
  isOpen,
  onClose,
  query,
  onUpdate,
}: SqlFullscreenModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in nodrag nopan nowheel">
      <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-blue-400" />
            <h3 className="text-base font-bold text-surface-100">
              Éditeur SQL Plein Écran
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-surface-400 hover:text-surface-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <textarea
          name="query"
          value={query}
          onChange={onUpdate}
          placeholder="SELECT * FROM df..."
          className="w-full bg-surface-950 border border-surface-700 rounded-xl p-4 text-sm text-surface-100 font-mono leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 min-h-[300px]"
          rows={12}
        />

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs text-surface-400">
            Table source active : <code className="text-blue-300 font-mono">df</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-lg"
          >
            <Check size={14} /> Valider & Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export function SqlSnippetsList({
  snippets,
  onApply,
}: {
  snippets: Array<{
    title: string;
    description: string;
    code: string;
    category: string;
  }>;
  onApply: (code: string, title: string) => void;
}) {
  return (
    <div className="space-y-2 nodrag nopan nowheel">
      <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block">
        Modèles Prêts à l'emploi (DuckDB) :
      </span>
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {snippets.map((snip, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-surface-950 border border-white/[0.06] hover:border-blue-500/40 transition-all space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-blue-300">{snip.title}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300 font-medium">
                {snip.category}
              </span>
            </div>
            <p className="text-[10px] text-surface-400">{snip.description}</p>
            <pre className="text-[10px] text-surface-200 bg-black/50 p-2 rounded-lg font-mono overflow-x-auto border border-white/[0.04]">
              {snip.code}
            </pre>
            <button
              type="button"
              onClick={() => onApply(snip.code, snip.title)}
              className="w-full py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 mt-1"
            >
              <Copy size={12} /> Utiliser ce modèle & éditer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
