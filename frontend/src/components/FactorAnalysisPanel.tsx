import { useState } from 'react';
import { useRunPCAMutation, useRunCAMutation, useRunMCAMutation } from '../store/api';
import type { DataCapabilities, PCAResult, CAResult, MCAResult } from '../types';
import { ArrowLeft, Play, Layers, Grid3X3 } from 'lucide-react';
import { PCAResultView, CAResultView } from './factorAnalysis/PcaCaResultViews';
import { MCAResultView } from './factorAnalysis/McaResultView';

const METHODS = [
  { key: 'pca', label: 'ACP — Analyse en Composantes Principales', desc: 'Réduction de dimensions pour variables numériques', icon: Layers },
  { key: 'ca', label: 'AFC — Analyse Factorielle des Correspondances', desc: 'Association entre deux variables catégorielles', icon: Grid3X3 },
  { key: 'mca', label: 'ACM — Analyse des Correspondances Multiples', desc: 'Analyse factorielle de variables catégorielles', icon: Layers },
] as const;

type MethodKey = (typeof METHODS)[number]['key'];

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  onBack: () => void;
  initialMethod?: string;
}

export default function FactorAnalysisPanel({ datasetId, capabilities, onBack, initialMethod }: Props) {
  const [runPCA, { isLoading: loadingPCA }] = useRunPCAMutation();
  const [runCA, { isLoading: loadingCA }] = useRunCAMutation();
  const [runMCA, { isLoading: loadingMCA }] = useRunMCAMutation();

  const [method, setMethod] = useState<MethodKey | null>(
    initialMethod === 'pca' || initialMethod === 'ca' || initialMethod === 'mca' ? initialMethod : null,
  );
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [rowCol, setRowCol] = useState('');
  const [colCol, setColCol] = useState('');
  const [nComponents, setNComponents] = useState(5);

  const [pcaResult, setPcaResult] = useState<PCAResult | null>(null);
  const [caResult, setCaResult] = useState<CAResult | null>(null);
  const [mcaResult, setMcaResult] = useState<MCAResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const isLoading = loadingPCA || loadingCA || loadingMCA;
  const numericCols = capabilities.columns.numeric;
  const catCols = [...capabilities.columns.categorical, ...capabilities.columns.discrete];

  const toggleCol = (col: string) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const handleRun = async () => {
    setError(null);
    setPcaResult(null);
    setCaResult(null);
    setMcaResult(null);

    try {
      if (method === 'pca') {
        const cols = selectedCols.length > 0 ? selectedCols : undefined;
        const r = await runPCA({ id: datasetId, columns: cols, n_components: nComponents }).unwrap();
        setPcaResult(r);
      } else if (method === 'ca') {
        if (!rowCol || !colCol) { setError('Sélectionnez les deux variables'); return; }
        if (rowCol === colCol) { setError('Les deux variables doivent être différentes'); return; }
        const r = await runCA({ id: datasetId, row_col: rowCol, col_col: colCol, n_components: nComponents }).unwrap();
        setCaResult(r);
      } else if (method === 'mca') {
        const cols = selectedCols.length > 0 ? selectedCols : undefined;
        const r = await runMCA({ id: datasetId, columns: cols, n_components: nComponents }).unwrap();
        setMcaResult(r);
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
    }
  };

  if (!method) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Analyse factorielle</h3>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const available = m.key === 'pca' ? numericCols.length >= 2 : catCols.length >= 2;
            return (
              <button
                key={m.key}
                onClick={() => available && setMethod(m.key)}
                disabled={!available}
                className={`card text-left p-4 transition-all ${available ? 'hover:shadow-md hover:border-cyan-300 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              >
                <Icon className="w-6 h-6 text-cyan-600 mb-2" />
                <h4 className="font-semibold text-sm text-gray-900">{m.label}</h4>
                <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
                {!available && <p className="text-xs text-red-500 mt-1">Pas assez de variables</p>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">
          {METHODS.find((m) => m.key === method)?.label}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => { setMethod(null); setPcaResult(null); setCaResult(null); setMcaResult(null); }} className="btn-secondary text-sm">
            Changer de méthode
          </button>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
        </div>
      </div>

      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3">Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {method === 'pca' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variables numériques (toutes si aucune sélection)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded border-gray-300 text-cyan-600" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          {method === 'ca' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variable en ligne</label>
                <select value={rowCol} onChange={(e) => setRowCol(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" title="Variable en ligne">
                  <option value="">Sélectionner...</option>
                  {catCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variable en colonne</label>
                <select value={colCol} onChange={(e) => setColCol(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500" title="Variable en colonne">
                  <option value="">Sélectionner...</option>
                  {catCols.filter((c) => c !== rowCol).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {method === 'mca' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variables catégorielles (toutes si aucune sélection)
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 space-y-1">
                {catCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded border-gray-300 text-cyan-600" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de composantes</label>
            <input
              type="number" min={2} max={20} value={nComponents}
              onChange={(e) => setNComponents(Math.max(2, parseInt(e.target.value) || 2))}
              title="Nombre de composantes"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="mt-4">
          <button onClick={handleRun} disabled={isLoading} className="btn-primary flex items-center gap-2">
            {isLoading ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Calcul en cours...</>
            ) : (
              <><Play className="w-4 h-4" /> Lancer l'analyse</>
            )}
          </button>
        </div>
      </div>

      {pcaResult && <PCAResultView result={pcaResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
      {caResult && <CAResultView result={caResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
      {mcaResult && <MCAResultView result={mcaResult} showDetails={showDetails} setShowDetails={setShowDetails} />}
    </div>
  );
}
