import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Single Symbol / Variable display, now using KaTeX for consistency
export const MathSymbol: React.FC<{ symbol: string; className?: string }> = ({
  symbol,
  className = '',
}) => (
  <span className={`inline-flex items-baseline text-amber-300 ${className}`}>
    <InlineMath math={symbol} />
  </span>
);

// Equation Box Container
export const FormulaCard: React.FC<{
  title: string;
  formulaTex: string;
  variables?: { symbol: string; label: string }[];
  note?: string;
}> = ({ title, formulaTex, variables, note }) => {
  return (
    <div className="my-5 rounded-2xl bg-slate-950 border border-amber-500/30 p-5 md:p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-all">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
      
      {/* Title Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <h4 className="text-xs uppercase tracking-widest font-black text-amber-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {title}
        </h4>
        <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
          Formule Mathématique
        </span>
      </div>

      {/* Formula Display Area with KaTeX */}
      <div className="py-6 px-3 md:px-6 rounded-xl bg-slate-900/90 border border-amber-500/20 text-slate-100 flex items-center justify-center overflow-x-auto shadow-inner">
        <div className="text-amber-300/90 scale-110 md:scale-125">
          <BlockMath math={formulaTex} />
        </div>
      </div>

      {/* Variables Legend */}
      {variables && variables.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Légende des termes :</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {variables.map((v, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                <span className="text-amber-300 min-w-[28px] text-right text-sm">
                  <InlineMath math={v.symbol} />
                </span>
                <span className="text-slate-300 text-[11px] leading-tight">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional Note */}
      {note && (
        <div className="mt-4 text-[11px] text-amber-200/80 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed font-sans">
          <strong>Remarque :</strong> {note}
        </div>
      )}
    </div>
  );
};
