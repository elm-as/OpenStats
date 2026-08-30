import React from 'react';
import { Share2, XCircle, Copy } from 'lucide-react';

interface CanvasShareModalProps {
  shareUrl: string | null;
  onClose: () => void;
  onCopy: () => void;
}

export function CanvasShareModal({ shareUrl, onClose, onCopy }: CanvasShareModalProps) {
  if (!shareUrl) return null;

  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-surface-900 border border-accent-500/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-5 w-[400px] animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-bold text-surface-50 text-lg flex items-center gap-2">
          <Share2 className="text-accent-400" size={20} />
          Lien généré !
        </h3>
        <button onClick={onClose} className="text-surface-400 hover:text-white">
          <XCircle size={20} />
        </button>
      </div>
      <p className="text-surface-300 text-sm mb-4">
        Ce lien permet à n'importe qui de consulter votre workflow et ses résultats en lecture seule.
      </p>
      <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/[0.06]">
        <input
          type="text"
          readOnly
          value={shareUrl}
          className="bg-transparent border-none outline-none text-surface-200 text-xs w-full px-2"
        />
        <button
          id="copy-btn"
          onClick={onCopy}
          className="shrink-0 bg-white/10 hover:bg-white/20 text-surface-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
        >
          <Copy size={14} /> Copier le lien
        </button>
      </div>
    </div>
  );
}
