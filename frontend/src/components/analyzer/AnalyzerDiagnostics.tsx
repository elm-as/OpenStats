import React from 'react';
import { Sparkles, AlertOctagon, AlertTriangle, Info, ChevronRight } from 'lucide-react';

export default function AnalyzerDiagnostics() {
  const diagnostics = [
    {
      id: 1,
      type: 'critical',
      icon: AlertOctagon,
      title: 'Déséquilibre de classe modéré',
      description: 'La cible "Survived" a une répartition 62% / 38%. Un suréchantillonnage (SMOTE) ou ajustement des poids de classe est recommandé.',
      color: 'text-red-400',
      bg: 'bg-red-400/10',
      border: 'border-red-400/20'
    },
    {
      id: 2,
      type: 'warning',
      icon: AlertTriangle,
      title: 'Fuite de données potentielle (Data Leakage)',
      description: 'La variable "Ticket" semble contenir des identifiants uniques pouvant biaiser le modèle. Elle a été écartée du pipeline.',
      color: 'text-amber-400',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20'
    },
    {
      id: 3,
      type: 'info',
      icon: Info,
      title: 'Corrélation forte détectée',
      description: '"Fare" et "Pclass" sont fortement corrélées (-0.55). Les modèles linéaires pourraient nécessiter une régularisation (Ridge/Lasso).',
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
      border: 'border-sky-400/20'
    },
    {
      id: 4,
      type: 'info',
      icon: Info,
      title: 'Asymétrie des distributions',
      description: 'La variable "Fare" est fortement asymétrique à droite (skewness > 3). Une transformation logarithmique a été ajoutée.',
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
      border: 'border-sky-400/20'
    },
    {
      id: 5,
      type: 'info',
      icon: Info,
      title: 'Qualité globale des données',
      description: 'Le dataset a un taux de complétude global de 78%. "Age" nécessite une imputation complexe (KNN ou IterativeImputer).',
      color: 'text-sky-400',
      bg: 'bg-sky-400/10',
      border: 'border-sky-400/20'
    }
  ];

  return (
    <aside className="w-[340px] shrink-0 flex flex-col p-5 border-l border-white/10 bg-surface-950/80 backdrop-blur-xl overflow-y-auto no-scrollbar">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-surface-50 flex items-center gap-2 mb-1">
          <Sparkles size={16} className="text-accent-400" /> Interprétation automatique
        </h2>
        <p className="text-xs text-surface-400">5 insights générés par l'analyseur avant exécution.</p>
      </div>

      {/* Summary Badges */}
      <div className="flex gap-2 mb-8">
        <div className="flex-1 p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-red-400">1</span>
          <span className="text-[9px] uppercase tracking-wider text-red-400/70 font-bold">Critique</span>
        </div>
        <div className="flex-1 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-amber-400">1</span>
          <span className="text-[9px] uppercase tracking-wider text-amber-400/70 font-bold">Attention</span>
        </div>
        <div className="flex-1 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-sky-400">3</span>
          <span className="text-[9px] uppercase tracking-wider text-sky-400/70 font-bold">Info</span>
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-widest text-surface-500 font-bold mb-4">
          Diagnostics (5)
        </h3>
        
        <div className="space-y-3">
          {diagnostics.map((diag) => (
            <div key={diag.id} className={`p-3.5 rounded-xl border ${diag.bg} ${diag.border} transition-colors hover:bg-opacity-20 cursor-default group`}>
              <div className="flex items-start gap-3">
                <diag.icon size={16} className={`shrink-0 mt-0.5 ${diag.color}`} />
                <div>
                  <h4 className={`text-sm font-bold mb-1 ${diag.color}`}>{diag.title}</h4>
                  <p className="text-xs text-surface-300 leading-relaxed">
                    {diag.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
