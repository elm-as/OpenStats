import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Bookmark, X, Trash2, Copy, Check, FileText } from 'lucide-react';
import { RootState } from '../../store';
import {
  removePinnedItem,
  clearAllPinnedItems,
  setPinnedDrawerOpen,
} from '../../store/slices/pinnedNotesSlice';

export function PinnedDrawer() {
  const dispatch = useDispatch();
  const { items, isOpen } = useSelector((state: RootState) => state.pinnedNotes);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyMemo = () => {
    let markdown = '# Carnet de bord de l’Analyste — Synthèse OpenStats\n\n';
    markdown += `*Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}*\n\n`;

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
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Carnet de bord de l’Analyste">
      <div
        className="absolute inset-0 transition-opacity"
        style={{ background: 'rgba(2, 6, 16, 0.55)' }}
        onClick={() => dispatch(setPinnedDrawerOpen(false))}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-md flex flex-col"
          style={{
            background: 'var(--ui-bg-panel)',
            borderLeft: '1px solid var(--ui-border-strong)',
            boxShadow: 'var(--ui-shadow-lg)',
          }}
        >
          {/* En-tête */}
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              background: 'var(--ui-bg-raised)',
              borderBottom: '1px solid var(--ui-border)',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-[var(--ui-radius-sm)] flex items-center justify-center"
                style={{ background: 'var(--ui-accent-soft)', color: 'var(--ui-accent-text)' }}
              >
                <Bookmark className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-bold ui-t">
                  Carnet de bord de l’Analyste
                </h3>
                <p className="text-[11px] ui-t-muted ui-num">
                  {items.length} élément{items.length > 1 ? 's' : ''} épinglé{items.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {items.length > 0 && (
                <>
                  <button
                    onClick={handleCopyMemo}
                    className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
                    title="Copier le mémo complet en Markdown"
                    aria-label="Copier le mémo en Markdown"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 ui-t-success" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => dispatch(clearAllPinnedItems())}
                    className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
                    title="Tout effacer"
                    aria-label="Tout effacer"
                  >
                    <Trash2 className="w-3.5 h-3.5 ui-t-danger" />
                  </button>
                </>
              )}
              <button
                onClick={() => dispatch(setPinnedDrawerOpen(false))}
                className="ui-btn ui-btn-ghost ui-btn-icon ui-focusable"
                title="Fermer"
                aria-label="Fermer le carnet de bord"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Liste des éléments */}
          <div className="flex-1 overflow-y-auto ui-scroll p-3 space-y-2.5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Bookmark className="w-9 h-9 ui-t-faint mb-3 stroke-[1.5]" />
                <p className="text-xs font-semibold ui-t">Aucun élément épinglé</p>
                <p className="text-[11px] ui-t-muted mt-1 max-w-[230px]">
                  Épinglez des coefficients, tests statistiques ou résumés pour constituer votre mémo d’analyse.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="ui-panel p-3 space-y-1.5"
                  style={{ background: 'var(--ui-bg-raised)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="ui-tag ui-tag-neutral uppercase">{item.category}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] ui-t-faint ui-num">{item.created_at}</span>
                      <button
                        onClick={() => dispatch(removePinnedItem(item.id))}
                        className="ui-t-faint hover:text-[var(--ui-danger)] transition-colors"
                        title="Retirer du carnet"
                        aria-label="Retirer du carnet"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs font-semibold ui-t">{item.title}</h4>

                  {item.badge && (
                    <span className="ui-tag ui-tag-accent ui-mono font-bold">
                      {item.badge}
                    </span>
                  )}

                  {item.details && (
                    <p
                      className="text-[11px] ui-t-secondary line-clamp-3 ui-mono p-2 rounded-[var(--ui-radius-sm)]"
                      style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
                    >
                      {item.details}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="p-3" style={{ borderTop: '1px solid var(--ui-border)', background: 'var(--ui-bg-raised)' }}>
              <button
                onClick={handleCopyMemo}
                className="ui-btn ui-btn-primary w-full justify-center ui-focusable"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                {copied ? 'Mémo copié dans le presse-papier' : 'Copier la synthèse en Markdown'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
