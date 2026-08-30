import React, { useState, useMemo } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { TerminalSquare, Sparkles, Code2, Plus, Maximize2, Check } from 'lucide-react';
import { CanvasNodeData, NodeShell, useNodeUpdate, useConnectedColumns } from './_shared';
import {
  PythonFullscreenModal,
  PythonSnippetsList,
  getDynamicPythonSnippets,
} from './PythonNodeSubComponents';

export function PythonNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
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
  const [builderType, setBuilderType] = useState<
    'math' | 'filter' | 'fillna' | 'zscore' | 'bining' | 'date'
  >('math');
  const [targetCol1, setTargetCol1] = useState('');
  const [targetCol2, setTargetCol2] = useState('');
  const [newColName, setNewColName] = useState('nouvelle_colonne');
  const [mathOp, setMathOp] = useState('+');
  const [filterOp, setFilterOp] = useState('>');
  const [filterVal, setFilterVal] = useState('0');

  const currentCode = (data.code as string) || '';

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const applyCode = (codeStr: string, notification: string = 'Code Python appliqué') => {
    if (data.onChange) {
      data.onChange(id, 'code', codeStr);
    }
    setActiveTab('editor');
    triggerToast(notification);
  };

  const insertText = (textToInsert: string) => {
    const newCode = currentCode ? `${currentCode}\n${textToInsert}` : textToInsert;
    applyCode(newCode, `Inséré : ${textToInsert}`);
  };

  const generateBuilderCode = () => {
    const c1 = targetCol1 || (allCols[0] ?? 'colonne_A');
    const c2 = targetCol2 || (allCols[1] ?? allCols[0] ?? 'colonne_B');
    const dest = newColName.trim() || 'resultat';

    let generated = '';
    if (builderType === 'math') {
      generated = `df['${dest}'] = df['${c1}'] ${mathOp} df['${c2}']`;
    } else if (builderType === 'filter') {
      const isNum = numCols.includes(c1);
      const valStr = isNum ? filterVal : `'${filterVal}'`;
      generated = `df = df[df['${c1}'] ${filterOp} ${valStr}]`;
    } else if (builderType === 'fillna') {
      generated = `df['${c1}'] = df['${c1}'].fillna(df['${c1}'].mean() if pd.api.types.is_numeric_dtype(df['${c1}']) else df['${c1}'].mode()[0])`;
    } else if (builderType === 'zscore') {
      generated = `df['${c1}_zscore'] = (df['${c1}'] - df['${c1}'].mean()) / df['${c1}'].std()`;
    } else if (builderType === 'bining') {
      generated = `df['${c1}_classe'] = pd.qcut(df['${c1}'], q=4, labels=['Q1', 'Q2', 'Q3', 'Q4'])`;
    } else if (builderType === 'date') {
      generated = `df['${c1}'] = pd.to_datetime(df['${c1}'])\ndf['${c1}_annee'] = df['${c1}'].dt.year\ndf['${c1}_mois'] = df['${c1}'].dt.month`;
    }

    applyCode(generated, 'Code généré avec succès');
  };

  // Dynamic context-aware snippets without emojis
  const dynamicSnippets = useMemo(
    () => getDynamicPythonSnippets(allCols, numCols, catCols),
    [allCols, numCols, catCols]
  );


  return (
    <>
      <NodeShell
        id={id}
        data={data}
        color="#f59e0b"
        icon={TerminalSquare}
        title="Script Python (Pandas)"
        hasInput
        hasOutput
      >
        <div className="space-y-3 relative">
          {/* Toast de confirmation */}
          {toastMessage && (
            <div className="absolute -top-2 left-0 right-0 z-20 bg-emerald-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center justify-center gap-1.5 animate-fade-in-up">
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
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Code2 size={13} /> Éditeur
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('builder')}
              className={`flex-1 text-[11px] font-semibold py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Sparkles size={13} className="text-accent-400" /> Assistant Visuel
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
                    onClick={() => insertText(`df['${colName}']`)}
                    className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono transition-colors flex items-center gap-1"
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
                  Zone de Code Python
                </label>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-[10px] text-accent-400 hover:text-accent-300 flex items-center gap-1 bg-accent-500/10 hover:bg-accent-500/20 px-2 py-0.5 rounded border border-accent-500/20 transition-colors"
                >
                  <Maximize2 size={11} /> Plein Écran
                </button>
              </div>

              <div className="relative nodrag nopan nowheel">
                <textarea
                  name="code"
                  value={currentCode}
                  onChange={update}
                  placeholder="df['nouvelle_colonne'] = df['A'] + df['B']"
                  className="w-full bg-surface-950 border border-white/[0.08] rounded-xl p-3 text-xs text-surface-100 font-mono leading-relaxed focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 min-h-[140px]"
                  rows={6}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-surface-500 px-1 font-mono">
                <span>
                  Variable active : <span className="text-amber-400 font-semibold">df</span>
                </span>
                <span>Pandas &amp; NumPy actifs</span>
              </div>
            </div>
          )}

          {/* Onglet Assistant Visuel */}
          {activeTab === 'builder' && (
            <div className="space-y-3 bg-surface-950 p-3 rounded-xl border border-white/[0.06] nodrag nopan nowheel">
              <div>
                <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                  Type de Transformation :
                </label>
                <select
                  value={builderType}
                  onChange={e => setBuilderType(e.target.value as any)}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                >
                  <option value="math">Opération Mathématique (+, -, *, /)</option>
                  <option value="filter">Filtrer les lignes selon un seuil</option>
                  <option value="fillna">Remplir les valeurs manquantes (Imputation)</option>
                  <option value="zscore">Normalisation Z-Score (Centrage &amp; Réduction)</option>
                  <option value="bining">Discrétisation en Quartiles (Q1-Q4)</option>
                  <option value="date">Extraction de Date (Année, Mois)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                  Colonne Cible :
                </label>
                <select
                  value={targetCol1}
                  onChange={e => setTargetCol1(e.target.value)}
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

              {builderType === 'math' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                      Opération :
                    </label>
                    <select
                      value={mathOp}
                      onChange={e => setMathOp(e.target.value)}
                      className="w-full bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                    >
                      <option value="+">+ Addition</option>
                      <option value="-">- Soustraction</option>
                      <option value="*">* Multiplication</option>
                      <option value="/">/ Division</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                      Avec :
                    </label>
                    <select
                      value={targetCol2}
                      onChange={e => setTargetCol2(e.target.value)}
                      className="w-full bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                    >
                      <option value="">Colonne B...</option>
                      {allCols.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {builderType === 'filter' && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filterOp}
                    onChange={e => setFilterOp(e.target.value)}
                    className="bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="==">==</option>
                    <option value="!=">!=</option>
                  </select>
                  <input
                    type="text"
                    value={filterVal}
                    onChange={e => setFilterVal(e.target.value)}
                    placeholder="Seuil..."
                    className="bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200"
                  />
                </div>
              )}

              {['math', 'zscore', 'bining'].includes(builderType) && (
                <div>
                  <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block mb-1">
                    Nom de la nouvelle variable :
                  </label>
                  <input
                    type="text"
                    value={newColName}
                    onChange={e => setNewColName(e.target.value)}
                    className="w-full bg-surface-900 border border-white/10 rounded-lg p-2 text-xs text-surface-200 font-mono"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={generateBuilderCode}
                className="w-full py-2 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-accent-500/30 mt-2"
              >
                <Sparkles size={13} /> Générer &amp; basculer vers l'éditeur
              </button>
            </div>
          )}

          {/* Onglet Modèles */}
          {activeTab === 'snippets' && (
            <PythonSnippetsList
              snippets={dynamicSnippets}
              onApply={(codeStr, title) => applyCode(codeStr, `Modèle "${title}" appliqué`)}
            />
          )}
        </div>
      </NodeShell>

      <PythonFullscreenModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={currentCode}
        onUpdate={update}
      />
    </>
  );
}
