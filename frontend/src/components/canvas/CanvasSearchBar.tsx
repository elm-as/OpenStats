import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Crosshair } from 'lucide-react';
import { Node } from '@xyflow/react';

interface CanvasSearchBarProps {
  nodes: Node[];
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (node: Node) => void;
}

export function CanvasSearchBar({
  nodes,
  isOpen,
  onClose,
  onSelectNode,
}: CanvasSearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return nodes.slice(0, 8);
    const q = query.toLowerCase();
    return nodes.filter(n => {
      const title = (n.data?.title as string || n.type || '').toLowerCase();
      const id = n.id.toLowerCase();
      return title.includes(q) || id.includes(q);
    });
  }, [nodes, query]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
      <div className="bg-surface-900/95 border border-white/[0.12] rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-2">
        <div className="flex items-center gap-2 px-2">
          <Search size={16} className="text-surface-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-surface-100 placeholder-surface-500 focus:outline-none"
            placeholder="Rechercher un nœud par nom ou type..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filteredNodes.length > 0) {
                onSelectNode(filteredNodes[0]);
                onClose();
              }
            }}
          />
          <button
            onClick={onClose}
            className="p-1 text-surface-400 hover:text-surface-200 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {filteredNodes.length > 0 ? (
          <div className="max-h-56 overflow-y-auto space-y-1 pt-1 border-t border-white/[0.06]">
            {filteredNodes.map(n => (
              <button
                key={n.id}
                onClick={() => {
                  onSelectNode(n);
                  onClose();
                }}
                className="w-full px-3 py-2 text-left rounded-xl hover:bg-accent-500/10 flex items-center justify-between text-xs text-surface-200 hover:text-accent-300 transition-colors group"
              >
                <span className="font-semibold truncate">
                  {(n.data?.title as string) || n.type || n.id}
                </span>
                <div className="flex items-center gap-2 text-surface-500 group-hover:text-accent-400 text-[10px]">
                  <span>{n.type}</span>
                  <Crosshair size={12} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs text-surface-500 text-center py-3">
            Aucun nœud correspondant à "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
