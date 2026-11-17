import type { useNavigate } from 'react-router-dom';
import {
  Package,
  Star,
  Download,
  Network,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  BarChart3,
  Brush,
  Layers,
  Dices,
} from 'lucide-react';
import type { MarketplaceItemSummary, MarketplaceItemDetail } from '../../types';

const ICON_MAP: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  'bar-chart-3': BarChart3,
  'brain-circuit': BrainCircuit,
  'trending-up': TrendingUp,
  brush: Brush,
  layers: Layers,
  dices: Dices,
};

const COLOR_MAP: Record<string, string> = {
  'bar-chart-3': '#0891b2',
  'brain-circuit': '#0e7490',
  'trending-up': '#2563eb',
  brush: '#d97706',
  layers: '#059669',
  dices: '#ea580c',
};

export interface MarketplaceCardProps {
  item: MarketplaceItemSummary & { payload?: MarketplaceItemDetail['payload'] };
  isSelected: boolean;
  onSelect: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

export function MarketplaceCard(props: MarketplaceCardProps) {
  const { item, isSelected, onSelect, navigate } = props;
  const IconComponent = ICON_MAP[item.icon] || Package;
  const accentColor = COLOR_MAP[item.icon] || '#06b6d4';
  const nodeCount = item.payload?.nodes?.length ?? null;

  const openInCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.payload?.nodes) return;
    const encoded = encodeURIComponent(JSON.stringify(item.payload));
    navigate(`/canvas?template=${encoded}`);
  };

  return (
    <div
      className={`ui-panel p-4 cursor-pointer transition-colors ${
        isSelected ? 'border-accent-500/40 ring-1 ring-accent-500/20' : 'hover:border-accent-500/30'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2.5">
        <div
          className="w-8 h-8 rounded-[var(--ui-radius-sm)] flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}1a`, border: `1px solid ${accentColor}30` }}
        >
          <IconComponent className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm ui-t truncate">{item.name}</h3>
            {item.featured && (
              <span className="ui-tag ui-tag-warning shrink-0">
                <Star className="w-2.5 h-2.5" />
                Vedette
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] ui-t-muted ui-num">
            <span>{item.author}</span>
            <span className="ui-t-faint">·</span>
            <span className="ui-mono">v{item.version}</span>
            {nodeCount !== null && (
              <>
                <span className="ui-t-faint">·</span>
                <span className="ui-t-faint">{nodeCount} bloc{nodeCount > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs ui-t-muted leading-snug line-clamp-2 mb-3">{item.description}</p>

      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 flex-wrap">
          {item.tags?.slice(0, 4).map((tag) => (
            <span key={tag} className="ui-tag ui-tag-neutral text-[10px]">
              {tag}
            </span>
          ))}
          <span
            className="ui-tag text-[10px] uppercase"
            style={{ background: `${accentColor}15`, color: accentColor }}
          >
            {item.item_type}
          </span>
        </div>
        <span className="text-[11px] ui-t-faint flex items-center gap-1 shrink-0 ui-num">
          <Download className="w-3 h-3" />
          {item.downloads}
        </span>
      </div>

      {/* Action unique */}
      <div className="pt-2.5 border-t border-[var(--ui-border)]">
        <button
          type="button"
          onClick={openInCanvas}
          disabled={!item.payload?.nodes}
          className="w-full ui-btn ui-btn-primary ui-focusable justify-center text-xs"
        >
          <Network className="w-3.5 h-3.5" />
          Ouvrir dans Canvas
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isSelected && item.payload?.nodes && item.payload.nodes.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--ui-border)] flex flex-wrap gap-1">
          {item.payload.nodes.map((n, i) => (
            <span key={i} className="ui-tag ui-tag-neutral text-[10px]">
              {n.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
