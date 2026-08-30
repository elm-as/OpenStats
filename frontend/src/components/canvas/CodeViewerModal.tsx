import React, { useState } from 'react';
import { X, Copy, Download, Check, FileCode, Code, Terminal } from 'lucide-react';

interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pythonCode: string;
  rCode: string;
  onExportNotebook?: () => void;
}

export default function CodeViewerModal({
  isOpen,
  onClose,
  title,
  pythonCode,
  rCode,
  onExportNotebook,
}: CodeViewerModalProps) {
  const [language, setLanguage] = useState<'python' | 'r'>('python');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentCode = language === 'python' ? pythonCode : rCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = language === 'python' ? 'py' : 'R';
    const filename = `script_reproductible.${ext}`;
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in nodrag nopan nowheel">
      <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-surface-950/60">
          <div className="flex items-center gap-2.5">
            <FileCode size={18} className="text-accent-400" />
            <div>
              <h3 className="text-sm font-bold text-surface-100">{title}</h3>
              <p className="text-[11px] text-surface-400">Code source reproductible (Python & R)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-surface-400 hover:text-surface-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Barre de contrôle des langages */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-surface-950/40 border-b border-white/[0.06]">
          <div className="flex items-center gap-1.5 bg-surface-950 p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setLanguage('python')}
              className={`text-xs font-semibold py-1 px-3 rounded-lg transition-all flex items-center gap-1.5 ${
                language === 'python'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Terminal size={13} /> Python (pandas, statsmodels)
            </button>
            <button
              type="button"
              onClick={() => setLanguage('r')}
              className={`text-xs font-semibold py-1 px-3 rounded-lg transition-all flex items-center gap-1.5 ${
                language === 'r'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <Code size={13} /> R (tidyverse, stats)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onExportNotebook && (
              <button
                type="button"
                onClick={onExportNotebook}
                className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <FileCode size={13} /> Jupyter (.ipynb)
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-surface-200 border border-white/10 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-300 border border-accent-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Download size={13} /> Télécharger .{language === 'python' ? 'py' : 'R'}
            </button>
          </div>
        </div>

        {/* Zone de Code */}
        <div className="flex-1 p-4 overflow-y-auto bg-surface-950 font-mono text-xs leading-relaxed text-surface-200 custom-scrollbar">
          <pre className="whitespace-pre-wrap selection:bg-accent-500/30">
            {currentCode}
          </pre>
        </div>

        {/* Pied de page */}
        <div className="px-5 py-2.5 border-t border-white/10 bg-surface-950/60 flex items-center justify-between text-[11px] text-surface-400">
          <span>Reproductibilité scientifique garantie par <strong>OpenStats by Elmas</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-surface-300 text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
