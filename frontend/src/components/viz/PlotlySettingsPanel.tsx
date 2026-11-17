import React from 'react';
import { PALETTES } from './plotlyTheme';

export interface PlotlyStyleValues {
  palette: string;
  showGrid: boolean;
  legendPos: 'right' | 'bottom' | 'none';
  showLabels: boolean;
  pointSize: number;
  lineWidth: number;
  opacity: number;
  trendline: boolean;
}

export interface PlotlyStyleActions {
  setPalette: (p: string) => void;
  setShowGrid: (g: boolean) => void;
  setLegendPos: (pos: 'right' | 'bottom' | 'none') => void;
  setShowLabels: (l: boolean) => void;
  setPointSize: (s: number) => void;
  setLineWidth: (w: number) => void;
  setOpacity: (o: number) => void;
  setTrendline: (t: boolean) => void;
  onResetDefaults?: () => void;
}

export interface PlotlyChartMeta {
  detectedChartType: string;
  isScatterNumeric: boolean;
}

interface PlotlySettingsPanelProps {
  values: PlotlyStyleValues;
  actions: PlotlyStyleActions;
  meta: PlotlyChartMeta;
}

export function PlotlySettingsPanel({
  values,
  actions,
  meta,
}: PlotlySettingsPanelProps) {
  const { palette, showGrid, legendPos, showLabels, pointSize, lineWidth, opacity, trendline } = values;
  const { setPalette, setShowGrid, setLegendPos, setShowLabels, setPointSize, setLineWidth, setOpacity, setTrendline, onResetDefaults } = actions;
  const { detectedChartType, isScatterNumeric } = meta;

  return (
    <div
      className="rounded-[var(--ui-radius)] p-3.5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn"
      style={{ background: 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}
    >
      {/* Palette */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] ui-t-muted uppercase font-semibold">
          Palette de couleurs
        </label>
        <select
          value={palette}
          onChange={e => setPalette(e.target.value)}
          className="ui-select text-xs"
        >
          {Object.entries(PALETTES).map(([k, p]) => (
            <option key={k} value={k}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grille */}
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-[10px] ui-t-muted uppercase font-semibold">
          Grille d'arrière-plan
        </label>
        <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs" style={{ color: 'var(--ui-text-secondary)' }}>
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
            className="accent-[var(--ui-accent)]"
          />
          Afficher les axes
        </label>
      </div>

      {/* Légende */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] ui-t-muted uppercase font-semibold">
          Légende
        </label>
        <select
          value={legendPos}
          onChange={e => setLegendPos(e.target.value as 'right' | 'bottom' | 'none')}
          className="ui-select text-xs"
        >
          <option value="bottom">En bas</option>
          <option value="right">À droite</option>
          <option value="none">Masquée</option>
        </select>
      </div>

      {/* Data Labels */}
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-[10px] ui-t-muted uppercase font-semibold">
          Valeurs des points
        </label>
        <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs" style={{ color: 'var(--ui-text-secondary)' }}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={e => setShowLabels(e.target.checked)}
            className="accent-[var(--ui-accent)]"
          />
          Afficher sur le graphe
        </label>
      </div>

      {/* Sliders d'ajustements fins */}
      {detectedChartType !== 'pie' && detectedChartType !== 'heatmap' && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] ui-t-muted uppercase font-semibold">
              Taille des marqueurs ({pointSize}px)
            </label>
            <input
              type="range"
              min="3"
              max="14"
              value={pointSize}
              onChange={e => setPointSize(Number(e.target.value))}
              className="w-full accent-[var(--ui-accent)] h-1 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] ui-t-muted uppercase font-semibold">
              Épaisseur de trait ({lineWidth}px)
            </label>
            <input
              type="range"
              min="1"
              max="6"
              value={lineWidth}
              onChange={e => setLineWidth(Number(e.target.value))}
              className="w-full accent-[var(--ui-accent)] h-1 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] ui-t-muted uppercase font-semibold">
              Opacité ({Math.round(opacity * 100)}%)
            </label>
            <input
              type="range"
              min="20"
              max="100"
              value={opacity * 100}
              onChange={e => setOpacity(Number(e.target.value) / 100)}
              className="w-full accent-[var(--ui-accent)] h-1 rounded-lg cursor-pointer"
            />
          </div>

          {isScatterNumeric && (
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-[10px] ui-t-muted uppercase font-semibold">
                Statistiques
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs" style={{ color: 'var(--ui-text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={trendline}
                  onChange={e => setTrendline(e.target.checked)}
                  className="accent-[var(--ui-accent)]"
                />
                Droite de régression (y = ax + b)
              </label>
            </div>
          )}
        </>
      )}

      {onResetDefaults && (
        <div className="col-span-2 md:col-span-4 flex justify-end pt-2" style={{ borderTop: '1px solid var(--ui-border)' }}>
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-[11px] ui-t-muted hover:underline cursor-pointer"
          >
            Rétablir les paramètres par défaut
          </button>
        </div>
      )}
    </div>
  );
}
