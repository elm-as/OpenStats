import { useState, useCallback } from 'react';
import {
  LayoutGrid, Plus, Play, Save, Download, ChevronRight,
  Database, Filter, BarChart3, Brain, FileText, Settings2,
  Trash2, Copy, GripVertical, Sparkles, ChevronDown,
} from 'lucide-react';

interface Props {
  datasetId: string;
  onBack?: () => void;
}

interface CanvasBlock {
  id: string;
  type: BlockType;
  label: string;
  config: Record<string, any>;
  inputs: string[];
  outputs: string[];
  x: number;
  y: number;
  expanded?: boolean;
}

type BlockType = 
  | 'data_source' 
  | 'clean' 
  | 'filter' 
  | 'transform' 
  | 'descriptive' 
  | 'correlation' 
  | 'test'
  | 'model'
  | 'predict'
  | 'report'
  | 'viz';

const BLOCK_META: Record<BlockType, { 
  label: string; 
  icon: typeof Database; 
  color: string; 
  bg: string;
  inputs: number;
  outputs: number;
  category: 'data' | 'analysis' | 'model' | 'output';
}> = {
  data_source: { 
    label: 'Source de données', 
    icon: Database, 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10',
    inputs: 0,
    outputs: 1,
    category: 'data',
  },
  clean: { 
    label: 'Nettoyage', 
    icon: Filter, 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10',
    inputs: 1,
    outputs: 1,
    category: 'data',
  },
  filter: { 
    label: 'Filtrage', 
    icon: Settings2, 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10',
    inputs: 1,
    outputs: 1,
    category: 'data',
  },
  transform: { 
    label: 'Transformation', 
    icon: Sparkles, 
    color: 'text-purple-400', 
    bg: 'bg-purple-500/10',
    inputs: 1,
    outputs: 1,
    category: 'data',
  },
  descriptive: { 
    label: 'Statistiques', 
    icon: BarChart3, 
    color: 'text-cyan-400', 
    bg: 'bg-cyan-500/10',
    inputs: 1,
    outputs: 1,
    category: 'analysis',
  },
  correlation: { 
    label: 'Corrélations', 
    icon: BarChart3, 
    color: 'text-indigo-400', 
    bg: 'bg-indigo-500/10',
    inputs: 1,
    outputs: 1,
    category: 'analysis',
  },
  test: { 
    label: 'Test statistique', 
    icon: Sparkles, 
    color: 'text-pink-400', 
    bg: 'bg-pink-500/10',
    inputs: 1,
    outputs: 1,
    category: 'analysis',
  },
  model: { 
    label: 'Modélisation', 
    icon: Brain, 
    color: 'text-rose-400', 
    bg: 'bg-rose-500/10',
    inputs: 1,
    outputs: 1,
    category: 'model',
  },
  predict: { 
    label: 'Prédiction', 
    icon: Sparkles, 
    color: 'text-orange-400', 
    bg: 'bg-orange-500/10',
    inputs: 2, // Needs data + model
    outputs: 1,
    category: 'model',
  },
  viz: { 
    label: 'Visualisation', 
    icon: BarChart3, 
    color: 'text-teal-400', 
    bg: 'bg-teal-500/10',
    inputs: 1,
    outputs: 0,
    category: 'output',
  },
  report: { 
    label: 'Rapport', 
    icon: FileText, 
    color: 'text-gray-400', 
    bg: 'bg-gray-500/10',
    inputs: 1,
    outputs: 0,
    category: 'output',
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  data: 'Données',
  analysis: 'Analyse',
  model: 'Modélisation',
  output: 'Sortie',
};

export default function LowCodeCanvas({ datasetId, onBack }: Props) {
  const [blocks, setBlocks] = useState<CanvasBlock[]>([
    {
      id: 'source-1',
      type: 'data_source',
      label: 'Dataset source',
      config: { datasetId },
      inputs: [],
      outputs: ['data'],
      x: 50,
      y: 100,
      expanded: true,
    },
  ]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const addBlock = useCallback((type: BlockType) => {
    const meta = BLOCK_META[type];
    const newBlock: CanvasBlock = {
      id: `${type}-${Date.now()}`,
      type,
      label: meta.label,
      config: {},
      inputs: Array(meta.inputs).fill(''),
      outputs: meta.outputs > 0 ? ['output'] : [],
      x: 250 + blocks.length * 180,
      y: 100 + (blocks.length % 3) * 120,
      expanded: true,
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlock(newBlock.id);
  }, [blocks.length]);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlock === id) setSelectedBlock(null);
  }, [selectedBlock]);

  const duplicateBlock = useCallback((block: CanvasBlock) => {
    const newBlock: CanvasBlock = {
      ...block,
      id: `${block.type}-${Date.now()}`,
      x: block.x + 20,
      y: block.y + 20,
    };
    setBlocks(prev => [...prev, newBlock]);
  }, []);

  const updateBlockConfig = useCallback((id: string, config: Record<string, any>) => {
    setBlocks(prev => prev.map(b => 
      b.id === id ? { ...b, config: { ...b.config, ...config } } : b
    ));
  }, []);

  const toggleBlockExpanded = useCallback((id: string) => {
    setBlocks(prev => prev.map(b => 
      b.id === id ? { ...b, expanded: !b.expanded } : b
    ));
  }, []);

  const executeCanvas = useCallback(() => {
    setIsExecuting(true);
    // TODO: Implement execution logic
    setTimeout(() => setIsExecuting(false), 2000);
  }, []);

  const saveWorkflow = useCallback(() => {
    const workflow = {
      datasetId,
      blocks,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow_${datasetId}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [datasetId, blocks]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-accent-400" />
            Canevas Low-Code
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Construisez votre pipeline d'analyse visuellement
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onBack && (
            <button onClick={onBack} className="btn-secondary flex items-center gap-2 text-sm">
              Retour aux résultats
            </button>
          )}
          <button
            onClick={saveWorkflow}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
          <button
            onClick={executeCanvas}
            disabled={isExecuting || blocks.length === 0}
            className="btn-primary flex items-center gap-2 text-sm bg-gradient-to-r from-accent-500 to-accent-600 disabled:opacity-50"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Exécution...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Exécuter
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Sidebar - Block Palette */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Blocs disponibles
            </h3>
            
            {Object.entries(CATEGORY_LABEL).map(([cat, label]) => (
              <div key={cat} className="mb-3">
                <button
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className="flex items-center justify-between w-full text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-200"
                >
                  {label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${activeCategory === cat ? 'rotate-180' : ''}`} />
                </button>
                
                {(activeCategory === cat || activeCategory === null) && (
                  <div className="space-y-1">
                    {Object.entries(BLOCK_META)
                      .filter(([, meta]) => meta.category === cat)
                      .map(([type, meta]) => {
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            onClick={() => addBlock(type as BlockType)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all hover:bg-white/5 ${meta.color}`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-gray-300">{meta.label}</span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick stats */}
          <div className="card p-4">
            <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Statistiques
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Blocs</span>
                <span className="text-gray-200 font-mono">{blocks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Entrées</span>
                <span className="text-gray-200 font-mono">
                  {blocks.filter(b => b.inputs.length > 0).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sorties</span>
                <span className="text-gray-200 font-mono">
                  {blocks.filter(b => b.outputs.length > 0).length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 card min-h-[600px] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)] bg-[length:20px_20px]" />
          
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Blocks */}
          {blocks.map((block) => {
            const meta = BLOCK_META[block.type];
            const Icon = meta.icon;
            const isSelected = selectedBlock === block.id;
            
            return (
              <div
                key={block.id}
                className={`absolute w-48 rounded-lg border transition-all ${
                  isSelected 
                    ? 'border-accent-500/50 shadow-glow-sm' 
                    : 'border-white/10 hover:border-white/20'
                } ${meta.bg}`}
                style={{ left: block.x, top: block.y }}
                onClick={() => setSelectedBlock(block.id)}
              >
                {/* Block Header */}
                <div className="flex items-center gap-2 p-3 border-b border-white/5">
                  <GripVertical className="w-4 h-4 text-gray-500 cursor-move" />
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                  <span className="text-sm font-medium text-gray-200 flex-1 truncate">
                    {block.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBlockExpanded(block.id);
                    }}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${block.expanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Connection Points */}
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="flex gap-1">
                    {Array.from({ length: meta.inputs }).map((_, i) => (
                      <div
                        key={`in-${i}`}
                        className="w-3 h-3 rounded-full bg-gray-500/50 border border-gray-400 hover:bg-accent-500/50 cursor-pointer"
                        title="Entrée"
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: meta.outputs }).map((_, i) => (
                      <div
                        key={`out-${i}`}
                        className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-400 hover:bg-emerald-400 cursor-pointer"
                        title="Sortie"
                      />
                    ))}
                  </div>
                </div>

                {/* Block Content */}
                {block.expanded && (
                  <div className="p-3 space-y-2 border-t border-white/5">
                    {/* Configuration based on block type */}
                    {block.type === 'model' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Type de modèle</label>
                        <select
                          value={block.config.modelType || 'auto'}
                          onChange={(e) => updateBlockConfig(block.id, { modelType: e.target.value })}
                          className="w-full text-xs bg-surface-800 border border-white/10 rounded px-2 py-1 text-gray-300"
                        >
                          <option value="auto">Auto (tous)</option>
                          <option value="linear">Linéaire</option>
                          <option value="rf">Random Forest</option>
                          <option value="xgboost">XGBoost</option>
                          <option value="svm">SVM</option>
                        </select>
                        
                        <label className="text-xs text-gray-400">Variable cible</label>
                        <input
                          type="text"
                          placeholder="Nom de la colonne..."
                          value={block.config.target || ''}
                          onChange={(e) => updateBlockConfig(block.id, { target: e.target.value })}
                          className="w-full text-xs bg-surface-800 border border-white/10 rounded px-2 py-1 text-gray-300"
                        />
                      </div>
                    )}

                    {block.type === 'clean' && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={block.config.removeDuplicates !== false}
                            onChange={(e) => updateBlockConfig(block.id, { removeDuplicates: e.target.checked })}
                            className="rounded border-gray-500"
                          />
                          Supprimer les doublons
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={block.config.handleMissing !== false}
                            onChange={(e) => updateBlockConfig(block.id, { handleMissing: e.target.checked })}
                            className="rounded border-gray-500"
                          />
                          Gérer les valeurs manquantes
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={block.config.removeOutliers || false}
                            onChange={(e) => updateBlockConfig(block.id, { removeOutliers: e.target.checked })}
                            className="rounded border-gray-500"
                          />
                          Traiter les outliers
                        </label>
                      </div>
                    )}

                    {block.type === 'viz' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Type de graphique</label>
                        <select
                          value={block.config.chartType || 'histogram'}
                          onChange={(e) => updateBlockConfig(block.id, { chartType: e.target.value })}
                          className="w-full text-xs bg-surface-800 border border-white/10 rounded px-2 py-1 text-gray-300"
                        >
                          <option value="histogram">Histogramme</option>
                          <option value="scatter">Nuage de points</option>
                          <option value="box">Boîte à moustaches</option>
                          <option value="heatmap">Heatmap</option>
                          <option value="line">Ligne</option>
                        </select>
                      </div>
                    )}

                    {/* Generic config display for other types */}
                    {!['model', 'clean', 'viz'].includes(block.type) && (
                      <div className="text-xs text-gray-400">
                        Configuration via panneau latéral
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 pt-2 border-t border-white/5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateBlock(block);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
                        title="Dupliquer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <LayoutGrid className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Cliquez sur un bloc dans la barre latérale pour commencer</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="card p-3">
        <div className="flex items-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500/50 border border-gray-400" />
            <span>Entrée</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500/50 border border-emerald-400" />
            <span>Sortie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border border-accent-500/50" />
            <span>Sélectionné</span>
          </div>
        </div>
      </div>
    </div>
  );
}
