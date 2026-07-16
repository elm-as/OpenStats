import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, FileJson, Info, CheckCircle2, AlertCircle, ShieldCheck, Activity } from 'lucide-react';
import { useUploadDatasetMutation } from '../store/api';
import { useAppDispatch } from '../hooks';
import { setCurrentDataset } from '../store/slices/datasetSlice';

interface Props {
  onUploaded: (datasetId: string) => void;
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
      setTimeout(() => onUploaded(result.dataset_id), 1000);
    } catch (err: unknown) {
      const apiError = err as { data?: { error?: string } };
      setUploadErrorMessage(apiError?.data?.error || "Erreur lors de l'upload. Vérifiez le format du fichier.");
      console.error('Upload failed:', err);
    }
  }, [uploadDataset, dispatch, onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json', '.jsonl'],
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024,
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-black text-white tracking-tighter">Importation de Données</h2>
        <p className="text-surface-400 mt-2 text-sm max-w-md mx-auto">
          Préparez vos données pour l'analyse. Nos algorithmes d'IA profileront automatiquement votre dataset.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`relative group cursor-pointer transition-all duration-500 rounded-[2rem] p-1 ${
          isDragActive ? 'ring-4 ring-accent-500/20' : ''
        }`}
      >
        <div 
          className={`relative z-10 border-2 border-dashed rounded-[1.9rem] p-16 text-center transition-all duration-500 overflow-hidden
            ${isDragActive
              ? 'border-accent-500 bg-accent-500/5 shadow-glow'
              : 'border-white/10 bg-white/[0.02] hover:border-accent-500/30 hover:bg-white/[0.04]'
            }
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
            ${uploadSuccess ? 'border-emerald-500 bg-emerald-500/5' : ''}
          `}
        >
          <input {...getInputProps()} />

          {isLoading ? (
            <div className="space-y-6">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 border-4 border-accent-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">Analyse Algorithmique...</p>
                <p className="text-xs text-surface-500 uppercase tracking-widest font-black animate-pulse">Profilage Sémantique en cours</p>
              </div>
            </div>
          ) : uploadSuccess ? (
            <div className="space-y-6 animate-slide-up">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-black text-white">Upload Réussi !</p>
                <p className="text-sm text-surface-500 mt-1">Redirection vers le profilage...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center transition-all duration-500 ${
                isDragActive ? 'bg-accent-500/20 scale-110 rotate-12' : 'bg-white/5 group-hover:bg-accent-500/10'
              }`}>
                <Upload className={`w-8 h-8 transition-colors ${isDragActive ? 'text-accent-400' : 'text-surface-500 group-hover:text-accent-400'}`} />
              </div>
              <div>
                <p className="text-lg font-black text-white">
                  {isDragActive ? 'Déposez maintenant' : 'Glissez votre dataset ici'}
                </p>
                <p className="text-sm text-surface-500 mt-1 font-bold">ou cliquez pour parcourir les fichiers</p>
              </div>
              <div className="flex items-center justify-center gap-4 pt-4">
                <span className="badge !bg-white/5 !text-surface-400 !border-white/10">CSV</span>
                <span className="badge !bg-white/5 !text-surface-400 !border-white/10">XLSX</span>
                <span className="badge !bg-white/5 !text-surface-400 !border-white/10">JSON</span>
              </div>
            </div>
          )}

          {/* Decorative floating icons */}
          <div className="absolute top-4 left-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <FileSpreadsheet className="w-12 h-12" />
          </div>
          <div className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-30 transition-opacity">
            <FileJson className="w-12 h-12" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-4 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-accent-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-surface-600 uppercase tracking-widest">Confidentialité</p>
            <p className="text-xs text-surface-300 font-bold">Chiffrement AES-256</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-xl bg-secondary-500/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-secondary-400" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black text-surface-600 uppercase tracking-widest">Capacité</p>
            <p className="text-xs text-surface-300 font-bold">Jusqu'à 500 MB</p>
          </div>
        </div>
      </div>

      {(error || uploadErrorMessage) && (
        <div className="p-4 rounded-2xl flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-bold">{uploadErrorMessage || "Une erreur critique est survenue lors du traitement."}</p>
        </div>
      )}
    </div>
  );
}
