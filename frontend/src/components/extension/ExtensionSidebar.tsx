import React from 'react';
import { BookOpen, Sparkles, History, Loader2, Play } from 'lucide-react';

interface ExtensionSidebarProps {
  templates?: any[];
  extensions?: any[];
  prompt: string;
  setPrompt: (p: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onApplyTemplate: (tpl: { name: string; description: string; code: string }) => void;
  onSelectExtension: (ext: { name: string; description: string; code: string }) => void;
  onRunExtension: (id: string) => void;
}

export function ExtensionSidebar({
  templates,
  extensions,
  prompt,
  setPrompt,
  isGenerating,
  onGenerate,
  onApplyTemplate,
  onSelectExtension,
  onRunExtension,
}: ExtensionSidebarProps) {
  return (
    <div className="lg:col-span-4 space-y-6 overflow-y-auto max-h-[800px] pr-2 custom-scrollbar">
      {/* Template Library */}
      <div className="card border-primary-500/20 bg-primary-500/5">
        <div className="p-4 border-b border-primary-500/10 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-400" />
          <h3 className="font-black text-white text-sm uppercase tracking-widest">
            Bibliothèque de Modèles
          </h3>
        </div>
        <div className="p-2 space-y-2">
          {templates?.map((tpl, i) => (
            <button
              key={i}
              onClick={() => onApplyTemplate(tpl)}
              className="w-full text-left p-3 rounded-xl hover:bg-primary-500/10 border border-transparent hover:border-primary-500/20 transition-all group"
            >
              <p className="text-xs font-bold text-white group-hover:text-primary-300 transition-colors">
                {tpl.name}
              </p>
              <p className="text-[10px] text-surface-500 mt-1 line-clamp-2">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI Assistant Card */}
      <div className="card overflow-hidden border-accent-500/20 bg-accent-500/5">
        <div className="p-4 border-b border-accent-500/10 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-400" />
          <h3 className="font-black text-white text-sm uppercase tracking-widest">
            Générateur DeepSeek
          </h3>
        </div>
        <div className="p-4 space-y-4">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Décrivez l'analyse souhaitée en français..."
            className="w-full bg-surface-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-surface-600 focus:ring-2 focus:ring-accent-500/50 transition-all"
            rows={4}
          />
          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt}
            className="btn-primary w-full py-3 text-xs"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Générer avec l'IA
          </button>
        </div>
      </div>

      {/* Saved Scripts */}
      <div className="card">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <History className="w-5 h-5 text-surface-400" />
          <h3 className="font-black text-white text-sm uppercase tracking-widest">
            Mes Sauvegardes
          </h3>
        </div>
        <div className="p-2 space-y-1">
          {extensions?.map(ext => (
            <div
              key={ext.id}
              className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
            >
              <button
                onClick={() =>
                  onSelectExtension({
                    name: ext.name,
                    code: ext.code,
                    description: ext.description,
                  })
                }
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm font-bold text-white truncate">{ext.name}</p>
                <p className="text-[10px] text-surface-500 truncate">
                  {ext.description || 'Script sauvegardé'}
                </p>
              </button>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onRunExtension(ext.id)}
                  className="p-1.5 rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20"
                  title="Exécuter"
                >
                  <Play className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
