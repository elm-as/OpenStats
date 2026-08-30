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
        className="absolute top-4 left-[calc(16rem+1rem)] z-30 px-4 py-2.5 rounded-xl font-bold text-xs border border-white/[0.08] bg-surface-900/80 backdrop-blur-md hover:bg-surface-800 text-surface-200 hover:text-white transition-all flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
      >
        <LayoutTemplate size={15} />
        <span>Nouveau depuis un Template</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative z-10 w-[680px] max-h-[85vh] bg-surface-900 border border-white/[0.1] rounded-3xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-500/20 to-purple-500/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-accent-400" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-surface-50 tracking-tight">
                    Nouveau depuis un Template
                  </h2>
                  <p className="text-xs text-surface-400 mt-0.5">
                    Choisissez un pipeline préconstruit pour démarrer rapidement.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-surface-400 hover:text-white p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Template List */}
            <div className="p-5 space-y-3 overflow-y-auto max-h-[calc(85vh-100px)] custom-scrollbar">
              {allTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleSelect(template)}
                  onMouseEnter={() => setHoveredId(template.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group relative overflow-hidden cursor-pointer ${
                    hoveredId === template.id
                      ? 'border-accent-500/40 bg-accent-500/[0.04] shadow-[0_0_30px_rgba(56,189,248,0.08)]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                  }`}
                >
                  {/* Subtle gradient on hover */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-accent-500/[0.03] to-purple-500/[0.03] transition-opacity duration-300 ${
                      hoveredId === template.id ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  <div className="relative flex items-start gap-4">
                    {/* Icon */}
                    <div className="text-3xl shrink-0 mt-0.5">
                      {template.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-surface-100 text-sm group-hover:text-white transition-colors">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="text-xs text-surface-400 font-medium">
                            Utiliser ce modèle
                          </div>
                          <ChevronRight size={16} className="text-accent-400 group-hover:translate-x-1 transition-transform" />
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
