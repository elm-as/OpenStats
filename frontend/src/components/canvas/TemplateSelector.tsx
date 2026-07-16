import React, { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { TEMPLATES, CanvasTemplate } from './templates';
import { LayoutTemplate, X, ChevronRight, Sparkles } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (nodes: Node[], edges: Edge[]) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = (template: CanvasTemplate) => {
    onSelect(template.nodes, template.edges);
    setIsOpen(false);
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
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  onMouseEnter={() => setHoveredId(template.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
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
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-bold text-surface-100 text-sm group-hover:text-white transition-colors">
                          {template.name}
                        </h3>
                        {template.nodes.length > 0 && (
                          <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-white/[0.06] text-surface-400 border border-white/[0.06]">
                            {template.nodes.length} blocs
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-surface-400 leading-relaxed">
                        {template.description}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={18}
                      className={`shrink-0 mt-2 transition-all duration-200 ${
                        hoveredId === template.id
                          ? 'text-accent-400 translate-x-0 opacity-100'
                          : 'text-surface-600 -translate-x-1 opacity-0'
                      }`}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
