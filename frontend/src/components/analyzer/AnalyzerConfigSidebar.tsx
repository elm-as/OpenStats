import React from 'react';
import { Target, Activity, Database, RefreshCw, Hash, ToggleLeft, Hash as HashIcon, AlignLeft } from 'lucide-react';

export default function AnalyzerConfigSidebar() {
  const variables = [
    { name: 'Pclass', type: 'discrete', icon: HashIcon },
    { name: 'Survived', type: 'binary', icon: ToggleLeft },
    { name: 'Sex', type: 'binary', icon: ToggleLeft },
    { name: 'SibSp', type: 'discrete', icon: HashIcon },
    { name: 'Parch', type: 'discrete', icon: HashIcon },
    { name: 'Name', type: 'text', icon: AlignLeft },
  ];

  return (
    <aside className="w-80 shrink-0 flex flex-col p-5 border-r border-white/10 bg-surface-950/80 backdrop-blur-xl overflow-y-auto no-scrollbar">
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-surface-400 font-bold mb-2">Problème détecté</h2>
        <div className="p-3 rounded-xl bg-accent-500/10 border border-accent-500/20 text-accent-300 font-semibold flex items-center gap-2">
          <Activity size={18} />
          Classification binaire
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-surface-400 font-bold mb-2 flex items-center gap-2">
          <Target size={14} /> Cible suggérée
        </h2>
        <div className="p-3 rounded-xl bg-surface-800 border border-white/5 font-mono text-sm text-surface-100 font-bold">
          Survived
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="p-3 rounded-xl bg-surface-800 border border-white/5">
          <div className="text-[10px] uppercase text-surface-400 font-bold mb-1">Variables</div>
          <div className="text-sm font-semibold text-surface-100 flex items-center gap-1.5">
            <Database size={14} className="text-indigo-400" />
            2N · 3C · 1T
          </div>
        </div>
        <div className="p-3 rounded-xl bg-surface-800 border border-white/5">
          <div className="text-[10px] uppercase text-surface-400 font-bold mb-1">Observations</div>
          <div className="text-sm font-semibold text-surface-100">
            891
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-surface-400 font-bold">Changer la cible</h2>
          <button className="text-[10px] flex items-center gap-1 text-surface-400 hover:text-surface-100 transition-colors">
            <RefreshCw size={10} /> Reset
          </button>
        </div>
        
        <div className="space-y-2">
          {variables.map((v) => (
            <label 
              key={v.name} 
              className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                v.name === 'Survived' 
                  ? 'bg-accent-500/20 border-accent-500/30' 
                  : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <input 
                  type="radio" 
                  name="target_variable" 
                  value={v.name} 
                  defaultChecked={v.name === 'Survived'} 
                  className="hidden"
                />
                <v.icon size={14} className={v.name === 'Survived' ? 'text-accent-400' : 'text-surface-400'} />
                <span className={`text-sm font-medium ${v.name === 'Survived' ? 'text-accent-100' : 'text-surface-200'}`}>
                  {v.name}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-surface-500 font-mono bg-black/20 px-2 py-0.5 rounded">
                {v.type}
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
