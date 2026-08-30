import React from 'react';
import { PALETTES } from './plotlyTheme';

interface PlotlySettingsPanelProps {
  palette: string;
  setPalette: (p: string) => void;
  showGrid: boolean;
  setShowGrid: (g: boolean) => void;
  legendPos: 'right' | 'bottom' | 'none';
  setLegendPos: (pos: 'right' | 'bottom' | 'none') => void;
  showLabels: boolean;
  setShowLabels: (l: boolean) => void;
  pointSize: number;
  setPointSize: (s: number) => void;
  lineWidth: number;
  setLineWidth: (w: number) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  trendline: boolean;
  setTrendline: (t: boolean) => void;
  detectedChartType: string;
  isScatterNumeric: boolean;
}

export function PlotlySettingsPanel({
  palette,
  setPalette,
  showGrid,
  setShowGrid,
  legendPos,
  setLegendPos,
  showLabels,
  setShowLabels,
  pointSize,
  setPointSize,
  lineWidth,
  setLineWidth,
  opacity,
  setOpacity,
  trendline,
  setTrendline,
  detectedChartType,
  isScatterNumeric,
}: PlotlySettingsPanelProps) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
      {/* Palette */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-surface-400 uppercase font-semibold">
          Palette de couleurs
        </label>
        <select
          value={palette}
          onChange={e => setPalette(e.target.value)}
          className="bg-surface-950 border border-white/10 rounded px-2 py-1 text-xs text-surface-200 outline-none focus:border-accent-500"
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
        <label className="text-[10px] text-surface-400 uppercase font-semibold">
          Grille d'arrière-plan
        </label>
        <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={e => setShowGrid(e.target.checked)}
            className="accent-accent-500"
          />
          Afficher les axes
        </label>
      </div>

      {/* Légende */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-surface-400 uppercase font-semibold">
          Légende
        </label>
        <select
          value={legendPos}
          onChange={e => setLegendPos(e.target.value as any)}
          className="bg-surface-950 border border-white/10 rounded px-2 py-1 text-xs text-surface-200 outline-none focus:border-accent-500"
        >
          <option value="bottom">En bas</option>
          <option value="right">À droite</option>
          <option value="none">Masquée</option>
        </select>
      </div>

      {/* Data Labels */}
      <div className="flex flex-col gap-1 justify-center">
        <label className="text-[10px] text-surface-400 uppercase font-semibold">
          Valeurs des points
        </label>
        <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={e => setShowLabels(e.target.checked)}
            className="accent-accent-500"
          />
          Afficher sur le graphe
        </label>
      </div>

      {/* Sliders d'ajustements fins */}
      {detectedChartType !== 'pie' && detectedChartType !== 'heatmap' && (
        <>
          {/* Taille Marqueurs */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">
              Taille des marqueurs ({pointSize}px)
            </label>
            <input
              type="range"
              min="3"
              max="14"
              value={pointSize}
              onChange={e => setPointSize(Number(e.target.value))}
              className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
            />
          </div>

          {/* Épaisseur de ligne */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">
              Épaisseur de trait ({lineWidth}px)
            </label>
            <input
              type="range"
              min="1"
              max="6"
              value={lineWidth}
              onChange={e => setLineWidth(Number(e.target.value))}
              className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
            />
          </div>

          {/* Opacité */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-surface-400 uppercase font-semibold">
              Opacité ({Math.round(opacity * 100)}%)
            </label>
            <input
              type="range"
              min="20"
              max="100"
              value={opacity * 100}
              onChange={e => setOpacity(Number(e.target.value) / 100)}
              className="w-full accent-accent-500 h-1 rounded-lg cursor-pointer"
            />
          </div>

          {/* Droite de tendance */}
          {isScatterNumeric && (
            <div className="flex flex-col gap-1 justify-center">
              <label className="text-[10px] text-surface-400 uppercase font-semibold">
                Statistiques
              </label>
              <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-surface-300">
                <input
                  type="checkbox"
                  checked={trendline}
                  onChange={e => setTrendline(e.target.checked)}
                  className="accent-accent-500"
                />
                Droite de régression (y = ax + b)
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
