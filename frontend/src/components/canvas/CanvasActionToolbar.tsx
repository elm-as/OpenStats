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

export function CanvasActionToolbar(props: CanvasActionToolbarProps) {
  const isDisabled = props.nodesCount === 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      props.onImportWorkspace(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        ref={fileInputRef}
        type="file"
        accept=".openstats,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={props.onUndo}
          disabled={!props.canUndo}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={props.onRedo}
          disabled={!props.canRedo}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={props.onAutoLayout}
          disabled={isDisabled}
          title="Organiser automatiquement les nœuds"
        >
          <LayoutGrid size={14} />
        </button>
        <button
          type="button"
          className={`ui-btn ui-focusable ${props.showMiniMap ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
          onClick={props.onToggleMiniMap}
          title={props.showMiniMap ? 'Masquer la Minimap' : 'Afficher la Minimap'}
        >
          <Map size={14} />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={props.onOpenSearch}
          disabled={isDisabled}
          title="Rechercher un nœud (Ctrl+F)"
        >
          <Search size={14} />
        </button>
      </div>

      <span className="ui-sep" aria-hidden />

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={() => fileInputRef.current?.click()}
          title="Ouvrir un projet (.openstats)"
        >
          <FolderUp size={14} />
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-ghost ui-focusable"
          onClick={props.onExportWorkspace}
          disabled={isDisabled}
          title="Exporter le projet (.openstats)"
        >
          <FolderDown size={14} />
        </button>
      </div>

      <span className="ui-sep" aria-hidden />

      <button
        type="button"
        className="ui-btn ui-focusable"
        onClick={props.onOpenGlobalCodeModal}
        disabled={isDisabled}
        title="Exporter le script Python & R complet"
      >
        <FileCode size={13} /> Code
      </button>

      <button
        type="button"
        className="ui-btn ui-focusable"
        onClick={props.onSaveTemplate}
        disabled={isDisabled}
        title="Enregistrer comme modèle"
      >
        <Save size={13} /> Modèle
      </button>

      <button
        type="button"
        className="ui-btn ui-focusable"
        onClick={props.onShare}
        disabled={props.isSharing || isDisabled}
        title="Générer un lien de partage en lecture seule"
      >
        {props.isSharing ? <Loader2 size={13} className="animate-spin" /> : <Share2 size={13} />}
        Partager
      </button>

      <button
        type="button"
        className="ui-btn ui-btn-primary ui-focusable"
        onClick={props.onRun}
        disabled={props.isRunning || isDisabled}
      >
        {props.isRunning ? (
          <>
            <Loader2 size={13} className="animate-spin" /> Exécution…
          </>
        ) : (
          <>
            <Play size={13} fill="currentColor" /> Exécuter
          </>
        )}
      </button>
    </div>
  );
}
