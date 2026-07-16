import { Link } from 'react-router-dom';
import {
  Play, Network, Upload, BarChart3, Cpu,
  ArrowRight, Database, Layers, Target,
  FileText, Gauge, Hash, Wand2,
} from 'lucide-react';

const MODES = [
  {
    icon: Play,
    color: 'text-accent-400',
    bg: 'bg-accent-400/10',
    border: 'border-accent-500/20',
    title: 'Analyse Guidee',
    path: '/workflow',
    desc: 'Workflow pas a pas : import, profilage, nettoyage, analyses statistiques, modelisation, rapport. Ideal pour debuter.',
    steps: ['Importer un dataset', 'Profilage automatique', 'Nettoyage des donnees', 'Analyses & visualisations', 'Export du rapport'],
  },
  {
    icon: Network,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-500/20',
    title: 'Canvas Libre',
    path: '/canvas',
    desc: 'Glissez-deposez des noeuds pour construire des pipelines complexes. 25+ blocs : sources, preparation, modelisation, series temporelles, simulations, visualisations.',
    steps: ['Choisir un dataset source', 'Ajouter des noeuds (drag & drop)', 'Configurer les parametres', 'Executer le pipeline', 'Exporter les resultats'],
  },
  {
    icon: Wand2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/20',
    title: 'Analyse Auto IA',
    path: '/analyzer',
    desc: "L'IA detecte le type de probleme, selectionne le pipeline optimal et execute l'analyse de A a Z. Nettoyage, modelisation, insights et rapport automatiques.",
    steps: ['Selectionner un dataset', "L'IA detecte le probleme", 'Exclure les colonnes inutiles', 'Lancer l\'analyse', 'Consulter le rapport genere'],
  },
];

const FEATURES = [
  { icon: Database, label: 'Multi-format', desc: 'Import CSV, XLSX, JSON, Parquet' },
  { icon: BarChart3, label: '30+ Modeles ML', desc: 'Regression, classification, clustering, series temporelles' },
  { icon: Hash, label: '12 Tests Stats', desc: 'Normalite, correlation, stationnarite, cointegration' },
  { icon: Cpu, label: 'SHAP & Explain', desc: 'Explicabilite des modeles avec SHAP' },
  { icon: Layers, label: 'Marketplace', desc: 'Templates et extensions partageables' },
  { icon: FileText, label: 'Rapports Pro', desc: 'Export PDF, DOCX, PPTX automatique' },
];

export default function DocsPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-surface-900 border border-white/5 shadow-sm">
        <div className="relative z-10 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">Documentation</p>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-[1.1] mb-2">
              Bienvenue sur OpenStats
            </h1>
            <p className="text-surface-400 text-[13px] leading-relaxed max-w-lg">
              Plateforme d'analyse statistique et de machine learning. Importez vos donnees, construisez des pipelines et exportez vos resultats.
            </p>
          </div>
          <Link to="/workflow" className="btn-primary shrink-0">
            <Upload className="w-4 h-4" />
            Importer un dataset
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-5 bg-accent-500 rounded-full" />
          <h3 className="text-base font-black text-white tracking-tight">Fonctionnalites cles</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {FEATURES.map(f => (
            <div key={f.label} className="stat group">
              <div className="stat-label">
                <div className="w-4 h-4 rounded-md bg-accent-400/10 flex items-center justify-center">
                  <f.icon className="w-2.5 h-2.5 text-accent-400" />
                </div>
                {f.label}
              </div>
              <p className="text-[11px] text-faint mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Modes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-accent-500 rounded-full" />
          <h3 className="text-base font-black text-white tracking-tight">Modes d'analyse</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODES.map(mode => (
            <div key={mode.title} className={`card group hover:${mode.border} transition-all`}>
              <div className={`w-9 h-9 rounded-xl ${mode.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <mode.icon className={`w-5 h-5 ${mode.color}`} />
              </div>
              <h4 className="text-sm font-bold text-white mb-1.5">{mode.title}</h4>
              <p className="text-xs text-muted leading-relaxed mb-4">{mode.desc}</p>
              <div className="space-y-1.5">
                {mode.steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-faint">
                    <div className={`w-4 h-4 rounded-full ${mode.bg} flex items-center justify-center shrink-0`}>
                      <span className={`text-[9px] font-bold ${mode.color}`}>{i + 1}</span>
                    </div>
                    {step}
                  </div>
                ))}
              </div>
              <Link
                to={mode.path}
                className={`mt-4 w-full py-1.5 rounded-lg ${mode.bg} hover:opacity-80 ${mode.color} text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 border ${mode.border}`}
              >
                Ouvrir <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-1 h-5 bg-emerald-500 rounded-full" />
          <h3 className="text-base font-black text-white tracking-tight">Demarrage rapide</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { step: 1, title: 'Importer', desc: 'Glissez-deposez un fichier CSV, XLSX ou JSON sur la page d\'import.', icon: Upload },
            { step: 2, title: 'Profiler', desc: "Le profilage automatique detecte les types de colonnes et suggere une cible.", icon: Target },
            { step: 3, title: 'Analyser', desc: 'Choisissez un mode : guide, canvas ou auto. L\'IA fait le reste.', icon: Gauge },
            { step: 4, title: 'Exporter', desc: 'Telechargez le rapport en PDF, DOCX ou PPTX avec tous les resultats.', icon: FileText },
          ].map(item => (
            <div key={item.step} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs font-bold text-white mb-1">{item.step}. {item.title}</p>
              <p className="text-[11px] text-faint leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
