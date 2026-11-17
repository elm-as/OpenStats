import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListMarketplaceItemsQuery, useImportMarketplaceItemMutation } from '../store/api';
import {
  Search, Package, Upload, Star, Loader2, Network, Grid3X3, Zap,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { extractErrorMessage } from '../components/ui/errorMessage';
import { MarketplaceCard } from '../components/marketplace/MarketplaceCard';

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
        toast.success({ title: 'Import réussi', description: `"${json.name}" ajouté au catalogue.` });
      } catch (err) {
        toast.error({ title: 'Import échoué', description: extractErrorMessage(err) });
      }
    };
    input.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent-400 animate-spin" />
          <p className="text-xs ui-t-muted">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <header className="ui-panel px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-base md:text-lg font-bold ui-t tracking-tight">
            Recettes &amp; Extensions
          </h1>
          <span className="text-xs ui-t-muted ui-num">({items.length})</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleImport} disabled={isImporting} className="ui-btn ui-btn-primary ui-focusable text-xs">
            {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importer (.json)
          </button>
          <button onClick={() => navigate('/canvas')} className="ui-btn ui-focusable text-xs">
            <Network className="w-3.5 h-3.5" />
            Canvas
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ui-t-muted" />
          <input
            type="text"
            placeholder="Rechercher un template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ui-input w-full pl-9 pr-4 text-xs"
          />
        </div>
        <div
          className="flex items-center gap-1 p-1 rounded border"
          style={{ background: 'var(--ui-bg-panel)', borderColor: 'var(--ui-border)' }}
        >
          {FILTERS.map((f) => {
            const FilterIcon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`ui-btn text-xs ${filter === f.key ? 'ui-btn-primary' : 'ui-btn-ghost'}`}
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
        <div className="text-center py-12 ui-t-muted">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Aucun élément trouvé.</p>
          {search && (
            <button onClick={() => setSearch('')} className="mt-2 text-xs text-accent-400 hover:underline">
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
