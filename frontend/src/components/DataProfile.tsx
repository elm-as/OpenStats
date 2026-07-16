import { useState } from 'react';
import type { DatasetProfile, ColumnProfile } from '../types';
import { Database, Hash, Calendar, Tag, ToggleLeft, Pencil, Check, X, Info, Layers, BarChart } from 'lucide-react';
import { useUpdateColumnTypeMutation } from '../store/api';

interface Props {
  profile: DatasetProfile;
  datasetId?: string;
}

const TYPE_ICONS: Record<string, any> = {
  continu: Hash,
  discret: Layers,
  temporel: Calendar,
  catégoriel_nominal: Tag,
  binaire: ToggleLeft,
};

const TYPE_COLORS: Record<string, string> = {
  continu: '!bg-blue-500/10 !text-blue-400 !border-blue-500/20',
  discret: '!bg-indigo-500/10 !text-indigo-400 !border-indigo-500/20',
  temporel: '!bg-purple-500/10 !text-purple-400 !border-purple-500/20',
  catégoriel_nominal: '!bg-amber-500/10 !text-amber-400 !border-amber-500/20',
  binaire: '!bg-emerald-500/10 !text-emerald-400 !border-emerald-500/20',
};

const STAT_TYPES = ['continu', 'discret', 'temporel', 'catégoriel_nominal', 'binaire'] as const;

export default function DataProfile({ profile, datasetId }: Props) {
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState('');
  const [updateColumnType, { isLoading: isUpdating }] = useUpdateColumnTypeMutation();

  const handleEdit = (col: ColumnProfile) => {
    setEditingCol(col.nom_brut);
    setSelectedType(col.type_statistique);
  };

  const handleCancel = () => {
    setEditingCol(null);
    setSelectedType('');
  };

  const handleConfirm = async (colName: string) => {
    if (!datasetId) return;
    try {
      await updateColumnType({ id: datasetId, column: colName, new_type: selectedType }).unwrap();
    } catch {
      // silently fail — badge stays unchanged
    }
    setEditingCol(null);
    setSelectedType('');
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-6 bg-accent-500 rounded-full" />
            <h2 className="text-3xl font-black text-white tracking-tighter">Profilage Sémantique</h2>
          </div>
          <p className="text-sm text-surface-500 font-bold max-w-lg">
            Analyse structurelle et détection de types avancée. Le dictionnaire de données est injecté 
            comme contexte sémantique pour l'IA.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/5 p-1 rounded-2xl border border-white/5">
          {[
            { label: 'Lignes', value: profile.shape.rows.toLocaleString(), icon: Layers },
            { label: 'Colonnes', value: profile.shape.columns, icon: BarChart },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-3 text-center">
              <p className="text-xs font-black text-surface-600 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl font-black text-white num">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Dictionnaire de données Table */}
      <div className="card p-0 overflow-hidden border-white/10">
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02]">
                <th className="py-5 px-6">Variable</th>
                <th className="py-5 px-6">Type Statistique</th>
                <th className="py-5 px-6">Unité</th>
                <th className="py-5 px-6 text-right">Nullité</th>
                <th className="py-5 px-6 text-right">Cardinalité</th>
                <th className="py-5 px-6 text-right">Distribution (Min/Max)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {profile.dictionary.map((col: ColumnProfile) => {
                const Icon = TYPE_ICONS[col.type_statistique] || Database;
                return (
                  <tr key={col.nom_brut} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-surface-50 mb-0.5">{col.nom_brut}</div>
                      <div className="text-[10px] text-surface-500 font-black uppercase tracking-widest">{col.nom_lisible}</div>
                    </td>
                    <td className="py-4 px-6">
                      {editingCol === col.nom_brut ? (
                        <div className="flex items-center gap-2 animate-slide-up">
                          <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="!py-1.5 !px-3 !text-xs !w-40"
                            disabled={isUpdating}
                          >
                            {STAT_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleConfirm(col.nom_brut)}
                              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-2 rounded-lg bg-white/5 text-surface-400 hover:bg-white/10 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 group/edit">
                          <div className={`p-2 rounded-xl ${TYPE_COLORS[col.type_statistique]?.replace('!bg-', 'bg-').replace('!text-', 'text-')} opacity-80`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className={`badge ${TYPE_COLORS[col.type_statistique]}`}>
                            {col.type_statistique}
                          </span>
                          {datasetId && (
                            <button
                              onClick={() => handleEdit(col)}
                              className="p-1.5 rounded-lg bg-white/5 text-surface-600 hover:text-accent-400 opacity-0 group-hover/edit:opacity-100 transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {col.unite_mesure ? (
                        <span className="text-xs font-bold text-surface-300 px-2 py-1 rounded bg-white/5 border border-white/5">
                          {col.unite_mesure}
                        </span>
                      ) : (
                        <span className="text-surface-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <NullityBadge rate={col.taux_nullite} />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <span className="num text-sm text-surface-300 font-bold">{col.cardinalite}</span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3 text-xs num">
                        <span className="text-surface-500">{col.stats.min != null ? Number(col.stats.min).toFixed(2) : '—'}</span>
                        <div className="w-12 h-1 bg-white/5 rounded-full relative">
                          <div className="absolute inset-0 bg-accent-500/20 rounded-full" />
                        </div>
                        <span className="text-surface-200 font-bold">{col.stats.max != null ? Number(col.stats.max).toFixed(2) : '—'}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NullityBadge({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(1);
  let statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  if (rate > 0 && rate < 0.1) statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
  if (rate >= 0.1) statusColor = 'text-red-500 bg-red-500/10 border-red-500/20';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border ${statusColor} num text-[10px] font-bold`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusColor.split(' ')[0].replace('text-', 'bg-')}`} />
      {pct}%
    </div>
  );
}
