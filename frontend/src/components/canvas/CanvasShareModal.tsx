import React from 'react';
import { Share2, X, Copy, Check } from 'lucide-react';

interface CanvasShareModalProps {
  shareUrl: string | null;
  copied?: boolean;
  onClose: () => void;
  onCopy: () => void;
}

export function CanvasShareModal(props: CanvasShareModalProps) {
  const { shareUrl, copied = false, onClose, onCopy } = props;
  if (!shareUrl) return null;

  return (
    <div
      className="ui-panel absolute top-12 left-1/2 -translate-x-1/2 z-50 p-4 w-[400px]"
      style={{ borderColor: 'var(--ui-border-strong)' }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm text-[var(--ui-text)] flex items-center gap-2">
          <Share2 className="text-accent-400" size={16} />
          Lien de partage
        </h3>
        <button onClick={onClose} className="ui-btn ui-btn-ghost p-1" title="Fermer">
          <X size={15} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="ui-input text-xs w-full"
        />
        <button onClick={onCopy} className="ui-btn ui-btn-primary text-xs shrink-0">
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  );
}
