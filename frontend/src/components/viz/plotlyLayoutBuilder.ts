import type { Layout } from 'plotly.js';

export interface BuildThemedAxesOptions {
  layout: Partial<Layout>;
  template: Partial<Layout>;
  showGrid: boolean;
  hasCartesian: boolean;
}

export interface ChartCustomizeOptions {
  data: any[];
  layout: Partial<Layout>;
  theme: 'dark' | 'light';
  palette: string;
  showGrid: boolean;
  legendPos: 'right' | 'bottom' | 'none';
  pointSize: number;
  lineWidth: number;
  opacity: number;
  showLabels: boolean;
  userTouchedStyle: boolean;
  colors?: string[];
  template?: Partial<Layout>;
}

const FALLBACK_COLORS = [
  '#0284c7', '#d97706', '#059669', '#dc2626',
  '#0ea5e9', '#b45309', '#0d9488', '#475569',
];

function normalizeAxisTitle(rawTitle: any, templateTitle: any) {
  if (rawTitle === undefined || rawTitle === null) return templateTitle;
  const obj = typeof rawTitle === 'string' ? { text: rawTitle } : rawTitle;
  return {
    ...templateTitle,
    ...obj,
    font: { ...(templateTitle?.font || {}), ...(obj?.font || {}) },
  };
}

/** Applique les couleurs du thème actif sur tous les axes cartésiens (principaux et sous-graphes). */
export function buildThemedAxes(opts: BuildThemedAxesOptions): Record<string, any> {
  const { layout, template, showGrid, hasCartesian } = opts;
  const axes: Record<string, any> = {};
  const layoutAny = layout as Record<string, any>;

  if (hasCartesian) {
    const xBase = layoutAny.xaxis || {};
    const yBase = layoutAny.yaxis || {};
    axes.xaxis = {
      ...template.xaxis,
      ...xBase,
      title: normalizeAxisTitle(xBase.title, (template.xaxis as any)?.title),
      showgrid: xBase.showgrid ?? showGrid,
    };
    axes.yaxis = {
      ...template.yaxis,
      ...yBase,
      title: normalizeAxisTitle(yBase.title, (template.yaxis as any)?.title),
      showgrid: yBase.showgrid ?? showGrid,
    };
  }

  for (const key of Object.keys(layoutAny)) {
    const match = /^([xy])axis(\d+)$/.exec(key);
    if (!match) continue;
    const tplAxis = match[1] === 'x' ? (template.xaxis as any) : (template.yaxis as any);
    const axisVal = layoutAny[key] || {};
    axes[key] = {
      ...tplAxis,
      ...axisVal,
      title: normalizeAxisTitle(axisVal.title, tplAxis?.title),
      showgrid: axisVal.showgrid ?? showGrid,
    };
  }
  return axes;
}

function applyTraceGeometry(
  copy: any,
  traceColor: string,
  opts: ChartCustomizeOptions,
): void {
  const tType = copy.type || 'scatter';
  if (tType === 'heatmap') return;

  if (tType === 'bar' || tType === 'histogram' || tType === 'box' || tType === 'violin') {
    copy.marker = { ...copy.marker, color: copy.marker?.color ?? traceColor };
    if (copy.opacity === undefined || opts.userTouchedStyle) copy.opacity = opts.opacity;
    return;
  }

  const hasCustomSizeArray = Array.isArray(copy.marker?.size);
  const resolvedSize = hasCustomSizeArray
    ? copy.marker.size
    : (opts.userTouchedStyle ? opts.pointSize : (copy.marker?.size ?? opts.pointSize));
  const resolvedOpacity = opts.userTouchedStyle
    ? opts.opacity
    : (copy.marker?.opacity ?? copy.opacity ?? opts.opacity);

  copy.marker = {
    ...copy.marker,
    color: copy.marker?.color ?? traceColor,
    size: resolvedSize,
    opacity: resolvedOpacity,
  };
  copy.line = {
    ...copy.line,
    color: copy.line?.color ?? traceColor,
    width: opts.userTouchedStyle ? opts.lineWidth : (copy.line?.width ?? opts.lineWidth),
  };
}

