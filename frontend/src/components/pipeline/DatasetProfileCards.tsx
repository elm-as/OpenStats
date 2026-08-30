import React from 'react';
import { Database, Clock, Hash, Gauge } from 'lucide-react';

interface DatasetProfileCardsProps {
  profile: any;
  allColumnsCount: number;
}

export function DatasetProfileCards({ profile, allColumnsCount }: DatasetProfileCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
        <p className="text-[11px] font-medium text-surface-400 flex items-center gap-1.5 mb-1">
          <Database className="w-3.5 h-3.5 text-accent-400" />
          Observations
        </p>
        <p className="text-base font-bold text-white">{profile.n_rows.toLocaleString()} lignes</p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {profile.has_temporal ? 'Série chronologique' : 'Coupe transversale'}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
        <p className="text-[11px] font-medium text-surface-400 flex items-center gap-1.5 mb-1">
          <Clock className="w-3.5 h-3.5 text-purple-400" />
          Dimension Temporelle
        </p>
        <p className="text-base font-bold text-purple-300">
          {profile.temporal_cols?.length > 0 ? profile.temporal_cols.join(', ') : 'Aucune date'}
        </p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {profile.has_temporal ? 'Analyses économétriques prêtes' : 'Standard'}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
        <p className="text-[11px] font-medium text-surface-400 flex items-center gap-1.5 mb-1">
          <Hash className="w-3.5 h-3.5 text-blue-400" />
          Variables Prédictives (X)
        </p>
        <p className="text-base font-bold text-white">{allColumnsCount} colonnes</p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {profile.numeric_cols?.length || 0} num / {profile.categorical_cols?.length || 0} cat
        </p>
      </div>

      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
        <p className="text-[11px] font-medium text-surface-400 flex items-center gap-1.5 mb-1">
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          Structure Détectée
        </p>
        <p className="text-base font-bold text-emerald-300">
          {profile.is_timeseries
            ? 'Série Temporelle'
            : profile.is_panel
            ? 'Données de Panel'
            : 'Coupe Transversale'}
        </p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {profile.duplicate_rows === 0
            ? 'Qualité optimale (0 doublon)'
            : `${profile.duplicate_rows} doublons`}
        </p>
      </div>
    </div>
  );
}
