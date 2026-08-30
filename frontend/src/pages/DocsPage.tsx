import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ANALYSES_DATA,
  ANALYSES_CATEGORIES,
  AnalysisDoc,
} from '../docs/analysesData';
import { AnalysisDocDetail } from '../components/docs/AnalysisDocDetail';
import {
  Search,
  BookOpen,
  Target,
  Sparkles,
  ArrowRight,
  Filter,
  Layers,
  ChevronRight,
  HelpCircle,
  Upload,
  Cpu,
  BarChart3,
  Award,
  Zap,
} from 'lucide-react';

export default function DocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisDoc | null>(null);

  // Filter analyses based on category and search query
  const filteredAnalyses = useMemo(() => {
    return ANALYSES_DATA.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.useCase.toLowerCase().includes(q) ||
          item.categoryLabel.toLowerCase().includes(q) ||
          item.interpretationGuide.some(
            (g) => g.metric.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
          )
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* ─── Hero Banner ─── */}
      <section className="relative overflow-hidden rounded-2xl bg-surface-900 border border-white/10 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 text-accent-400 text-[11px] font-black uppercase tracking-wider border border-accent-500/20">
              <Sparkles className="w-3.5 h-3.5 text-accent-400" /> Documentation & Formules Mathématiques
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              Encyclopédie des Analyses Statistiques & IA
            </h1>
            <p className="text-surface-300 text-xs md:text-sm leading-relaxed">
              Consultez les <strong>explications théoriques</strong>, les <strong>vraies formules mathématiques</strong> et les <strong>guides d'interprétation</strong> des p-values, R², VIF et métriques de chaque test.
            </p>
          </div>

          <Link to="/workflow" className="btn-primary shrink-0">
            <Upload className="w-4 h-4" />
            Lancer une Analyse
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── Detailed View Modal/Panel or Main Section ─── */}
      {selectedAnalysis ? (
        <AnalysisDocDetail
          analysis={selectedAnalysis}
          onBack={() => setSelectedAnalysis(null)}
        />
      ) : (
        <div className="space-y-6">
          {/* Search & Category Filter Bar */}
          <div className="card space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une analyse, p-value, ANOVA, SHAP, VIF, ARIMA..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-900 border border-white/10 text-xs font-medium text-white placeholder:text-muted outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-all shadow-inner"
                />
              </div>

              {/* Counter Badge */}
              <div className="flex items-center gap-2 text-xs font-bold text-muted self-end md:self-auto">
                <BookOpen className="w-4 h-4 text-accent-400" />
                <span>
                  {filteredAnalyses.length} fiche{filteredAnalyses.length > 1 ? 's' : ''} disponible{filteredAnalyses.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-white/5">
              {ANALYSES_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 border ${
                      isSelected
                        ? 'bg-accent-500 text-white border-accent-500 shadow-md font-black'
                        : 'bg-white/[0.03] text-muted border-white/10 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Grid of Analyses ─── */}
          {filteredAnalyses.length === 0 ? (
            <div className="card text-center py-16 space-y-3">
              <HelpCircle className="w-10 h-10 text-muted mx-auto" />
              <h3 className="text-sm font-bold text-white">Aucune analyse ne correspond à votre recherche</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Essayez d'autres mots-clés comme "t-test", "régression", "p-value" ou "clustering".
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="btn-secondary text-xs"
              >
                Réinitialiser la recherche
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAnalyses.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnalysis(item)}
                  className="card group hover:border-accent-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between p-5 space-y-4 hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden bg-surface-900/60 border-white/10"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-accent-500/10 text-accent-400 border border-accent-500/20">
                        {item.categoryLabel}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-accent-400 group-hover:translate-x-1 transition-all" />
                    </div>

                    <h3 className="text-base font-black text-white group-hover:text-accent-300 transition-colors leading-snug">
                      {item.title}
                    </h3>

                    <p className="text-xs text-surface-400 leading-relaxed line-clamp-3">
                      {item.summary}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] font-bold text-accent-400/80 group-hover:text-accent-300 transition-colors">
                    <span>Consulter le cours</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
