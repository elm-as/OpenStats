import { useState } from 'react';
import { useGenerateReportMutation } from '../store/api';
import { useAppSelector } from '../hooks';
import { FileText, Download, Building2, FileSpreadsheet, Code, Globe, Sparkles, Presentation as PresentationIcon, FileType, Wand2, BookOpen, AlertCircle } from 'lucide-react';
import { API_V1_BASE, getAnonymousClientId } from '../lib/apiBase';

interface Props {
  datasetId: string;
}

type ExportFormat = 'pdf' | 'excel' | 'json' | 'html';

export default function ReportPanel({ datasetId }: Props) {
  const [generateReport, { isLoading }] = useGenerateReportMutation();
  const authEnabled = false;
  const accessToken = null;
  const [title, setTitle] = useState("Rapport d'Analyse");
  const [organization, setOrganization] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proLoading, setProLoading] = useState<'pdf' | 'docx' | 'pptx' | null>(null);

  const handleProfessional = async (fmt: 'pdf' | 'docx' | 'pptx') => {
    setError(null);
    setProLoading(fmt);
    try {
      const headers: HeadersInit = {};
      // Mode anonyme (isolation par navigateur)
      try { headers['X-Client-Id'] = getAnonymousClientId(); } catch {}
      if (authEnabled && accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/report/professional/${fmt}`, {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        const text = await response.text();
        let msg = 'Erreur génération';
        try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const ext = fmt;
      const filename = resolveFilename(
        response.headers.get('Content-Disposition'),
        `rapport_pro_${datasetId}.${ext}`,
      );
      downloadBlob(blob, filename);
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la génération');
    } finally {
      setProLoading(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const resolveFilename = (disposition: string | null, fallback: string) => {
    if (!disposition) return fallback;
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }
    const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (basicMatch?.[1]) {
      return basicMatch[1];
    }
    return fallback;
  };

  const handleGenerate = async () => {
    setError(null);
    try {
      const blob = await generateReport({
        id: datasetId,
        title,
        organization: organization || 'OpenStats — Elmas Labs',
      }).unwrap();

      downloadBlob(blob, `rapport_${datasetId}.pdf`);
    } catch (err) {
      console.error(err);
      setError((err as any)?.data?.error || (err as any)?.error || (err as any)?.message || 'Erreur lors de la génération du PDF');
    }
  };

  const handleExport = async (fmt: ExportFormat) => {
    if (fmt === 'pdf') {
      await handleGenerate();
      return;
    }

    setError(null);
    setExporting(fmt);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      // Mode anonyme (isolation par navigateur)
      try { headers['X-Client-Id'] = getAnonymousClientId(); } catch {}
      if (authEnabled && accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/export/${fmt}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          organization: organization || 'OpenStats — Elmas Labs',
        }),
      });

      if (!response.ok) {
        const responseText = await response.text();
        let message = 'Erreur export';
        try {
          const err = JSON.parse(responseText);
          message = err.error || message;
        } catch {
          if (responseText) {
            message = responseText;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const filename = resolveFilename(
        response.headers.get('Content-Disposition'),
        `export_${datasetId}.${ext}`,
      );
      downloadBlob(blob, filename);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || 'Erreur lors de l\'export');
    } finally {
      setExporting(null);
    }
  };

  const formats: { key: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'pdf', label: 'PDF', icon: <FileText className="w-5 h-5" />, desc: 'Rapport exécutif complet avec graphiques' },
    { key: 'excel', label: 'Excel', icon: <FileSpreadsheet className="w-5 h-5" />, desc: 'Onglets par section, formatage conditionnel' },
    { key: 'json', label: 'JSON', icon: <Code className="w-5 h-5" />, desc: 'Export structuré pour intégration API' },
    { key: 'html', label: 'HTML', icon: <Globe className="w-5 h-5" />, desc: 'Rapport interactif autonome' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-surface-50">Rapports et Exports</h2>
        <p className="text-sm text-surface-400 mt-1">
          Exportez vos résultats dans le format de votre choix
        </p>
      </div>

      <div className="card max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Titre du rapport
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Mon Rapport d'Analyse"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Organisation
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Mon Entreprise"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Rapport professionnel (style cabinet de conseil) */}
      <div className="max-w-lg space-y-3">
        <div className="bg-gradient-to-br from-accent-500/10 to-secondary-500/10 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-accent-400" />
            <h3 className="font-bold text-surface-100">Rapport Professionnel</h3>
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-500/20 text-accent-300 border border-accent-500/30">
              IA
            </span>
          </div>
          <p className="text-xs text-surface-400 mb-3">
            Style cabinet de conseil : page de garde, résumé exécutif, insights narratifs, méthodologie, recommandations.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'pdf' as const, label: 'PDF', icon: FileText, color: 'text-red-400' },
              { key: 'docx' as const, label: 'DOCX', icon: FileType, color: 'text-blue-400' },
              { key: 'pptx' as const, label: 'PPTX', icon: PresentationIcon, color: 'text-orange-400' },
            ]).map(({ key, label, icon: Icon, color }) => {
              const loading = proLoading === key;
              return (
                <button
                  key={key}
                  onClick={() => handleProfessional(key)}
                  disabled={!!proLoading}
                  className="flex flex-col items-center gap-1 p-3 rounded-lg bg-surface-800/40 hover:bg-surface-800/60 border border-white/10 transition-colors disabled:opacity-50"
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-xs font-medium text-surface-300">{label}</span>
                  {loading && (
                    <div className="animate-spin w-3 h-3 border-2 border-accent-400 border-t-transparent rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Formats d'export classiques */}
      <div className="grid grid-cols-2 gap-3 max-w-lg">
        {formats.map(fmt => {
          const loading = (fmt.key === 'pdf' && isLoading) || exporting === fmt.key;
          return (
            <button
              key={fmt.key}
              onClick={() => handleExport(fmt.key)}
              disabled={loading || isLoading || !!exporting}
              className="card hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="text-emerald-600">{fmt.icon}</div>
                <span className="font-semibold text-surface-50">{fmt.label}</span>
              </div>
              <p className="text-xs text-surface-400">{fmt.desc}</p>
              {loading && (
                <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                  <div className="animate-spin w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full" />
                  Export en cours...
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="card max-w-lg p-4 bg-gray-50">
        <h4 className="text-sm font-medium text-surface-300 mb-2">Contenu du rapport :</h4>
        <ul className="text-sm text-surface-400 space-y-1">
          <li>1. Page de garde avec titre et organisation</li>
          <li>2. Résumé exécutif et profil des données</li>
          <li>3. Analyses exploratoires, corrélations et graphiques</li>
          <li>4. Tests d'hypothèses et analyse factorielle</li>
          <li>5. Modélisation prédictive et explicabilité SHAP</li>
          <li>6. Séries temporelles et prévisions</li>
          <li>7. Historique des opérations</li>
        </ul>
      </div>
    </div>
  );
}
