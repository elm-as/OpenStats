import React, { useState, useMemo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Database, Sparkles, Code2, Plus, Maximize2, Check } from 'lucide-react';
import { CanvasNodeData, NodeShell, useNodeUpdate, useConnectedColumns } from './_shared';
import { SqlFullscreenModal, SqlSnippetsList } from './SqlNodeSubComponents';

export function SqlNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const update = useNodeUpdate(id, data);
  const { columns, columnTypes } = useConnectedColumns(id);
  const [activeTab, setActiveTab] = useState<'editor' | 'builder' | 'snippets'>('editor');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Categorize connected columns by type
  const { numCols, catCols, allCols } = useMemo(() => {
    const num = columns.filter(c => {
      const t = columnTypes[c] || '';
      return t.includes('num') || t.includes('cont') || t.includes('disc') || t === '?';
    });
    const cat = columns.filter(c => !num.includes(c));
    return { numCols: num, catCols: cat, allCols: columns };
  }, [columns, columnTypes]);

  // No-code builder state
  const [builderAction, setBuilderAction] = useState<
    'filter' | 'groupby' | 'order' | 'select'
  >('filter');
  const [builderCol, setBuilderCol] = useState('');
  const [builderVal, setBuilderVal] = useState('');
  const [builderOp, setBuilderOp] = useState('>');

  const currentQuery = (data.query as string) || '';

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const applyCode = (sql: string, notification: string = 'Code SQL appliqué') => {
    if (data.onChange) {
      data.onChange(id, 'query', sql);
    }
    setActiveTab('editor');
    triggerToast(notification);
  };

  const insertText = (textToInsert: string) => {
    const newQuery = currentQuery ? `${currentQuery} ${textToInsert}` : textToInsert;
    applyCode(newQuery, `Inséré : ${textToInsert}`);
  };

  const generateBuilderSql = () => {
    const col = builderCol || (allCols[0] ?? 'colonne');
    let generated = 'SELECT * FROM df';

    if (builderAction === 'filter') {
      const isNum = numCols.includes(col);
      const valStr = isNum ? builderVal || '0' : `'${builderVal || 'valeur'}'`;
      generated = `SELECT * FROM df WHERE ${col} ${builderOp} ${valStr}`;
    } else if (builderAction === 'groupby') {
      const aggCol = numCols.find(c => c !== col) || numCols[0] || col;
      generated = `SELECT ${col}, COUNT(*) AS total, AVG(${aggCol}) AS moyenne_${aggCol}\nFROM df\nGROUP BY ${col}`;
    } else if (builderAction === 'order') {
      generated = `SELECT * FROM df ORDER BY ${col} ${builderOp === '>' ? 'DESC' : 'ASC'}`;
    } else if (builderAction === 'select') {
      const colsToSelect = allCols.slice(0, 3).join(', ') || col;
      generated = `SELECT ${colsToSelect} FROM df`;
    }

    applyCode(generated, 'Requête visuelle générée');
  };

  // Dynamic context-aware snippets without emojis
  const dynamicSnippets = useMemo(() => {
    const num1 = numCols[0] || allCols[0] || 'variable_1';
    const cat1 = catCols[0] || allCols[0] || 'categorie_1';
    const c1 = allCols[0] || 'variable';

    return [
      {
        title: `Filtrer par ${num1}`,
        description: `Sélectionne les lignes où ${num1} est supérieur au seuil`,
        code: `SELECT * FROM df WHERE ${num1} > 0`,
        category: 'Filtre',
      },
      {
        title: `Agrégation par ${cat1}`,
        description: `Calcule les effectifs et moyennes de ${num1} par groupe`,
        code: `SELECT ${cat1}, COUNT(*) AS total, AVG(${num1}) AS moyenne\nFROM df\nGROUP BY ${cat1}\nORDER BY total DESC`,
        category: 'Groupe',
      },
      {
        title: `Suppression des nuls sur ${c1}`,
        description: `Exclut toutes les lignes où ${c1} est manquant`,
        code: `SELECT * FROM df WHERE ${c1} IS NOT NULL`,
        category: 'Nettoyage',
      },
      {
        title: `Trier par ${num1} (Top 10)`,
        description: `Classe le tableau de manière décroissante`,
        code: `SELECT * FROM df ORDER BY ${num1} DESC LIMIT 10`,
        category: 'Tri',
      },
    ];
  }, [allCols, numCols, catCols]);

  return (
    <>
      <NodeShell
        id={id}
        data={data}
        color="#3b82f6"
        icon={Database}
        title="Requête SQL (DuckDB)"
        hasInput
        hasOutput
      >
        <div className="space-y-3 relative">
          {/* Toast de confirmation */}
          {toastMessage && (
            <div className="absolute -top-2 left-0 right-0 z-20 bg-blue-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center justify-center gap-1.5 animate-fade-in-up">
              <Check size={13} /> {toastMessage}
            </div>
          )}

          {/* Navigation Onglets */}
          <div className="flex items-center gap-1 bg-surface-950 p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'editor'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Code2 size={13} /> Éditeur SQL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Sparkles size={13} className="text-cyan-400" /> Assistant Visuel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('snippets')}
              className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'snippets'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              Modèles ({dynamicSnippets.length})
            </button>
          </div>

          {/* Colonnes connectées cliquables */}
          {allCols.length > 0 && (
            <div>
              <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                Colonnes connectées (cliquer pour insérer) :
              </span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 nodrag nopan nowheel">
                {allCols.map(colName => (
                  <button
                    key={colName}
                    type="button"
                    onClick={() => insertText(colName)}
                    className="px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[10px] font-mono transition-colors flex items-center gap-1"
                  >
                    <Plus size={10} /> {colName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Onglet Éditeur principal */}
          {activeTab === 'editor' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-surface-200">
                  Zone de Code SQL
                </label>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/20 transition-colors"
                >
                  <Maximize2 size={11} /> Plein Écran
                </button>
              </div>

              <div className="relative nodrag nopan nowheel">
                <textarea
                  name="query"
                  value={currentQuery}
                  onChange={update}
                  placeholder="SELECT * FROM df..."
                  className="w-full bg-surface-950 border border-white/[0.08] rounded-xl p-3 text-xs text-surface-100 font-mono leading-relaxed focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 min-h-[140px]"
                  rows={6}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-surface-500 px-1 font-mono">
                <span>
                  Source active : <span className="text-blue-400 font-semibold">df</span>
                </span>
                <span>DuckDB SQL</span>
              </div>
            </div>
          )}

          {/* Onglet Assistant Visuel */}
          {activeTab === 'builder' && (
            <div className="space-y-3 bg-surface-950 p-3 rounded-xl border border-white/[0.06] nodrag nopan nowheel">
              <div>
                <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                  Action à effectuer :
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'filter', label: 'Filtrer (WHERE)' },
                    { id: 'groupby', label: 'Agréger (GROUP BY)' },
                    { id: 'order', label: 'Trier (ORDER BY)' },
                    { id: 'select', label: 'Sélectionner' },
                  ].map(act => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setBuilderAction(act.id as any)}
                      className={`text-[11px] py-1 px-2 rounded-lg font-medium transition-colors border text-left ${
                        builderAction === act.id
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-white/5 border-transparent text-surface-400 hover:text-surface-200'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                  Sur la colonne :
                </label>
                <select
                  value={builderCol}
                  onChange={e => setBuilderCol(e.target.value)}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                >
                  <option value="">Sélectionner une colonne...</option>
                  {allCols.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {builderAction === 'filter' && (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={builderOp}
                    onChange={e => setBuilderOp(e.target.value)}
                    className="bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value="LIKE">contient</option>
                  </select>
                  <input
                    type="text"
                    value={builderVal}
                    onChange={e => setBuilderVal(e.target.value)}
                    placeholder="Valeur..."
                    className="col-span-2 bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={generateBuilderSql}
                className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-cyan-500/30 mt-2"
              >
                <Sparkles size={13} /> Générer et remplacer la requête
              </button>
            </div>
          )}

          {/* Onglet Modèles Prêts à l'emploi */}
          {activeTab === 'snippets' && (
            <SqlSnippetsList
              snippets={dynamicSnippets}
              onApply={(sql, title) => applyCode(sql, `Modèle "${title}" appliqué`)}
            />
          )}
        </div>
      </NodeShell>

      <SqlFullscreenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        query={currentQuery}
        onUpdate={update}
      />
    </>
  );
}
