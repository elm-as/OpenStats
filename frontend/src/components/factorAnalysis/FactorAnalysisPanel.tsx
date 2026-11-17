import { useState } from 'react';
import { useRunPCAMutation, useRunCAMutation, useRunMCAMutation } from '../../store/api';
import type { DataCapabilities, PCAResult, CAResult, MCAResult } from '../../types';
import { ArrowLeft, Play, Layers, Grid3X3 } from 'lucide-react';
import { PCAResultView, CAResultView } from './PcaCaResultViews';
import { MCAResultView } from './McaResultView';

const METHODS = [
  { key: 'pca', label: 'ACP — Analyse en Composantes Principales', icon: Layers },
  { key: 'ca', label: 'AFC — Analyse Factorielle des Correspondances', icon: Grid3X3 },
  { key: 'mca', label: 'ACM — Analyse des Correspondances Multiples', icon: Layers },
] as const;

type MethodKey = (typeof METHODS)[number]['key'];

interface Props {
  datasetId: string;
  capabilities: DataCapabilities;
  onBack: () => void;
  initialMethod?: string;
}

export default function FactorAnalysisPanel(props: Props) {
  const { datasetId, capabilities, onBack, initialMethod } = props;
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
        setPcaResult(await runPCA({ id: datasetId, columns: cols, n_components: nComponents }).unwrap());
      } else if (method === 'ca') {
        if (!rowCol || !colCol) { setError('Sélectionnez les deux variables'); return; }
        if (rowCol === colCol) { setError('Les deux variables doivent être différentes'); return; }
        setCaResult(await runCA({ id: datasetId, row_col: rowCol, col_col: colCol, n_components: nComponents }).unwrap());
      } else if (method === 'mca') {
        const cols = selectedCols.length > 0 ? selectedCols : undefined;
        setMcaResult(await runMCA({ id: datasetId, columns: cols, n_components: nComponents }).unwrap());
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Erreur inconnue');
    }
  };

  if (!method) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--ui-text)]">Analyse factorielle</h3>
          <button onClick={onBack} className="ui-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
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
                className={`ui-panel text-left px-3.5 py-3 flex items-center gap-2.5 transition-colors ${available ? 'hover:border-accent-500/40 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              >
                <Icon className="w-4 h-4 text-accent-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-xs text-[var(--ui-text)] block">{m.label}</span>
                  {!available && <span className="text-[11px] text-red-400">Variables insuffisantes</span>}
                </div>
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
        <h3 className="text-base font-bold text-[var(--ui-text)]">
          {METHODS.find((m) => m.key === method)?.label}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => { setMethod(null); setPcaResult(null); setCaResult(null); setMcaResult(null); }} className="ui-btn text-xs">
            Changer de méthode
          </button>
          <button onClick={onBack} className="ui-btn text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </button>
        </div>
      </div>

      <div className="ui-panel p-4">
        <h4 className="font-semibold text-xs uppercase tracking-wider ui-t-muted mb-3">Configuration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {method === 'pca' && (
            <div>
              <label className="ui-label block mb-1">
                Variables numériques (toutes si aucune sélection)
              </label>
              <div
                className="max-h-40 overflow-y-auto rounded p-2 space-y-1 border ui-scroll"
                style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
              >
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-white/[0.04] text-[var(--ui-text)]">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          {method === 'ca' && (
            <>
              <div>
                <label className="ui-label block mb-1">Variable en ligne</label>
                <select value={rowCol} onChange={(e) => setRowCol(e.target.value)} className="ui-select w-full text-xs" title="Variable en ligne">
                  <option value="">Sélectionner...</option>
                  {catCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="ui-label block mb-1">Variable en colonne</label>
                <select value={colCol} onChange={(e) => setColCol(e.target.value)} className="ui-select w-full text-xs" title="Variable en colonne">
                  <option value="">Sélectionner...</option>
                  {catCols.filter((c) => c !== rowCol).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </>
          )}

          {method === 'mca' && (
            <div>
              <label className="ui-label block mb-1">
                Variables catégorielles (toutes si aucune sélection)
              </label>
              <div
                className="max-h-40 overflow-y-auto rounded p-2 space-y-1 border ui-scroll"
                style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
              >
                {catCols.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-white/[0.04] text-[var(--ui-text)]">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="ui-label block mb-1">Nombre de composantes</label>
            <input
              type="number" min={2} max={20} value={nComponents}
              onChange={(e) => setNComponents(Math.max(2, parseInt(e.target.value) || 2))}
              title="Nombre de composantes"
              className="ui-input w-full text-xs ui-num"
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded border border-red-500/35 bg-red-500/10 text-xs text-red-400">{error}</div>
        )}

        <div className="mt-4">
          <button onClick={handleRun} disabled={isLoading} className="ui-btn ui-btn-primary text-xs">
            {isLoading ? (
              <><div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" /> Calcul en cours...</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Lancer l'analyse</>
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
