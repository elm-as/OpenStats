import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function AnalyzerPipeline() {
  return (
    <div className="flex-1 flex items-center justify-center bg-surface-950">
      <div className="text-center max-w-md p-8 rounded-2xl bg-surface-800/50 border border-white/10">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent-500/10 border border-accent-500/20 flex items-center justify-center">
          <ArrowRight className="w-6 h-6 text-accent-400" />
        </div>
        <h2 className="text-lg font-bold text-surface-100 mb-2">
          Pipeline automatique déplacé
        </h2>
        <p className="text-sm text-surface-400">
          L'analyseur de pipeline automatique est désormais intégré directement dans la page
          d'analyse via <span className="text-accent-400 font-medium">AutoPipelinePanel</span>.
        </p>
        <p className="text-xs text-surface-500 mt-3">
          Cette page n'est plus utilisée. Ouvrez un dataset et utilisez le panneau « Analyseur
          intelligent » à droite de l'écran d'analyse.
        </p>
      </div>
    </div>
  );
}
