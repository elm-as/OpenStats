import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bookmark, X, Trash2, Copy, Check, FileText, ChevronRight } from 'lucide-react';
import { RootState } from '../../store';
import {
  removePinnedItem,
  clearAllPinnedItems,
  togglePinnedDrawer,
  setPinnedDrawerOpen,
} from '../../store/slices/pinnedNotesSlice';

export function PinnedDrawer() {
  const dispatch = useDispatch();
  const { items, isOpen } = useSelector((state: RootState) => state.pinnedNotes);
  const [copied, setCopied] = useState(false);

  const handleCopyMemo = () => {
    let markdown = '# Carnet de Bord de l\'Analyste — Synthèse OpenStats\n\n';
    markdown += `*Généré le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}*\n\n`;

    items.forEach((item, idx) => {
      markdown += `### ${idx + 1}. [${item.category.toUpperCase()}] ${item.title}\n`;
      if (item.badge) markdown += `**Statut / Métrique :** \`${item.badge}\`\n`;
      if (item.details) markdown += `\n${item.details}\n`;
      markdown += `\n*Épinglé à ${item.created_at}*\n\n---\n\n`;
    });

    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Bouton flottant déclencheur */}
      <button
        onClick={() => dispatch(togglePinnedDrawer())}
        className={`fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full shadow-lg backdrop-blur-md transition-all duration-300 ${
          items.length > 0
            ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20'
            : 'bg-surface-800/90 hover:bg-surface-700 text-surface-300 border border-white/10'
        }`}
        title="Ouvrir le carnet de bord de l'analyste"
      >
        <Bookmark className={`w-4 h-4 ${items.length > 0 ? 'fill-current' : ''}`} />
        <span className="text-xs font-semibold">Bloc-notes</span>
        {items.length > 0 && (
          <span className="w-5 h-5 rounded-full bg-white text-cyan-700 text-[11px] font-bold flex items-center justify-center">
            {items.length}
          </span>
        )}
      </button>

      {/* Slide-over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => dispatch(setPinnedDrawerOpen(false))}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-surface-900 border-l border-white/10 shadow-2xl flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-surface-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Bookmark className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-100">
                      Carnet de bord de l'Analyste
                    </h3>
                    <p className="text-[11px] text-surface-400">
                      {items.length} trouvaille{items.length > 1 ? 's' : ''} épinglée{items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {items.length > 0 && (
                    <>
                      <button
                        onClick={handleCopyMemo}
                        className="p-1.5 rounded-lg text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-all text-xs flex items-center gap-1"
                        title="Copier le mémo complet en Markdown"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => dispatch(clearAllPinnedItems())}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Tout effacer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => dispatch(setPinnedDrawerOpen(false))}
                    className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-700 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {items.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-surface-400">
                    <Bookmark className="w-10 h-10 text-surface-600 mb-3 stroke-[1.5]" />
                    <p className="text-sm font-medium text-surface-200">Aucun élément épinglé</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-[220px]">
                      Épinglez des coefficients clés, des tests ou des graphiques pour constituer votre mémo d'analyse.
                    </p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-surface-800/80 hover:bg-surface-800 border border-white/10 rounded-xl space-y-2 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-surface-700 text-surface-300">
                          {item.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-surface-500">{item.created_at}</span>
                          <button
                            onClick={() => dispatch(removePinnedItem(item.id))}
                            className="text-surface-500 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-surface-100">{item.title}</h4>

                      {item.badge && (
                        <div className="inline-block px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-xs font-mono font-bold">
                          {item.badge}
                        </div>
                      )}

                      {item.details && (
                        <p className="text-xs text-surface-400 line-clamp-3 font-mono bg-surface-900/50 p-2 rounded">
                          {item.details}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="p-3 border-t border-white/10 bg-surface-800/40">
                  <button
                    onClick={handleCopyMemo}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {copied ? 'Mémo copié dans le presse-papier !' : 'Copier la synthèse en Markdown'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
