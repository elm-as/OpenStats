import React, { useState } from 'react';
import { useComputeVariableMutation } from '../store/api';
import { Calculator, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  datasetId: string;
  columns: string[];
  onComputed?: () => void;
}

export default function ComputedVariableEditor({ datasetId, columns, onComputed }: Props) {
  const [newColumn, setNewColumn] = useState('');
  const [formula, setFormula] = useState('');
  const [compute, { isLoading }] = useComputeVariableMutation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const operators = ['+', '-', '*', '/', '(', ')'];
  const functions = ['log', 'exp', 'sqrt', 'sin', 'cos'];

  const insertAtCursor = (text: string) => {
    // Dans une version plus avancée on utiliserait une ref vers le textarea,
    // mais pour faire simple on append à la fin.
    setFormula((prev) => (prev ? `${prev} ${text}` : text));
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
        id: datasetId,
        new_column: newColumn,
        formula: formula,
      }).unwrap();

      if (res.applied) {
        setSuccess(`La variable ${newColumn} a été créée avec succès.`);
        setNewColumn('');
        setFormula('');
        if (onComputed) onComputed();
      }
    } catch (err: any) {
      setError(err?.data?.error || 'Erreur lors du calcul de la variable.');
    }
  };

  return (
    <div className="card mt-4 border border-indigo-200">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Calculator className="w-5 h-5 text-indigo-600" />
        Calculer une nouvelle variable
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la nouvelle variable
            </label>
            <input
              type="text"
              value={newColumn}
              onChange={(e) => setNewColumn(e.target.value)}
              placeholder="Ex: familySize"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expression mathématique
            </label>
            <textarea
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              rows={4}
              placeholder="Ex: childs + brothers  ou  log(income + 1)"
              className="w-full font-mono text-sm p-3"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCompute}
              disabled={isLoading || !newColumn || !formula}
              className="btn-primary flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Calculer et ajouter au Dataset
            </button>
            <button
              onClick={() => {
                setFormula('');
                setNewColumn('');
                setError(null);
                setSuccess(null);
              }}
              className="btn-secondary"
            >
              Effacer
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}
        </div>

        {/* Palette */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Opérateurs</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {operators.map((op) => (
              <button
                key={op}
                onClick={() => insertAtCursor(op)}
                className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono hover:bg-gray-100 transition-colors"
              >
                {op}
              </button>
            ))}
          </div>

          <h4 className="text-sm font-semibold text-gray-900 mb-3">Fonctions</h4>
          <div className="flex flex-wrap gap-2 mb-4">
            {functions.map((fn) => (
              <button
                key={fn}
                onClick={() => insertAtCursor(`${fn}(`)}
                className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono hover:bg-gray-100 transition-colors"
              >
                {fn}()
              </button>
            ))}
          </div>

          <h4 className="text-sm font-semibold text-gray-900 mb-3">Colonnes existantes</h4>
          <div className="max-h-60 overflow-y-auto pr-2 space-y-1">
            {columns.map((col) => {
              // Si la colonne contient des espaces ou des caractères spéciaux, 
              // pandas requiert de l'entourer de backticks pour l'évaluer correctement.
              const needsBackticks = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
              const insertText = needsBackticks ? `\`${col}\`` : col;
              
              return (
                <button
                  key={col}
                  onClick={() => insertAtCursor(insertText)}
                  className="w-full text-left px-2 py-1.5 bg-white border border-gray-200 rounded text-xs font-mono truncate hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
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
  );
}
