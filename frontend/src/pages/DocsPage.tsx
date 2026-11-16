import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ANALYSES_DATA,
  ANALYSES_CATEGORIES,
  AnalysisDoc,
} from '../docs/analysesData';
import { AnalysisDocDetail } from '../components/docs/AnalysisDocDetail';
import {
  Search, BookOpen, ArrowRight, ChevronRight, HelpCircle, Upload,
} from 'lucide-react';

export default function DocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisDoc | null>(null);

  const filteredAnalyses = useMemo(() => {
    return ANALYSES_DATA.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;
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
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <section className="ui-panel p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <span className="ui-tag ui-tag-accent">Référence Méthodologique &amp; Formules</span>
          <h1 className="text-xl md:text-2xl font-bold ui-t tracking-tight">
            Manuel des Méthodes Statistiques
          </h1>
          <p className="text-xs ui-t-muted leading-relaxed">
            Hypothèses d’application, équations exactes et règles d’interprétation (p-values, R², VIF, stationnarité, SHAP).
          </p>
        </div>

        <Link to="/workflow" className="ui-btn ui-btn-primary ui-focusable shrink-0">
          <Upload className="w-3.5 h-3.5" />
          Importer des données
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>

      {selectedAnalysis ? (
        <AnalysisDocDetail analysis={selectedAnalysis} onBack={() => setSelectedAnalysis(null)} />
      ) : (
        <div className="space-y-4">
          <div className="ui-panel p-3.5 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 ui-t-faint absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher : Student, ANOVA, VIF, ARIMA, SHAP, Kruskal-Wallis…"
                  className="ui-input w-full"
                  style={{ paddingLeft: 32 }}
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold ui-t-muted shrink-0">
                <BookOpen className="w-3.5 h-3.5 ui-t-accent" />
                <span className="ui-num">{filteredAnalyses.length}</span>
                <span>fiche{filteredAnalyses.length > 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[var(--ui-border)]">
              {ANALYSES_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="ui-btn ui-focusable shrink-0"
                    style={{
                      background: isSelected ? 'var(--ui-accent-soft)' : 'transparent',
                      borderColor: isSelected ? 'var(--ui-border-focus)' : 'var(--ui-border)',
                      color: isSelected ? 'var(--ui-accent-text)' : 'var(--ui-text-muted)',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredAnalyses.length === 0 ? (
            <div className="ui-panel text-center py-12 space-y-3">
              <HelpCircle className="w-8 h-8 ui-t-faint mx-auto" />
              <h3 className="text-sm font-bold ui-t">Aucune fiche ne correspond à votre recherche</h3>
              <p className="text-xs ui-t-muted max-w-sm mx-auto">
                Essayez « t-test », « régression », « p-value » ou « clustering ».
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                className="ui-btn ui-focusable"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAnalyses.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedAnalysis(item)}
                  className="ui-panel text-left group p-4 flex flex-col justify-between space-y-3 transition-colors hover:border-[var(--ui-border-strong)] ui-focusable"
                >
                  <div className="space-y-2 w-full">
                    <div className="flex items-center justify-between gap-2">
                      <span className="ui-tag ui-tag-accent">{item.categoryLabel}</span>
                      <ChevronRight className="w-3.5 h-3.5 ui-t-faint group-hover:ui-t-accent transition-colors" />
                    </div>
                    <h3 className="text-sm font-bold ui-t leading-snug">{item.title}</h3>
                    <p className="text-xs ui-t-muted leading-relaxed line-clamp-3">{item.summary}</p>
                  </div>

                  <div className="pt-2 border-t border-[var(--ui-border)] w-full flex items-center justify-between text-[11px] font-semibold ui-t-accent">
                    <span>Ouvrir la fiche</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
