import React from 'react';
import {
  Play,
  Loader2,
  Share2,
  Save,
  FileCode,
  Undo2,
  Redo2,
  LayoutGrid,
  Map,
  Search,
} from 'lucide-react';

interface CanvasActionToolbarProps {
  nodesCount: number;
  isRunning: boolean;
  isSharing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showMiniMap: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onToggleMiniMap: () => void;
  onOpenSearch: () => void;
  onOpenGlobalCodeModal: () => void;
  onSaveTemplate: () => void;
  onShare: () => void;
  onRun: () => void;
}

export function CanvasActionToolbar({
  nodesCount,
  isRunning,
  isSharing,
  canUndo,
  canRedo,
  showMiniMap,
  onUndo,
  onRedo,
  onAutoLayout,
  onToggleMiniMap,
  onOpenSearch,
  onOpenGlobalCodeModal,
  onSaveTemplate,
  onShare,
  onRun,
}: CanvasActionToolbarProps) {
  const isDisabled = nodesCount === 0;

  return (
    <div className="absolute bottom-8 right-8 flex items-center gap-2.5 z-10">
      {/* Outils Navigation & Historique */}
      <div className="flex items-center bg-surface-900/90 border border-white/[0.08] rounded-full p-1 shadow-xl backdrop-blur-md">
        <button
          className="p-2.5 rounded-full text-surface-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <button
          className="p-2.5 rounded-full text-surface-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1" />
        <button
          className="p-2.5 rounded-full text-surface-300 hover:text-accent-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onAutoLayout}
          disabled={isDisabled}
          title="Organiser automatiquement les nœuds (Auto-Layout)"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          className={`p-2.5 rounded-full transition-colors ${
            showMiniMap
              ? 'text-accent-400 bg-accent-500/10'
              : 'text-surface-300 hover:text-white hover:bg-white/10'
          }`}
          onClick={onToggleMiniMap}
          title={showMiniMap ? 'Masquer la Minimap' : 'Afficher la Minimap'}
        >
          <Map size={15} />
        </button>
        <button
          className="p-2.5 rounded-full text-surface-300 hover:text-accent-300 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onOpenSearch}
          disabled={isDisabled}
          title="Rechercher un nœud (Ctrl+F)"
        >
          <Search size={15} />
        </button>
      </div>

      {/* Code Source */}
      <button
        className="px-4 py-3 rounded-full font-semibold text-xs shadow-lg border border-white/[0.08] bg-surface-900/90 hover:bg-surface-800 text-accent-300 hover:text-white backdrop-blur-md transition-all flex items-center gap-2"
        onClick={onOpenGlobalCodeModal}
        disabled={isDisabled}
        title="Exporter le script Python & R complet de ce Canvas"
      >
        <FileCode size={15} /> Code Source
      </button>

      {/* Modèle */}
      <button
        className="px-4 py-3 rounded-full font-semibold text-xs shadow-lg border border-white/[0.08] bg-surface-900/80 hover:bg-surface-800 text-surface-200 hover:text-white backdrop-blur-md transition-all flex items-center gap-2"
        onClick={onSaveTemplate}
        disabled={isDisabled}
        title="Enregistrer comme modèle personnalisé"
      >
        <Save size={15} /> Modèle
      </button>

      {/* Partage */}
      <button
        className={`px-4 py-3 rounded-full font-bold text-xs shadow-lg border border-white/[0.08] backdrop-blur-md transition-all flex items-center gap-2 ${
          isSharing
            ? 'bg-surface-800 text-surface-400 cursor-wait'
            : 'bg-surface-900/80 hover:bg-surface-800 text-surface-200 hover:text-white'
        }`}
        onClick={onShare}
        disabled={isSharing || isDisabled}
        title="Générer un lien public en lecture seule"
      >
        {isSharing ? (
          <>
            <Loader2 size={15} className="animate-spin" /> ...
          </>
        ) : (
          <>
            <Share2 size={15} /> Partager
          </>
        )}
      </button>

      {/* Exécution Principale */}
      <button
        className={`px-7 py-3.5 rounded-full font-black text-sm shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] hover:-translate-y-0.5 transition-all flex items-center gap-2.5 ${
          isRunning
            ? 'bg-surface-600 text-surface-300 cursor-wait'
            : 'bg-accent-500 hover:bg-accent-400 text-surface-950'
        }`}
        onClick={onRun}
        disabled={isRunning || isDisabled}
      >
        {isRunning ? (
          <>
            <Loader2 size={17} className="animate-spin" /> Exécution...
          </>
        ) : (
          <>
            <Play fill="currentColor" size={17} /> Exécuter le Workflow
          </>
        )}
      </button>
    </div>
  );
}
