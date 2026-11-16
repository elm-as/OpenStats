import React, { useRef } from 'react';
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
  FolderDown,
  FolderUp,
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
  onExportWorkspace: () => void;
  onImportWorkspace: (file: File) => void;
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
  onExportWorkspace,
  onImportWorkspace,
  onOpenGlobalCodeModal,
  onSaveTemplate,
  onShare,
  onRun,
}: CanvasActionToolbarProps) {
  const isDisabled = nodesCount === 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportWorkspace(file);
      e.target.value = '';
    }
  };

  return (
    <div className="absolute bottom-6 right-8 flex items-center gap-2.5 z-20">
      {/* Input de fichier masqué pour charger un projet */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".openstats,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Outils Navigation & Historique */}
      <div className="ui-panel flex items-center rounded-full p-1 shadow-lg">
        <button
          className="p-2 rounded-full text-surface-300 hover:text-surface-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <button
          className="p-2 rounded-full text-surface-300 hover:text-surface-100 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 size={15} />
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1" />
        <button
          className="p-2 rounded-full text-surface-300 hover:text-accent-400 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onAutoLayout}
          disabled={isDisabled}
          title="Organiser automatiquement les nœuds (Auto-Layout)"
        >
          <LayoutGrid size={15} />
        </button>
        <button
          className={`p-2 rounded-full transition-colors ${
            showMiniMap
              ? 'text-accent-400 bg-accent-500/15'
              : 'text-surface-300 hover:text-surface-100 hover:bg-white/10'
          }`}
          onClick={onToggleMiniMap}
          title={showMiniMap ? 'Masquer la Minimap' : 'Afficher la Minimap'}
        >
          <Map size={15} />
        </button>
        <button
          className="p-2 rounded-full text-surface-300 hover:text-accent-400 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onOpenSearch}
          disabled={isDisabled}
          title="Rechercher un nœud (Ctrl+F)"
        >
          <Search size={15} />
        </button>
      </div>

      {/* Projet (.openstats) */}
      <div className="ui-panel flex items-center rounded-full p-1 shadow-lg">
        <button
          className="p-2 rounded-full text-surface-300 hover:text-emerald-400 hover:bg-white/10 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          title="Ouvrir un projet (.openstats)"
        >
          <FolderUp size={15} />
        </button>
        <button
          className="p-2 rounded-full text-surface-300 hover:text-emerald-400 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          onClick={onExportWorkspace}
          disabled={isDisabled}
          title="Exporter le projet complet (.openstats)"
        >
          <FolderDown size={15} />
        </button>
      </div>

      {/* Code Source */}
      <button
        className="ui-btn ui-panel px-3.5 py-2.5 rounded-full font-semibold text-xs shadow-md text-accent-400 flex items-center gap-2"
        onClick={onOpenGlobalCodeModal}
        disabled={isDisabled}
        title="Exporter le script Python & R complet de ce Canvas"
      >
        <FileCode size={15} /> Code Source
      </button>

      {/* Modèle */}
      <button
        className="ui-btn ui-panel px-3.5 py-2.5 rounded-full font-semibold text-xs shadow-md flex items-center gap-2"
        onClick={onSaveTemplate}
        disabled={isDisabled}
        title="Enregistrer comme modèle personnalisé"
      >
        <Save size={15} /> Modèle
      </button>

      {/* Partage */}
      <button
        className={`ui-btn ui-panel px-3.5 py-2.5 rounded-full font-semibold text-xs shadow-md flex items-center gap-2 ${
          isSharing ? 'opacity-60 cursor-wait' : ''
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
        className={`ui-btn px-5 py-2.5 rounded-full font-bold text-xs shadow-md transition-colors flex items-center gap-2 ${
          isRunning
            ? 'bg-surface-700 text-surface-300 cursor-wait'
            : 'ui-btn-primary'
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
