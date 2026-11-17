import React, { useState, useEffect } from 'react';
import { Node, Edge } from '@xyflow/react';
import { TEMPLATES, CanvasTemplate, getUserTemplates } from './templates';
import { LayoutTemplate, X, ChevronRight, Trash2 } from 'lucide-react';

interface TemplateSelectorProps {
  onSelect: (nodes: Node[], edges: Edge[]) => void;
}

export default function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="ui-btn ui-focusable text-xs"
      >
        <LayoutTemplate size={14} style={{ color: 'var(--ui-accent-text)' }} />
        <span>Modèles prédéfinis</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsOpen(false)} />

          <div
            className="ui-panel relative z-10 w-[640px] max-h-[82vh] overflow-hidden flex flex-col"
            style={{ background: 'var(--ui-bg-panel)', color: 'var(--ui-text)' }}
          >
            <header className="ui-panel-header">
              <span className="flex items-center gap-2">
                <LayoutTemplate size={14} style={{ color: 'var(--ui-accent-text)' }} />
                Modèles de pipeline
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ui-btn ui-btn-ghost ui-focusable"
                style={{ height: 24, padding: '0 6px' }}
              >
                <X size={14} />
              </button>
            </header>

            <div className="p-3 space-y-2 overflow-y-auto ui-scroll">
              {allTemplates.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleSelect(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleSelect(template)}
                  className="ui-panel p-3 cursor-pointer flex items-start gap-3 transition-colors hover:border-[var(--ui-accent)]"
                  style={{ background: 'var(--ui-bg-sunken)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-xs" style={{ color: 'var(--ui-text)' }}>
                        {template.name}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {template.id.startsWith('custom_') && (
                          <button
                            type="button"
                            onClick={e => handleDeleteCustom(e, template.id)}
                            className="p-1 rounded-[var(--ui-radius-sm)] text-red-500 hover:bg-red-500/10"
                            title="Supprimer ce modèle"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <ChevronRight size={14} style={{ color: 'var(--ui-accent-text)' }} />
                      </div>
                    </div>
                    <p className="text-[11px] ui-t-muted mt-0.5 leading-snug">
                      {template.description}
                    </p>
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
