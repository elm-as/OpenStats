import React, { useState } from 'react';
import { useComputeVariableMutation } from '../../store/api';
import { Calculator, Play, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  datasetId: string;
  columns: string[];
  onComputed?: () => void;
}

const OPERATORS = ['+', '-', '*', '/', '(', ')'];
const FUNCTIONS = ['log', 'exp', 'sqrt', 'sin', 'cos'];

export default function ComputedVariableEditor(props: Props) {
  const [newColumn, setNewColumn] = useState('');
  const [formula, setFormula] = useState('');
  const [compute, { isLoading }] = useComputeVariableMutation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const insertAtCursor = (text: string) => {
    setFormula(prev => (prev ? `${prev} ${text}` : text));
  };

  const handleCompute = async () => {
    setError(null);
    setSuccess(null);
    if (!newColumn.trim() || !formula.trim()) {
      setError('Veuillez spécifier un nom de variable et une formule.');
      return;
    }

    try {
      const res = await compute({
        id: props.datasetId,
        new_column: newColumn,
        formula,
      }).unwrap();

      if (res.applied) {
        setSuccess(`Variable « ${newColumn} » ajoutée.`);
        setNewColumn('');
        setFormula('');
        props.onComputed?.();
      }
    } catch (err: any) {
      setError(err?.data?.error || 'Erreur lors du calcul de la variable.');
    }
  };

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
          <Calculator className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
          Calculer une variable
        </span>
      </header>

      <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 space-y-2.5">
          <div>
            <label className="ui-label block mb-1">Nom de la nouvelle variable</label>
            <input
              type="text"
              value={newColumn}
              onChange={e => setNewColumn(e.target.value)}
              placeholder="Ex: familySize"
              className="ui-input w-full"
            />
          </div>

          <div>
            <label className="ui-label block mb-1">Expression mathématique</label>
            <textarea
              value={formula}
              onChange={e => setFormula(e.target.value)}
              rows={4}
              placeholder="Ex: childs + brothers  ou  log(income + 1)"
              className="ui-input ui-mono w-full p-2.5"
              style={{ height: 'auto' }}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCompute}
              disabled={isLoading || !newColumn || !formula}
              className="ui-btn ui-btn-primary ui-focusable text-xs"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Calculer et ajouter
            </button>
            <button
              onClick={() => {
                setFormula('');
                setNewColumn('');
                setError(null);
                setSuccess(null);
              }}
              className="ui-btn ui-btn-ghost ui-focusable text-xs"
            >
              Effacer
            </button>
          </div>

          {error && (
            <div className="ui-panel p-2 text-xs ui-t-danger flex items-center gap-2" style={{ background: 'var(--ui-danger-soft)' }}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="ui-panel p-2 text-xs ui-t-success flex items-center gap-2" style={{ background: 'var(--ui-success-soft)' }}>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        <div className="ui-panel p-2.5 space-y-3" style={{ background: 'var(--ui-bg-sunken)' }}>
          <div>
            <h4 className="ui-label mb-1.5">Opérateurs</h4>
            <div className="flex flex-wrap gap-1">
              {OPERATORS.map(op => (
                <button key={op} onClick={() => insertAtCursor(op)} className="ui-btn ui-mono text-xs px-2">
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="ui-label mb-1.5">Fonctions</h4>
            <div className="flex flex-wrap gap-1">
              {FUNCTIONS.map(fn => (
                <button key={fn} onClick={() => insertAtCursor(`${fn}(`)} className="ui-btn ui-mono text-xs px-2">
                  {fn}()
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="ui-label mb-1.5">Variables ({props.columns.length})</h4>
            <div className="max-h-48 overflow-y-auto ui-scroll space-y-1">
              {props.columns.map(col => {
                const needsBackticks = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
                const insertText = needsBackticks ? `\`${col}\`` : col;
                return (
                  <button
                    key={col}
                    onClick={() => insertAtCursor(insertText)}
                    className="w-full text-left px-2 py-1 rounded-[var(--ui-radius-sm)] ui-mono text-xs truncate transition-colors hover:text-[var(--ui-accent-text)]"
                    style={{ background: 'var(--ui-bg-panel)', border: '1px solid var(--ui-border)', color: 'var(--ui-text-secondary)' }}
                    title={`Insérer ${col}`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
