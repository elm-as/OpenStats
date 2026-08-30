import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';

export interface LogEntry {
  id: string;
  time: string;
  nodeId?: string;
  message: string;
  level: 'info' | 'success' | 'error';
}

interface CanvasLogConsoleProps {
  logs: LogEntry[];
  isRunning: boolean;
  onClear: () => void;
}

export default function CanvasLogConsole({ logs, isRunning, onClear }: CanvasLogConsoleProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  if (logs.length === 0 && !isRunning) return null;

  return (
    <div className={`fixed bottom-4 right-8 z-30 transition-all duration-300 w-[420px] md:w-[500px] rounded-2xl border border-white/[0.1] bg-surface-900/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden ${isExpanded ? 'h-[240px]' : 'h-[44px]'}`}>
      {/* Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] cursor-pointer select-none hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-2.5 text-xs font-bold text-surface-200">
          <Terminal size={15} className="text-accent-400" />
          <span>Console de Logs Live</span>
          {isRunning ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-400 bg-accent-500/10 px-2 py-0.5 rounded-full border border-accent-500/20">
              <Loader2 size={11} className="animate-spin" /> En cours...
            </span>
          ) : (
            <span className="text-[10px] text-surface-400 font-mono">({logs.length} logs)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-1 text-surface-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Effacer la console"
          >
            <Trash2 size={13} />
          </button>
          <button className="text-surface-400 hover:text-white">
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Log Body */}
      {isExpanded && (
        <div ref={scrollRef} className="p-3 h-[194px] overflow-y-auto space-y-1.5 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-surface-500 text-center pt-8 text-xs italic">En attente des logs d'exécution...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 animate-in fade-in duration-150">
                <span className="text-surface-500 shrink-0 text-[10px]">{log.time}</span>
                {log.level === 'success' && <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />}
                {log.level === 'error' && <XCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />}
                {log.level === 'info' && <Info size={13} className="text-accent-400 shrink-0 mt-0.5" />}
                <span className={`${
                  log.level === 'error' ? 'text-rose-300 font-semibold' :
                  log.level === 'success' ? 'text-emerald-300' :
                  'text-surface-200'
                } break-all`}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
