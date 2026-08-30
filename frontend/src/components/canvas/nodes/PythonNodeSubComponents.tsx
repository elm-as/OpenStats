import React from 'react';
import { TerminalSquare, X, Check, Copy } from 'lucide-react';

interface PythonFullscreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  onUpdate: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export function PythonFullscreenModal({
  isOpen,
  onClose,
  code,
  onUpdate,
}: PythonFullscreenModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in nodrag nopan nowheel">
      <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden space-y-4 p-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <TerminalSquare size={18} className="text-amber-400" />
            <h3 className="text-base font-bold text-surface-100">
              Éditeur Python Plein Écran
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
          name="code"
          value={code}
          onChange={onUpdate}
          placeholder="df['nouvelle_colonne'] = df['A'] + df['B']"
          className="w-full bg-surface-950 border border-surface-700 rounded-xl p-4 text-sm text-surface-100 font-mono leading-relaxed focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 min-h-[300px]"
          rows={12}
        />

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-xs text-surface-400">
            DataFrame actif : <code className="text-amber-300 font-mono">df</code>{' '}
            (librairies: <code className="text-amber-300 font-mono">pd, np</code>)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-surface-950 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg"
          >
            <Check size={14} /> Valider & Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export function getDynamicPythonSnippets(
  allCols: string[],
  numCols: string[],
  catCols: string[]
) {
  const num1 = numCols[0] || allCols[0] || 'colonne_num';
  const cat1 = catCols[0] || allCols[0] || 'colonne_cat';
  const c1 = allCols[0] || 'colonne';

  return [
    {
      title: `Nettoyage des valeurs manquantes (${c1})`,
      description: `Supprime ou impute les valeurs nulles sur ${c1}`,
      code: `df['${c1}'] = df['${c1}'].fillna(df['${c1}'].median())\n# Ou suppression : df = df.dropna(subset=['${c1}'])`,
      category: 'Nettoyage',
    },
    {
      title: `Filtrage de valeurs extrêmes (${num1})`,
      description: `Conserve uniquement les observations réalistes`,
      code: `q_low = df['${num1}'].quantile(0.01)\nq_high = df['${num1}'].quantile(0.99)\ndf = df[(df['${num1}'] >= q_low) & (df['${num1}'] <= q_high)]`,
      category: 'Filtre',
    },
    {
      title: `Agrégation & Moyenne groupée (${cat1})`,
      description: `Calcule les moyennes par groupe`,
      code: `df_grouped = df.groupby('${cat1}').agg({\n    '${num1}': ['count', 'mean', 'std']\n}).reset_index()`,
      category: 'Agrégation',
    },
    {
      title: `Normalisation Min-Max (${num1})`,
      description: `Met à l'échelle la variable entre 0 et 1`,
      code: `min_val = df['${num1}'].min()\nmax_val = df['${num1}'].max()\ndf['${num1}_norm'] = (df['${num1}'] - min_val) / (max_val - min_val)`,
      category: 'Transformation',
    },
  ];
}

export function PythonSnippetsList({
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
        Cliquez sur un modèle pour l'appliquer immédiatement :
      </span>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {snippets.map((snip, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-xl bg-surface-950 border border-white/[0.06] hover:border-amber-500/40 transition-all space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-amber-300">{snip.title}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
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
              className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 mt-1"
            >
              <Copy size={12} /> Utiliser ce modèle & éditer
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
