import React from 'react';
import { BookOpen, Wand2, History, Loader2, Play } from 'lucide-react';

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

export function ExtensionSidebar(props: ExtensionSidebarProps) {
  const {
    templates,
    extensions,
    prompt,
    setPrompt,
    isGenerating,
    onGenerate,
    onApplyTemplate,
    onSelectExtension,
    onRunExtension,
  } = props;

  return (
    <div className="lg:col-span-4 space-y-4 overflow-y-auto max-h-[800px] pr-2 ui-scroll">
      {/* Template Library */}
      <div className="ui-panel border-accent-500/25">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent-400" />
          <h3 className="font-bold text-surface-100 text-xs uppercase tracking-wider">
            Modèles d'extension
          </h3>
        </div>
        <div className="p-2 space-y-1">
          {templates?.map((tpl, i) => (
            <button
              key={i}
              onClick={() => onApplyTemplate(tpl)}
              title={tpl.description}
              className="w-full text-left px-2.5 py-2 rounded hover:bg-accent-500/10 border border-transparent hover:border-accent-500/25 transition-colors group"
            >
              <p className="text-xs font-semibold text-surface-100 group-hover:text-accent-400 transition-colors">
                {tpl.name}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* AI Assistant Card */}
      <div className="ui-panel overflow-hidden border-accent-500/25">
        <div className="p-3 border-b border-white/10 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-accent-400" />
          <h3 className="font-bold text-surface-100 text-xs uppercase tracking-wider">
            Générateur de script
          </h3>
        </div>
        <div className="p-3 space-y-2.5">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Décrivez l'analyse souhaitée..."
            className="ui-input w-full rounded p-2 text-xs"
            rows={4}
          />
          <button
            onClick={onGenerate}
            disabled={isGenerating || !prompt}
            className="ui-btn ui-btn-primary w-full py-2 text-xs justify-center"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4" />
            )}
            Générer le script
          </button>
        </div>
      </div>

      {/* Saved Scripts */}
      <div className="ui-panel">
        <div className="p-3.5 border-b border-white/10 flex items-center gap-2">
          <History className="w-4 h-4 text-surface-400" />
          <h3 className="font-bold text-surface-100 text-xs uppercase tracking-wider">
            Mes Sauvegardes
          </h3>
        </div>
        <div className="p-2 space-y-1">
          {extensions?.map(ext => (
            <div
              key={ext.id}
              className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
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
                <p className="text-sm font-semibold text-surface-100 truncate">{ext.name}</p>
                <p className="text-[11px] text-surface-400 truncate">
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
