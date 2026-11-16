import React, { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { TEMPLATES, CanvasTemplate, getUserTemplates } from './templates';
import { LayoutTemplate, X, ChevronRight, Sparkles, Trash2 } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (nodes: Node[], edges: Edge[]) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState<CanvasTemplate[]>(TEMPLATES);

  useEffect(() => {
    if (isOpen) {
      setAllTemplates([...getUserTemplates(), ...TEMPLATES]);
    }
  }, [isOpen]);

  const handleSelect = (template: CanvasTemplate) => {
    onSelect(template.nodes, template.edges);
    setIsOpen(false);
  };
  
  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const existing = getUserTemplates().filter(t => t.id !== id);
    localStorage.setItem('openstats_user_templates', JSON.stringify(existing));
    setAllTemplates([...existing, ...TEMPLATES]);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="ui-btn ui-panel absolute top-4 left-[calc(16rem+1rem)] z-30 px-3.5 py-2 font-semibold text-xs shadow-md flex items-center gap-2"
      >
        <LayoutTemplate size={15} className="text-accent-400" />
        <span>Nouveau depuis un Template</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="ui-panel relative z-10 w-[680px] max-h-[85vh] rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-accent-500/15 border border-accent-500/25 flex items-center justify-center">
                  <Sparkles size={18} className="text-accent-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-surface-100 tracking-tight">
                    Nouveau depuis un Template
                  </h2>
                  <p className="text-xs text-surface-400 mt-0.5">
                    Choisissez un pipeline préconstruit pour démarrer rapidement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-surface-400 hover:text-surface-100 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template List */}
            <div className="p-5 space-y-2.5 overflow-y-auto max-h-[calc(85vh-92px)] ui-scroll">
              {allTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(template)}
                  onMouseEnter={() => setHoveredId(template.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors group relative cursor-pointer ${
                    hoveredId === template.id
                      ? 'border-accent-500/45 bg-accent-500/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]'
                  }`}
                >
                  <div className="relative flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-2xl shrink-0 mt-0.5">
                      {template.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-surface-100 text-sm">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-xs text-surface-400 font-medium">
                            Utiliser ce modèle
                          </div>
                          <ChevronRight size={16} className="text-accent-400" />
                        </div>
                      </div>
                      <p className="text-xs text-surface-400 leading-relaxed pr-8">
                        {template.description}
                      </p>
                    </div>
                    {/* Delete Custom Button */}
                    {template.id.startsWith('custom_') && (
                      <button
                        onClick={(e) => handleDeleteCustom(e, template.id)}
                        className="absolute top-4 right-4 p-2 text-surface-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                        title="Supprimer ce modèle"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
