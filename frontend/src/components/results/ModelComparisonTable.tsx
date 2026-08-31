import React, { useState } from 'react';
import { Columns3, Copy, Check, FileCode, Sliders } from 'lucide-react';

interface ModelComparisonTableProps {
  ranking: Array<{
    rank: number;
    model_key: string;
    model_name: string;
    metrics: Record<string, number>;
    cv_scores?: { mean: number; std?: number };
    regression_summary?: any;
    model_summary?: any;
  }>;
}

export function ModelComparisonTable({ ranking }: ModelComparisonTableProps) {
  const [useRobustSE, setUseRobustSE] = useState(true);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Filtrer les modèles possédant un résumé de régression ou des métriques
  const linearModels = ranking.filter(
    r => r.regression_summary || r.model_summary?.type === 'linear_regression'
  );

  if (linearModels.length === 0) return null;

  // Extraire l'ensemble unique des variables
  const allVarsSet = new Set<string>();
  linearModels.forEach(m => {
    const summary = m.regression_summary || m.model_summary;
    const coefs = summary?.coefficients || [];
    coefs.forEach((c: any) => {
      if (c.variable && !c.variable.includes('Constante') && !c.variable.includes('β₀')) {
        allVarsSet.add(c.variable);
      }
    });
  });
  const allVars = Array.from(allVarsSet);

  // Fonction helper pour formater les étoiles
  const formatStars = (p: number | undefined) => {
    if (p === undefined || p === null) return '';
    if (p < 0.001) return '***';
    if (p < 0.01) return '**';
    if (p < 0.05) return '*';
    return '';
  };

  // Génération du code LaTeX (style Stargazer)
  const generateLatex = () => {
    let tex = '% Tableau comparatif multi-modèles (OpenStats)\n';
    tex += '\\begin{table}[!htbp] \\centering\n';
    tex += '  \\caption{Comparaison des spécifications de régression}\n';
    tex += `  \\begin{tabular}{l${'c'.repeat(linearModels.length)}}\n`;
    tex += '    \\hline\\hline\n';
    tex += `    & ${linearModels.map((m, i) => `(${i + 1}) ${m.model_name}`).join(' & ')} \\\\\n`;
    tex += '    \\hline\n';

    allVars.forEach(v => {
      // Ligne des coefficients
      const coefLine = linearModels.map(m => {
        const summary = m.regression_summary || m.model_summary;
        const c = summary?.coefficients?.find((item: any) => item.variable === v);
        if (!c) return '—';
        const p = useRobustSE && c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
        return `${c.coefficient.toFixed(4)}${formatStars(p)}`;
      });
      tex += `    ${v} & ${coefLine.join(' & ')} \\\\\n`;

      // Ligne des erreurs-types
      const seLine = linearModels.map(m => {
        const summary = m.regression_summary || m.model_summary;
        const c = summary?.coefficients?.find((item: any) => item.variable === v);
        if (!c) return '';
        const se = useRobustSE && c.robust_std_error !== undefined ? c.robust_std_error : c.std_error;
        return se !== undefined ? `(${se.toFixed(4)})` : '';
      });
      tex += `      & ${seLine.join(' & ')} \\\\\n`;
    });

    // Constante
    const constCoef = linearModels.map(m => {
      const summary = m.regression_summary || m.model_summary;
      const c = summary?.coefficients?.find((item: any) => item.variable?.includes('Constante') || item.variable?.includes('β₀'));
      if (!c) return '—';
      const p = useRobustSE && c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
      return `${c.coefficient.toFixed(4)}${formatStars(p)}`;
    });
    tex += `    Constante & ${constCoef.join(' & ')} \\\\\n`;

    const constSe = linearModels.map(m => {
      const summary = m.regression_summary || m.model_summary;
      const c = summary?.coefficients?.find((item: any) => item.variable?.includes('Constante') || item.variable?.includes('β₀'));
      if (!c) return '';
      const se = useRobustSE && c.robust_std_error !== undefined ? c.robust_std_error : c.std_error;
      return se !== undefined ? `(${se.toFixed(4)})` : '';
    });
    tex += `      & ${constSe.join(' & ')} \\\\\n`;

    tex += '    \\hline\n';
    tex += `    Observations & ${linearModels.map(m => (m.regression_summary || m.model_summary)?.n_observations ?? '—').join(' & ')} \\\\\n`;
    tex += `    $R^2$ & ${linearModels.map(m => m.metrics?.r2 !== undefined ? m.metrics.r2.toFixed(4) : '—').join(' & ')} \\\\\n`;
    tex += `    $R^2$ Ajusté & ${linearModels.map(m => (m.regression_summary || m.model_summary)?.r2_adjusted !== undefined ? (m.regression_summary || m.model_summary).r2_adjusted.toFixed(4) : '—').join(' & ')} \\\\\n`;
    tex += `    AIC & ${linearModels.map(m => (m.regression_summary || m.model_summary)?.aic !== undefined ? (m.regression_summary || m.model_summary).aic.toFixed(1) : '—').join(' & ')} \\\\\n`;
    tex += '    \\hline\\hline\n';
    tex += `    \\multicolumn{${linearModels.length + 1}}{l}{\\textit{Note:} $^{*}p<0.05$; $^{**}p<0.01$; $^{***}p<0.001$. Erreurs-types ${useRobustSE ? 'robustes (White HC1)' : 'classiques'} entre parenthèses.} \\\\\n`;
    tex += '\\end{tabular}\n\\end{table}\n';
    return tex;
  };

  const handleCopy = (format: string) => {
    let content = '';
    if (format === 'latex') {
      content = generateLatex();
    } else {
      // Format Markdown
      content = `| Variable | ${linearModels.map((m, i) => `(${i + 1}) ${m.model_name}`).join(' | ')} |\n`;
      content += `| :--- | ${linearModels.map(() => ':---:').join(' | ')} |\n`;
      allVars.forEach(v => {
        const coefs = linearModels.map(m => {
          const summary = m.regression_summary || m.model_summary;
          const c = summary?.coefficients?.find((item: any) => item.variable === v);
          if (!c) return '—';
          const p = useRobustSE && c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
          const se = useRobustSE && c.robust_std_error !== undefined ? c.robust_std_error : c.std_error;
          return `${c.coefficient.toFixed(4)}${formatStars(p)} (${se?.toFixed(4) ?? '—'})`;
        });
        content += `| **${v}** | ${coefs.join(' | ')} |\n`;
      });
      content += `| **$R^2$** | ${linearModels.map(m => m.metrics?.r2?.toFixed(4) ?? '—').join(' | ')} |\n`;
    }

    navigator.clipboard.writeText(content);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2500);
  };

  return (
    <div className="bg-surface-800/50 rounded-xl border border-white/10 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h4 className="text-md font-semibold text-cyan-300 flex items-center gap-2">
          <Columns3 className="w-5 h-5 text-cyan-400" />
          Tableau Comparatif des Spécifications (Standard Stargazer / esttab)
        </h4>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setUseRobustSE(!useRobustSE)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
              useRobustSE
                ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40 font-medium'
                : 'bg-surface-700/50 text-surface-400 border-white/10'
            }`}
            title="Basculer entre erreurs-types classiques et erreurs-types robustes à l'hétéroscédasticité"
          >
            <Sliders className="w-3.5 h-3.5" />
            {useRobustSE ? 'SE Robustes (White)' : 'SE Classiques'}
          </button>

          <button
            onClick={() => handleCopy('latex')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-200 border border-white/10 rounded-lg transition-all"
            title="Copier le code LaTeX prêt pour publication"
          >
            {copiedFormat === 'latex' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileCode className="w-3.5 h-3.5" />}
            LaTeX
          </button>

          <button
            onClick={() => handleCopy('markdown')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-200 border border-white/10 rounded-lg transition-all"
            title="Copier le tableau au format Markdown"
          >
            {copiedFormat === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Markdown
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-700/70 text-surface-300 font-semibold border-b border-white/10">
            <tr>
              <th className="p-3">Variable explicative</th>
              {linearModels.map((m, idx) => (
                <th key={idx} className="p-3 text-right">
                  <span className="text-cyan-300 block">({idx + 1})</span>
                  <span className="text-surface-100 font-medium">{m.model_name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono text-surface-200">
            {allVars.map(v => (
              <React.Fragment key={v}>
                <tr className="hover:bg-white/5">
                  <td className="p-2.5 font-sans font-medium text-surface-100">{v}</td>
                  {linearModels.map((m, idx) => {
                    const summary = m.regression_summary || m.model_summary;
                    const c = summary?.coefficients?.find((item: any) => item.variable === v);
                    if (!c) return <td key={idx} className="p-2.5 text-right text-surface-500">—</td>;
                    const p = useRobustSE && c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
                    const isSig = p !== undefined && p < 0.05;
                    return (
                      <td key={idx} className={`p-2.5 text-right font-bold ${isSig ? 'text-emerald-300' : 'text-surface-300'}`}>
                        {c.coefficient > 0 ? `+${c.coefficient.toFixed(4)}` : c.coefficient.toFixed(4)}
                        <span className="text-emerald-400 ml-0.5">{formatStars(p)}</span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="text-[11px] text-surface-400 bg-surface-900/30">
                  <td className="py-1 px-2.5 pl-6 font-sans text-surface-500 italic">Écart-type ({useRobustSE ? 'Robuste' : 'Standard'})</td>
                  {linearModels.map((m, idx) => {
                    const summary = m.regression_summary || m.model_summary;
                    const c = summary?.coefficients?.find((item: any) => item.variable === v);
                    if (!c) return <td key={idx} className="py-1 px-2.5 text-right text-surface-600"></td>;
                    const se = useRobustSE && c.robust_std_error !== undefined ? c.robust_std_error : c.std_error;
                    return (
                      <td key={idx} className="py-1 px-2.5 text-right font-mono text-surface-400">
                        {se !== undefined ? `(${se.toFixed(4)})` : ''}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            ))}

            {/* Constante */}
            <tr className="border-t-2 border-white/10 hover:bg-white/5">
              <td className="p-2.5 font-sans font-medium text-surface-100">Constante (β₀)</td>
              {linearModels.map((m, idx) => {
                const summary = m.regression_summary || m.model_summary;
                const c = summary?.coefficients?.find((item: any) => item.variable?.includes('Constante') || item.variable?.includes('β₀'));
                if (!c) return <td key={idx} className="p-2.5 text-right text-surface-500">—</td>;
                const p = useRobustSE && c.robust_p_value !== undefined ? c.robust_p_value : c.p_value;
                return (
                  <td key={idx} className="p-2.5 text-right font-bold text-cyan-300">
                    {c.coefficient > 0 ? `+${c.coefficient.toFixed(4)}` : c.coefficient.toFixed(4)}
                    <span className="text-emerald-400 ml-0.5">{formatStars(p)}</span>
                  </td>
                );
              })}
            </tr>
            <tr className="text-[11px] text-surface-400 bg-surface-900/30">
              <td className="py-1 px-2.5 pl-6 font-sans text-surface-500 italic">Écart-type Constante</td>
              {linearModels.map((m, idx) => {
                const summary = m.regression_summary || m.model_summary;
                const c = summary?.coefficients?.find((item: any) => item.variable?.includes('Constante') || item.variable?.includes('β₀'));
                if (!c) return <td key={idx} className="py-1 px-2.5 text-right"></td>;
                const se = useRobustSE && c.robust_std_error !== undefined ? c.robust_std_error : c.std_error;
                return (
                  <td key={idx} className="py-1 px-2.5 text-right font-mono text-surface-400">
                    {se !== undefined ? `(${se.toFixed(4)})` : ''}
                  </td>
                );
              })}
            </tr>

            {/* Métriques globales */}
            <tr className="border-t-2 border-white/20 bg-surface-700/40">
              <td className="p-2.5 font-sans font-semibold text-surface-300">Observations (N)</td>
              {linearModels.map((m, idx) => (
                <td key={idx} className="p-2.5 text-right font-bold text-surface-200">
                  {(m.regression_summary || m.model_summary)?.n_observations ?? '—'}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-white/5">
              <td className="p-2.5 font-sans font-semibold text-surface-300">R²</td>
              {linearModels.map((m, idx) => (
                <td key={idx} className="p-2.5 text-right font-bold text-emerald-300">
                  {m.metrics?.r2 !== undefined ? m.metrics.r2.toFixed(4) : '—'}
                </td>
              ))}
            </tr>
            <tr className="hover:bg-white/5">
              <td className="p-2.5 font-sans font-semibold text-surface-300">R² Ajusté</td>
              {linearModels.map((m, idx) => {
                const r2adj = (m.regression_summary || m.model_summary)?.r2_adjusted;
                return (
                  <td key={idx} className="p-2.5 text-right text-surface-300">
                    {r2adj !== undefined ? r2adj.toFixed(4) : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-white/5">
              <td className="p-2.5 font-sans font-semibold text-surface-300">Statistique F</td>
              {linearModels.map((m, idx) => {
                const fstat = (m.regression_summary || m.model_summary)?.f_statistic;
                return (
                  <td key={idx} className="p-2.5 text-right text-surface-400">
                    {fstat !== null && fstat !== undefined ? fstat.toFixed(2) : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="hover:bg-white/5">
              <td className="p-2.5 font-sans font-semibold text-surface-300">AIC / BIC</td>
              {linearModels.map((m, idx) => {
                const s = m.regression_summary || m.model_summary;
                return (
                  <td key={idx} className="p-2.5 text-right text-surface-400">
                    {s?.aic !== undefined ? `${s.aic.toFixed(1)} / ${s.bic?.toFixed(1) ?? '—'}` : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-surface-400 px-1 pt-1">
        <span>* p &lt; 0.05, ** p &lt; 0.01, *** p &lt; 0.001</span>
        <span>Écarts-types {useRobustSE ? 'robustes à l\'hétéroscédasticité (White HC1)' : 'classiques (homoscédastiques)'} entre parenthèses.</span>
      </div>
    </div>
  );
}
