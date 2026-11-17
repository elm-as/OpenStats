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

export default function CanvasLogConsole(props: CanvasLogConsoleProps) {
  const { logs, isRunning, onClear } = props;
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  if (logs.length === 0 && !isRunning) return null;

  return (
    <div
      className={`ui-panel fixed bottom-16 right-4 z-30 transition-all duration-200 w-[420px] md:w-[480px] overflow-hidden ${
        isExpanded ? 'h-[230px]' : 'h-[40px]'
      }`}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3.5 py-2 border-b cursor-pointer select-none"
        style={{ borderColor: 'var(--ui-border)', background: 'var(--ui-bg-sunken)' }}
      >
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--ui-text)] ui-num">
          <Terminal size={14} className="text-accent-400" />
          <span>Logs d'exécution</span>
          {isRunning ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-accent-400">
              <Loader2 size={11} className="animate-spin" /> En cours...
            </span>
          ) : (
            <span className="text-[10px] ui-t-muted">({logs.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ui-btn ui-btn-ghost p-1"
            title="Effacer la console"
          >
            <Trash2 size={13} />
          </button>
          <span className="ui-t-muted">
            {isExpanded ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </span>
        </div>
      </div>

      {/* Log Body */}
      {isExpanded && (
        <div ref={scrollRef} className="p-3 h-[188px] overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed ui-num ui-scroll">
          {logs.length === 0 ? (
            <div className="ui-t-muted text-center pt-8 text-xs italic">En attente des logs...</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="ui-t-muted shrink-0 text-[10px]">{log.time}</span>
                {log.level === 'success' && <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />}
                {log.level === 'error' && <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />}
                {log.level === 'info' && <Info size={12} className="text-accent-400 shrink-0 mt-0.5" />}
                <span
                  className={`break-all ${
                    log.level === 'error'
                      ? 'text-red-400 font-semibold'
                      : log.level === 'success'
                      ? 'text-emerald-400'
                      : 'text-[var(--ui-text)]'
                  }`}
                >
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
