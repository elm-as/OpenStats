import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUploadDatasetMutation } from '../../store/api';
import { useAppDispatch } from '../../hooks';
import { setCurrentDataset } from '../../store/slices/datasetSlice';
import { extractErrorMessage } from '../ui/errorMessage';
import { getApiOrigin } from '../../lib/apiBase';

interface Props {
  onUploaded: (datasetId: string) => void;
}

const ACCEPTED_FORMATS = ['CSV', 'XLSX', 'XLS', 'JSON', 'JSONL', 'PARQUET'] as const;

function resolveUploadErrorMessage(err: unknown): string {
  const obj = err as { status?: string | number; data?: { error?: string }; error?: string } | undefined;
  if (obj?.status === 'FETCH_ERROR') {
    const endpoint = getApiOrigin() || 'proxy /api';
    return `Serveur backend local injoignable (${endpoint}). Vérifiez que le moteur Python est démarré.`;
  }
  if (obj?.status === 'TIMEOUT_ERROR') {
    return 'Délai dépassé lors de l’envoi du fichier au serveur d’analyse.';
  }
  return extractErrorMessage(err, 'Échec de l’importation. Vérifiez le format ou la disponibilité du backend.');
}

function resolveRejectionMessage(rejections: FileRejection[]): string {
  const firstError = rejections[0]?.errors?.[0];
  if (!firstError) return 'Fichier refusé avant l’envoi.';
  if (firstError.code === 'file-too-large') return 'Fichier trop volumineux (limite maximale : 200 Mo).';
  if (firstError.code === 'too-many-files') return 'Veuillez importer un seul fichier à la fois.';
  if (firstError.code === 'file-invalid-type') {
    return 'Extension non prise en charge. Formats acceptés : CSV, XLSX, XLS, JSON, JSONL, PARQUET.';
  }
  return firstError.message;
}

export default function FileUpload({ onUploaded }: Props) {
  const [uploadDataset, { isLoading, error }] = useUploadDatasetMutation();
  const dispatch = useAppDispatch();
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    setUploadErrorMessage(null);
    setUploadSuccess(false);

    try {
      const result = await uploadDataset(formData).unwrap();
      dispatch(setCurrentDataset(result.dataset_id));
      setUploadSuccess(true);
      setTimeout(() => onUploaded(result.dataset_id), 600);
    } catch (err: unknown) {
      setUploadErrorMessage(resolveUploadErrorMessage(err));
    }
  }, [uploadDataset, dispatch, onUploaded]);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    setUploadSuccess(false);
    setUploadErrorMessage(resolveRejectionMessage(rejections));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.csv'],
      'application/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/json': ['.json', '.jsonl'],
      'application/vnd.apache.parquet': ['.parquet'],
      'application/octet-stream': ['.parquet', '.csv', '.xlsx'],
    },
    maxFiles: 1,
    maxSize: 200 * 1024 * 1024,
  });

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">
      <div className="space-y-1">
        <h2 className="text-lg font-bold ui-t tracking-tight">Ouvrir un jeu de données</h2>
        <p className="text-xs ui-t-muted">
          Détection locale automatique de l’encodage, des délimiteurs et des échelles statistiques.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`ui-panel cursor-pointer transition-colors p-7 text-center border-2 border-dashed ${
          isLoading ? 'opacity-60 pointer-events-none' : ''
        }`}
        style={{
          background: isDragActive ? 'var(--ui-accent-soft)' : 'var(--ui-bg-panel)',
          borderColor: uploadSuccess
            ? 'var(--ui-success)'
            : isDragActive
              ? 'var(--ui-accent)'
              : 'var(--ui-border-strong)',
        }}
      >
        <input {...getInputProps()} />

        {isLoading ? (
          <div className="space-y-2.5 py-3">
            <div
              className="w-7 h-7 mx-auto rounded-full animate-spin"
              style={{ border: '2px solid var(--ui-border)', borderTopColor: 'var(--ui-accent)' }}
            />
            <p className="text-sm font-bold ui-t">Ingestion et profilage en cours…</p>
            <p className="text-xs ui-t-muted">Conversion Parquet locale &amp; détection de types</p>
          </div>
        ) : uploadSuccess ? (
          <div className="space-y-2 py-3">
            <CheckCircle2 className="w-8 h-8 mx-auto ui-t-success" />
            <p className="text-sm font-bold ui-t">Jeu de données importé</p>
            <p className="text-xs ui-t-muted">Ouverture du poste de profilage…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="w-10 h-10 mx-auto rounded-[var(--ui-radius)] flex items-center justify-center"
              style={{ background: isDragActive ? 'var(--ui-accent-soft)' : 'var(--ui-bg-raised)', border: '1px solid var(--ui-border)' }}
            >
              <Upload className={`w-4 h-4 ${isDragActive ? 'ui-t-accent' : 'ui-t-muted'}`} />
            </div>
            <div>
              <p className="text-sm font-bold ui-t">
                {isDragActive ? 'Relâchez le fichier ici' : 'Glissez un fichier ici ou cliquez pour parcourir'}
              </p>
              <p className="text-xs ui-t-muted mt-1 flex items-center justify-center gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5 ui-t-faint" />
                Traitement 100 % local · jusqu’à 200 Mo · sélection multi-feuilles Excel
              </p>
            </div>
            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-0.5">
              {ACCEPTED_FORMATS.map((fmt) => (
                <span key={fmt} className="ui-tag ui-tag-neutral ui-mono">{fmt}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {(error || uploadErrorMessage) && (
        <div
          className="p-3 rounded-[var(--ui-radius)] flex items-center gap-2.5 text-xs ui-t-danger"
          style={{ background: 'var(--ui-danger-soft)', border: '1px solid var(--ui-danger-soft)' }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="font-semibold">{uploadErrorMessage || resolveUploadErrorMessage(error)}</p>
        </div>
      )}
    </div>
  );
}
