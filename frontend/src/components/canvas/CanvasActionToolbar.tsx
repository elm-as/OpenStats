import React from 'react';
import { Play, Loader2, Share2, Save, FileCode } from 'lucide-react';

interface CanvasActionToolbarProps {
  nodesCount: number;
  isRunning: boolean;
  isSharing: boolean;
  onOpenGlobalCodeModal: () => void;
  onSaveTemplate: () => void;
  onShare: () => void;
  onRun: () => void;
}

export function CanvasActionToolbar({
  nodesCount,
  isRunning,
  isSharing,
  onOpenGlobalCodeModal,
  onSaveTemplate,
  onShare,
  onRun,
}: CanvasActionToolbarProps) {
  const isDisabled = nodesCount === 0;

  return (
    <div className="absolute bottom-8 right-8 flex items-center gap-3 z-10">
      <button
        className="px-4 py-3 rounded-full font-semibold text-xs shadow-lg border border-white/[0.08] bg-surface-900/90 hover:bg-surface-800 text-accent-300 hover:text-white backdrop-blur-md transition-all flex items-center gap-2"
        onClick={onOpenGlobalCodeModal}
        disabled={isDisabled}
        title="Exporter le script Python & R complet de ce Canvas"
      >
        <FileCode size={15} /> Code Source Canvas (.py / .R)
      </button>

      <button
        className="px-4 py-3 rounded-full font-semibold text-xs shadow-lg border border-white/[0.08] bg-surface-900/80 hover:bg-surface-800 text-surface-200 hover:text-white backdrop-blur-md transition-all flex items-center gap-2"
        onClick={onSaveTemplate}
        disabled={isDisabled}
        title="Enregistrer comme modèle personnalisé"
      >
        <Save size={15} /> Enregistrer Modèle
      </button>

      <button
        className={`px-5 py-3.5 rounded-full font-bold text-sm shadow-lg border border-white/[0.08] backdrop-blur-md transition-all flex items-center gap-2 ${
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
            <Loader2 size={16} className="animate-spin" /> ...
          </>
        ) : (
          <>
            <Share2 size={16} /> Partager
          </>
        )}
      </button>

      <button
        className={`px-7 py-3.5 rounded-full font-black text-sm shadow-[0_0_30px_rgba(56,189,248,0.3)] hover:shadow-[0_0_40px_rgba(56,189,248,0.5)] hover:-translate-y-1 transition-all flex items-center gap-2.5 ${
          isRunning
            ? 'bg-surface-600 text-surface-300 cursor-wait'
            : 'bg-accent-500 hover:bg-accent-400 text-surface-950'
        }`}
        onClick={onRun}
        disabled={isRunning || isDisabled}
      >
        {isRunning ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Exécution en cours...
          </>
        ) : (
          <>
            <Play fill="currentColor" size={18} /> Exécuter le Workflow
          </>
        )}
      </button>
    </div>
  );
}
