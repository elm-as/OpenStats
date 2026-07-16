import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListMarketplaceItemsQuery, useImportMarketplaceItemMutation } from '../store/api';
import {
  Search, Package, Download, Upload, Star, TrendingUp, BrainCircuit,
  BarChart3, Brush, Layers, Dices, Loader2,
  Play, Network, ArrowRight, Grid3X3, Zap,
} from 'lucide-react';
import type { MarketplaceItemSummary, MarketplaceItemDetail } from '../types';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';

const ICON_MAP: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  'bar-chart-3': BarChart3,
  'brain-circuit': BrainCircuit,
  'trending-up': TrendingUp,
  brush: Brush,
  layers: Layers,
  dices: Dices,
};

const COLOR_MAP: Record<string, string> = {
  'bar-chart-3': '#06b6d4',
  'brain-circuit': '#a855f7',
  'trending-up': '#3b82f6',
  brush: '#ec4899',
  layers: '#10b981',
  dices: '#f97316',
};

const FILTERS = [
  { key: 'all' as const, label: 'Tous' },
  { key: 'featured' as const, label: 'Vedettes', icon: Star },
  { key: 'template' as const, label: 'Templates', icon: Grid3X3 },
  { key: 'extension' as const, label: 'Extensions', icon: Zap },
];

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'featured' | 'template' | 'extension'>('all');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const { data, isLoading } = useListMarketplaceItemsQuery({
    featured: filter === 'featured' ? true : undefined,
    category: filter === 'template' || filter === 'extension' ? filter : undefined,
    search: search || undefined,
  });
  const [importItem, { isLoading: isImporting }] = useImportMarketplaceItemMutation();

  const items = data?.items ?? [];

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        await importItem(json).unwrap();
        toast.success({ title: 'Import reussi', description: `"${json.name}" a ete ajoute a la marketplace.` });
      } catch (err) {
        toast.error({ title: 'Import echoue', description: extractErrorMessage(err) });
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
          <p className="text-sm text-muted">Chargement de la marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="relative rounded-2xl bg-surface-900 border border-white/5 shadow-sm">
        <div className="relative z-10 px-6 py-6 md:px-8 md:py-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <p className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">Templates & Extensions</p>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter leading-[1.1] mb-2">
              Marketplace
            </h1>
            <p className="text-surface-400 text-[13px] leading-relaxed max-w-lg">
              Installez des templates et extensions pour accelerer vos analyses.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleImport} disabled={isImporting} className="btn-primary">
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importer
            </button>
            <button
              onClick={() => navigate('/canvas')}
              className="btn-secondary text-xs"
            >
              <Network className="w-4 h-4" />
              Canvas
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Rechercher un template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-accent-500/50 placeholder:text-faint text-default"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-xl">
          {FILTERS.map((f) => {
            const FilterIcon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f.key
                    ? 'bg-surface-800 text-accent-300 shadow-sm border border-white/10'
                    : 'text-muted hover:text-default hover:bg-white/5'
                }`}
              >
                {FilterIcon && <FilterIcon className="w-3 h-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun element trouve.</p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-2 text-xs text-accent-400 hover:underline">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <MarketplaceCard
              key={item.id}
              item={item}
              isSelected={selectedItem === item.id}
              onSelect={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketplaceCard({
  item,
  isSelected,
  onSelect,
  navigate,
}: {
  item: MarketplaceItemSummary & { payload?: MarketplaceItemDetail['payload'] };
  isSelected: boolean;
  onSelect: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const IconComponent = ICON_MAP[item.icon] || Package;
  const accentColor = COLOR_MAP[item.icon] || '#06b6d4';
  const nodeCount = item.payload?.nodes?.length ?? null;

  return (
    <div
      className={`card cursor-pointer transition-all duration-200 group ${
        isSelected ? 'border-accent-500/40 ring-1 ring-accent-500/20' : 'hover:border-accent-500/30'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110 duration-300"
          style={{ background: `${accentColor}18`, boxShadow: `0 0 20px ${accentColor}10` }}
        >
          <IconComponent className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-strong truncate">{item.name}</h3>
            {item.featured && (
              <span className="badge badge-warning text-[8px] !px-1.5 !py-0 flex items-center gap-0.5 shrink-0">
                <Star className="w-2 h-2" />
                Vedette
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted">{item.author}</p>
            <span className="text-faint/30">·</span>
            <span className="text-[10px] text-muted font-mono">v{item.version}</span>
            {nodeCount !== null && (
              <>
                <span className="text-faint/30">·</span>
                <span className="text-[10px] text-faint">{nodeCount} noeud{nodeCount > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-3">{item.description}</p>

      {/* Tags */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 flex-wrap">
          {item.tags?.slice(0, 4).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[9px] rounded-md bg-white/5 text-faint font-medium">
              {tag}
            </span>
          ))}
          <span
            className="px-1.5 py-0.5 text-[9px] rounded-md font-semibold uppercase"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {item.item_type}
          </span>
        </div>
        <span className="text-[10px] text-faint flex items-center gap-1 shrink-0">
          <Download className="w-3 h-3" />
          {item.downloads}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.payload?.nodes) {
              const encoded = encodeURIComponent(JSON.stringify(item.payload));
              navigate(`/canvas?template=${encoded}`);
            }
          }}
          disabled={!item.payload?.nodes}
          className="flex-1 py-1.5 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 text-accent-300 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border border-accent-500/20"
        >
          <Download className="w-3 h-3" />
          Installer
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (item.payload?.nodes) {
              const encoded = encodeURIComponent(JSON.stringify(item.payload));
              navigate(`/canvas?template=${encoded}`);
            }
          }}
          disabled={!item.payload?.nodes}
          className="flex-1 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border border-purple-500/20"
        >
          <Play className="w-3 h-3" />
          Ouvrir
        </button>
      </div>

      {/* Expanded detail (selected) */}
      {isSelected && (
        <div className="mt-3 pt-3 border-t border-white/5 animate-slide-up space-y-2">
          <p className="text-[10px] text-faint uppercase tracking-wider font-semibold">
            Contenu du template
          </p>
          {item.payload?.nodes && item.payload.nodes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.payload.nodes.map((n, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-faint border border-white/5">
                  {n.type}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (item.payload?.nodes) {
                const encoded = encodeURIComponent(JSON.stringify(item.payload));
                navigate(`/canvas?template=${encoded}`);
              }
            }}
            disabled={!item.payload?.nodes}
            className="w-full py-2 rounded-lg bg-accent-500/15 hover:bg-accent-500/25 text-accent-300 text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Network className="w-3.5 h-3.5" />
            Ouvrir dans Canvas
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
