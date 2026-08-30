import React from 'react';
import { Radar, Layers, Hash, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { Section, KpiCard, DataTable } from './ResultAtoms';
import { PlotlyChart } from '../../viz/PlotlyBase';


interface HierarchicalClusteringResultViewProps {
  resultData: any;
}

export const HierarchicalClusteringResultView: React.FC<HierarchicalClusteringResultViewProps> = ({
  resultData,
}) => {
  const dendro = resultData.dendrogram;
  const cutThreshold = resultData.cut_threshold;
  const k = resultData.n_clusters;
  const sil = resultData.silhouette_score;
  const summary = resultData.cluster_summary || [];
  const points = resultData.projection_2d?.points || [];
  const varExplained = resultData.projection_2d?.variance_explained || [0, 0];

  // Traces pour le dendrogramme Plotly
  const dendroTraces: any[] = [];
  if (dendro && dendro.icoord && dendro.dcoord) {
    for (let i = 0; i < dendro.icoord.length; i++) {
      const color = dendro.color_list?.[i] || '#0ea5e9';
      dendroTraces.push({
        x: dendro.icoord[i],
        y: dendro.dcoord[i],
        type: 'scatter',
        mode: 'lines',
        line: { color, width: 2 },
        hoverinfo: 'y',
        showlegend: false,
      });
    }

    // Ligne de coupure en pointillé rouge
    if (cutThreshold !== undefined) {
      const minX = Math.min(...dendro.icoord.flat());
      const maxX = Math.max(...dendro.icoord.flat());
      dendroTraces.push({
        x: [minX, maxX],
        y: [cutThreshold, cutThreshold],
        type: 'scatter',
        mode: 'lines',
        line: { color: '#ef4444', width: 2, dash: 'dash' },
        name: `Seuil (k = ${k})`,
        hoverinfo: 'name+y',
        showlegend: true,
      });
    }
  }

  // Traces pour la projection 2D
  const clusterGroups: Record<string, { x: number[]; y: number[] }> = {};
  points.forEach((p: any) => {
    if (!clusterGroups[p.cluster]) {
      clusterGroups[p.cluster] = { x: [], y: [] };
    }
    clusterGroups[p.cluster].x.push(p.x);
    clusterGroups[p.cluster].y.push(p.y);
  });

  const scatterTraces: any[] = Object.entries(clusterGroups).map(([clusterName, coords], idx) => {
    const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#14b8a6'];
    return {
      x: coords.x,
      y: coords.y,
      type: 'scatter',
      mode: 'markers',
      name: clusterName,
      marker: {
        size: 7,
        color: colors[idx % colors.length],
        opacity: 0.85,
        line: { color: '#ffffff', width: 1 },
      },
    };
  });

  // Tableau récapitulatif
  const headers = ['Cluster', 'Effectif (N)', 'Part (%)'];
  const featureCols = resultData.features || [];
  featureCols.forEach((f: string) => headers.push(`Moyenne ${f}`));

  const rows = summary.map((s: any) => {
    const r = [s.cluster, s.count, `${s.percentage}%`];
    featureCols.forEach((f: string) => {
      r.push(s.means?.[f] !== undefined ? String(s.means[f]) : '—');
    });
    return r;
  });

  return (
    <div className="space-y-6">
      {/* KPIs & Qualité */}
      <Section title="Diagnostic du Clustering Hiérarchique" icon={Radar} color="#0ea5e9">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Clusters (k)" value={k} icon={Radar} color="#0ea5e9" />
          <KpiCard label="Méthode" value={resultData.method?.toUpperCase()} icon={Layers} color="#8b5cf6" />
          <KpiCard
            label="Score Silhouette"
            value={sil !== null ? sil : 'N/A'}
            icon={CheckCircle2}
            color={sil !== null && sil > 0.4 ? '#10b981' : sil > 0.25 ? '#f59e0b' : '#ef4444'}
          />
          <KpiCard label="Seuil de Coupure" value={cutThreshold ?? 'Auto'} icon={TrendingUp} color="#3b82f6" />
        </div>
      </Section>

      {/* Dendrogramme Plotly */}
      {dendroTraces.length > 0 && (
        <Section title="Dendrogramme & Ligne de Coupure" icon={Layers} color="#0ea5e9">
          <div className="bg-surface-900/60 rounded-xl border border-white/[0.06] p-2 overflow-hidden">
            <PlotlyChart
              data={dendroTraces}
              layout={{
                title: { text: 'Dendrogramme des liaisons hiérarchiques' },
                xaxis: { title: { text: 'Observations / Groupes' }, showticklabels: false, gridcolor: '#1f2937' },
                yaxis: { title: { text: 'Distance de liaison' }, gridcolor: '#1f2937' },
                height: 380,
                margin: { l: 50, r: 20, t: 40, b: 40 },
                showlegend: true,
              }}
              className="w-full"
            />
          </div>
        </Section>
      )}

      {/* Projection 2D PCA */}
      {scatterTraces.length > 0 && (
        <Section title="Projection 2D des Clusters (ACP)" icon={Layers} color="#8b5cf6">
          <div className="bg-surface-900/60 rounded-xl border border-white/[0.06] p-2 overflow-hidden">
            <PlotlyChart
              data={scatterTraces}
              layout={{
                title: { text: 'Répartition spatiale des clusters' },
                xaxis: { title: { text: `Axe 1 (${varExplained[0]}% var)` }, gridcolor: '#1f2937' },
                yaxis: { title: { text: `Axe 2 (${varExplained[1]}% var)` }, gridcolor: '#1f2937' },
                height: 360,
                margin: { l: 50, r: 20, t: 40, b: 40 },
              }}
              className="w-full"
            />
          </div>
        </Section>
      )}


      {/* Profil des clusters */}
      {rows.length > 0 && (
        <Section title="Profils Comparatifs des Clusters" icon={Hash} color="#10b981">
          <DataTable headers={headers} rows={rows} />
        </Section>
      )}
    </div>
  );
};
