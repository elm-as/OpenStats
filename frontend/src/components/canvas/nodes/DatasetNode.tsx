import { useRef, useState } from 'react';
import { NodeProps, Node } from '@xyflow/react';
import { Database, Upload, Link, Server, Loader2, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { useListDatasetsQuery, useUploadDatasetMutation } from '../../../store/api';
import { CanvasNodeData, NodeShell, NodeLabel, NodeSelect, NodeInput, useNodeUpdate } from './_shared';

const ALLOWED_EXT = '.csv,.xlsx,.xls,.json,.jsonl,.parquet,.tsv';
const EXT_LABELS = 'CSV, XLSX, XLS, JSON, JSONL, Parquet, TSV';

export function DatasetNode({ id, data }: NodeProps<Node<CanvasNodeData>>) {
  const handleChange = useNodeUpdate(id, data);
  const { data: result } = useListDatasetsQuery();
  const datasets = result?.datasets ?? [];
  const [uploadDataset, { isLoading: isUploading }] = useUploadDatasetMutation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');
  const [urlInput, setUrlInput] = useState((data.file as string) || '');

  const importMode = (data.importMode as string) || 'existing';

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setUploadStatus('idle');
    setUploadError('');
    setPreviewFileName('');
    handleChange(e);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXT.split(',').includes(ext)) {
      setUploadStatus('error');
      setUploadError(`Format non supporte : ${ext}. Formats acceptes : ${EXT_LABELS}`);
      return;
    }

    setPreviewFileName(file.name);
    setUploadStatus('uploading');
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);

      const response = await uploadDataset(formData).unwrap();

      if (data.onChange) {
        data.onChange(id, 'importMode', 'existing');
        data.onChange(id, 'file', response.dataset_id);
      }

      setUploadStatus('success');
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (err: any) {
      const message = err?.data?.error || err?.message || 'Echec de l\'upload';
      setUploadStatus('error');
      setUploadError(message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlFetch = () => {
    if (!urlInput.trim()) return;
    if (data.onChange) {
      data.onChange(id, 'importMode', 'url');
      data.onChange(id, 'file', urlInput.trim());
    }
  };

  return (
    <NodeShell id={id} data={data} color="#10b981" icon={Database} title="Source de donnees" hasInput={false}>
      <div>
        <NodeLabel>Mode d'import</NodeLabel>
        <NodeSelect name="importMode" value={importMode} onChange={handleModeChange}>
          <option value="existing">Dataset existant (OpenStats)</option>
          <option value="csv">Fichier local</option>
          <option value="url">URL distante</option>
          <option value="sql">Base de donnees SQL</option>
        </NodeSelect>
      </div>

      {importMode === 'existing' && (
        <div>
          <NodeLabel>Dataset</NodeLabel>
          {datasets.length === 0 ? (
            <div className="text-[10px] text-surface-500 bg-black/20 rounded-lg p-3 text-center border border-white/[0.04]">
              Aucun dataset disponible. Importez un fichier ci-dessous.
            </div>
          ) : (
            <NodeSelect name="file" value={(data.file as string) || ''} onChange={handleChange}>
              <option value="">-- Choisir un dataset --</option>
              {datasets.map((ds: any) => (
                <option key={ds.id} value={ds.id}>{ds.name}</option>
              ))}
            </NodeSelect>
          )}
        </div>
      )}

      {importMode === 'csv' && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXT}
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleFileClick}
            disabled={isUploading}
            className={`w-full py-3 rounded-xl border border-dashed transition-all flex flex-col items-center gap-2 ${
              uploadStatus === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                : uploadStatus === 'error'
                ? 'border-red-500/40 bg-red-500/[0.04]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-accent-500/30 hover:bg-accent-500/[0.04] cursor-pointer'
            }`}
          >
            {uploadStatus === 'uploading' ? (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <Loader2 size={22} className="text-accent-400 animate-spin" />
                <span className="text-[11px] text-accent-300 font-medium">Upload en cours...</span>
                <span className="text-[9px] text-surface-500 truncate max-w-[180px]">{previewFileName}</span>
              </div>
            ) : uploadStatus === 'success' ? (
              <div className="flex flex-col items-center gap-1 py-1">
                <CheckCircle2 size={22} className="text-emerald-400" />
                <span className="text-[11px] text-emerald-300 font-medium">Importe avec succes</span>
                <span className="text-[9px] text-surface-500 truncate max-w-[180px]">{previewFileName}</span>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="flex flex-col items-center gap-1 py-1 w-full px-2">
                <XCircle size={22} className="text-red-400" />
                <span className="text-[10px] text-red-300 font-medium">Echec de l'import</span>
                <span className="text-[9px] text-red-400/70 text-center leading-tight">{uploadError}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-1">
                <div className="w-10 h-10 rounded-full bg-accent-500/10 flex items-center justify-center">
                  <Upload size={18} className="text-accent-400" />
                </div>
                <span className="text-[12px] text-surface-300 font-medium">Cliquer pour parcourir</span>
                <span className="text-[9px] text-surface-600">{EXT_LABELS}</span>
              </div>
            )}
          </button>
        </div>
      )}

      {importMode === 'url' && (
        <div className="space-y-2">
          <NodeLabel>URL du fichier</NodeLabel>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
              placeholder="https://example.com/data.csv"
              className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
            />
            <button
              type="button"
              onClick={handleUrlFetch}
              className="px-3 py-2 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/20 text-accent-300 text-[11px] font-semibold transition-colors shrink-0"
            >
              Ok
            </button>
          </div>
          <p className="text-[9px] text-surface-600 leading-relaxed">
            Collez l'URL directe d'un fichier CSV, XLSX, JSON ou Parquet accessible publiquement.
          </p>
        </div>
      )}

      {importMode === 'sql' && (
        <div className="space-y-2">
          <NodeLabel>Chaine de connexion</NodeLabel>
          <NodeInput
            name="file"
            placeholder="postgresql://user:password@host:5432/dbname"
            value={(data.file as string) || ''}
            onChange={handleChange}
          />
          <div className="grid grid-cols-2 gap-2">
            <NodeInput
              name="sqlTable"
              placeholder="Nom de la table"
              value={(data.sqlTable as string) || ''}
              onChange={handleChange}
            />
            <NodeInput
              name="sqlQuery"
              placeholder="Requete SQL (optionnel)"
              value={(data.sqlQuery as string) || ''}
              onChange={handleChange}
            />
          </div>
          <p className="text-[9px] text-surface-600 leading-relaxed">
            Connexion directe a PostgreSQL. La table ou la requete sera chargee en DataFrame.
          </p>
        </div>
      )}

      {importMode !== 'existing' && importMode !== 'csv' && (
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              if (data.onChange) {
                data.onChange(id, 'importMode', 'existing');
              }
            }}
            className="w-full py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Database size={12} />
            Revenir a la selection d'un dataset existant
          </button>
        </div>
      )}
    </NodeShell>
  );
}