function applyTraceLabels(copy: any): void {
  const tType = copy.type || 'scatter';
  if (tType === 'bar') {
    copy.texttemplate = '%{y:.2f}';
    copy.textposition = 'auto';
    return;
  }
  if (tType === 'scatter') {
    copy.mode = 'markers+text' + (copy.mode?.includes('lines') ? '+lines' : '');
    copy.text = (copy.y as any[])?.map(v => (typeof v === 'number' ? v.toFixed(1) : ''));
    copy.textposition = 'top center';
  }
}

/** Applique palette, géométrie par type de trace et étiquettes sans écraser les configurations spécifiques. */
export function customizePlotTraces(opts: ChartCustomizeOptions) {
  const colors = opts.colors && opts.colors.length > 0 ? opts.colors : FALLBACK_COLORS;

  return opts.data.map((t, idx) => {
    const traceColor = colors[idx % colors.length];
    const copy = { ...t };
    const tType = copy.type || 'scatter';

    if (tType === 'pie') {
      copy.marker = { ...copy.marker, colors: copy.marker?.colors || colors };
    } else {
      applyTraceGeometry(copy, traceColor, opts);
    }

    if (opts.showLabels) applyTraceLabels(copy);
    return copy;
  });
}

function resolveLegendLayout(opts: ChartCustomizeOptions, activeTemplate: Partial<Layout>): any {
  const { layout, legendPos, userTouchedStyle } = opts;
  if (!userTouchedStyle && layout.legend) {
    return { ...(activeTemplate.legend as any), ...layout.legend };
  }
  if (legendPos === 'bottom') {
    return { ...(activeTemplate.legend as any), orientation: 'h', y: -0.22, x: 0.5, xanchor: 'center' };
  }
  if (legendPos === 'right') {
    return { ...(activeTemplate.legend as any), orientation: 'v', x: 1.03, y: 1 };
  }
  return undefined;
}

function resolveChartTitle(rawTitle: Layout['title'] | undefined, theme: 'dark' | 'light') {
  if (!rawTitle) return undefined;
  return {
    ...(typeof rawTitle === 'string' ? { text: rawTitle } : rawTitle),
    font: {
      color: theme === 'light' ? '#0f172a' : '#eaf0f8',
      size: 14,
      ...(typeof rawTitle === 'object' ? rawTitle.font : {}),
    },
  };
}

/** Construit un layout Plotly cohérent avec le thème Dark/Light et tous ses sous-graphes. */
export function customizePlotLayout(opts: ChartCustomizeOptions): Partial<Layout> {
  const { data, layout, theme, showGrid, legendPos, userTouchedStyle } = opts;
  const activeTemplate = opts.template || {};
  const hasCartesian = !data?.every(t => t.type === 'pie' || t.type === 'scatterpolar');
  const themedAxes = buildThemedAxes({ layout, template: activeTemplate, showGrid, hasCartesian });

  const showLegend = legendPos === 'none'
    ? false
    : (!userTouchedStyle && layout.showlegend !== undefined ? layout.showlegend : true);
  const legend = resolveLegendLayout(opts, activeTemplate);

  const margin = { ...(activeTemplate.margin || {}), ...(layout.margin || {}) };
  if (showLegend && legend?.orientation === 'h' && (legend.y ?? 0) < 0) {
    margin.b = Math.max(margin.b ?? 56, 86);
  }

  const finalLayout: Partial<Layout> = {
    ...activeTemplate,
    ...layout,
    ...themedAxes,
    title: resolveChartTitle(layout.title, theme),
    margin,
    showlegend: showLegend,
    legend,
  };

  if (!hasCartesian) {
    delete (finalLayout as any).xaxis;
    delete (finalLayout as any).yaxis;
  }
  return finalLayout;
}
