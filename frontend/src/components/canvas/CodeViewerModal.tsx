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

export default function CodeViewerModal(props: CodeViewerModalProps) {
  const { isOpen, onClose, title, pythonCode, rCode, onExportNotebook } = props;
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
    const blob = new Blob([currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `script_reproductible.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 nodrag nopan nowheel">
      <div className="ui-panel w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* En-tête */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <FileCode size={16} className="text-accent-400" />
            <div>
              <h3 className="text-sm font-bold text-[var(--ui-text)]">{title}</h3>
              <p className="text-[11px] ui-t-muted">Script reproductible (Python &amp; R)</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-ghost p-1">
            <X size={16} />
          </button>
        </div>

        {/* Barre de contrôle des langages */}
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLanguage('python')}
              className={`ui-btn text-xs ${language === 'python' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <Terminal size={13} /> Python
            </button>
            <button
              type="button"
              onClick={() => setLanguage('r')}
              className={`ui-btn text-xs ${language === 'r' ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
            >
              <Code size={13} /> R
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onExportNotebook && (
              <button type="button" onClick={onExportNotebook} className="ui-btn text-xs">
                <FileCode size={13} /> Notebook (.ipynb)
              </button>
            )}
            <button type="button" onClick={handleCopy} className="ui-btn text-xs">
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button type="button" onClick={handleDownload} className="ui-btn ui-btn-primary text-xs">
              <Download size={13} /> .{language === 'python' ? 'py' : 'R'}
            </button>
          </div>
        </div>

        {/* Zone de Code */}
        <div
          className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed ui-scroll"
          style={{ background: 'var(--ui-bg-sunken)', color: 'var(--ui-text)' }}
        >
          <pre className="whitespace-pre-wrap">{currentCode}</pre>
        </div>

        {/* Pied de page */}
        <div
          className="px-4 py-2 border-t flex items-center justify-end"
          style={{ borderColor: 'var(--ui-border)' }}
        >
          <button type="button" onClick={onClose} className="ui-btn text-xs">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
