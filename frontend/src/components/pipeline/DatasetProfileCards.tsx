import React from 'react';
import { Database, Clock, Hash, Gauge } from 'lucide-react';

interface DatasetProfileStripProps {
  profile: any;
  allColumnsCount: number;
}

export function DatasetProfileStrip(props: DatasetProfileStripProps) {
  const { profile, allColumnsCount } = props;
  const structureLabel = profile.is_timeseries
    ? 'Série temporelle'
    : profile.is_panel
    ? 'Données de panel'
    : 'Coupe transversale';

  return (
    <div className="ui-panel px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs">
      <div className="flex items-center gap-2 ui-num">
        <Database className="w-3.5 h-3.5 text-accent-400 shrink-0" />
        <span className="text-surface-400">Observations :</span>
        <span className="font-semibold text-surface-100">{profile.n_rows.toLocaleString()}</span>
      </div>

      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="text-surface-400">Temporel :</span>
        <span className="font-semibold text-surface-100 truncate max-w-[180px]">
          {profile.temporal_cols?.length > 0 ? profile.temporal_cols.join(', ') : 'Aucune date'}
        </span>
      </div>

      <div className="flex items-center gap-2 ui-num">
        <Hash className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-surface-400">Variables :</span>
        <span className="font-semibold text-surface-100">
          {allColumnsCount} ({profile.numeric_cols?.length || 0} num / {profile.categorical_cols?.length || 0} cat)
        </span>
      </div>

      <div className="flex items-center gap-2 ui-num">
        <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-surface-400">Structure :</span>
        <span className="font-semibold text-surface-100">{structureLabel}</span>
        {profile.duplicate_rows > 0 && (
          <span className="text-amber-400">• {profile.duplicate_rows} doublon(s)</span>
        )}
      </div>
    </div>
  );
}
