import { useState } from 'react';
import { useGenerateReportMutation } from '../../store/api';
import {
  FileText, Building2, FileSpreadsheet, Code, Globe,
  Presentation as PresentationIcon, FileType, Loader2,
} from 'lucide-react';
import { apiFetch } from '../../lib/apiBase';

interface Props {
  datasetId: string;
}

type ExportFormat = 'pdf' | 'excel' | 'json' | 'html';

export default function ReportPanel({ datasetId }: Props) {
  const [generateReport, { isLoading }] = useGenerateReportMutation();
  const [title, setTitle] = useState("Rapport d'Analyse");
  const [organization, setOrganization] = useState('');
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proLoading, setProLoading] = useState<'pdf' | 'docx' | 'pptx' | null>(null);

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
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const basicMatch = disposition.match(/filename="?([^";]+)"?/i);
    return basicMatch?.[1] || fallback;
  };

  const handleProfessional = async (fmt: 'pdf' | 'docx' | 'pptx') => {
    setError(null);
    setProLoading(fmt);
    try {
      const response = await apiFetch(`/datasets/${datasetId}/report/professional/${fmt}`, { method: 'POST' });
      if (!response.ok) {
        const text = await response.text();
        let msg = 'Erreur génération';
        try { msg = JSON.parse(text).error || msg; } catch { msg = text || msg; }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const filename = resolveFilename(
        response.headers.get('Content-Disposition'),
        `rapport_pro_${datasetId}.${fmt}`,
      );
      downloadBlob(blob, filename);
    } catch (err) {
      setError((err as Error).message || 'Erreur lors de la génération');
    } finally {
      setProLoading(null);
    }
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
      setError((err as any)?.data?.error || (err as any)?.message || 'Erreur lors de la génération du PDF');
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
      const response = await apiFetch(`/datasets/${datasetId}/export/${fmt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, organization: organization || 'OpenStats — Elmas Labs' }),
      });
      if (!response.ok) throw new Error((await response.text()) || 'Erreur export');
      const blob = await response.blob();
      const ext = fmt === 'excel' ? 'xlsx' : fmt;
      const filename = resolveFilename(
        response.headers.get('Content-Disposition'),
        `export_${datasetId}.${ext}`,
      );
      downloadBlob(blob, filename);
    } catch (err) {
      setError((err as Error).message || "Erreur lors de l'export");
    } finally {
      setExporting(null);
    }
  };

  const formats: { key: ExportFormat; label: string; icon: React.ReactNode; desc: string }[] = [
    { key: 'pdf', label: 'PDF', icon: <FileText className="w-4 h-4" />, desc: 'Rapport complet avec graphiques' },
    { key: 'excel', label: 'Excel', icon: <FileSpreadsheet className="w-4 h-4" />, desc: 'Classeur multi-onglets' },
    { key: 'json', label: 'JSON', icon: <Code className="w-4 h-4" />, desc: 'Données structurées' },
    { key: 'html', label: 'HTML', icon: <Globe className="w-4 h-4" />, desc: 'Page autonome' },
  ];

  return (
    <div className="space-y-3 max-w-2xl">
      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ui-text)' }}>
            <FileText className="w-3.5 h-3.5" style={{ color: 'var(--ui-accent)' }} />
            Métadonnées du rapport
          </span>
        </header>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="ui-label block mb-1">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="ui-input w-full"
              placeholder="Rapport d'Analyse"
            />
          </div>
          <div>
            <label className="ui-label flex items-center gap-1 mb-1">
              <Building2 className="w-3 h-3" /> Organisation
            </label>
            <input
              type="text"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              className="ui-input w-full"
              placeholder="Organisation"
            />
          </div>
        </div>
      </section>

      {error && (
        <div
          className="ui-panel px-3 py-2 text-xs ui-t-danger"
          style={{ background: 'var(--ui-danger-soft)', borderColor: 'var(--ui-danger)' }}
        >
          {error}
        </div>
      )}

      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span style={{ color: 'var(--ui-text)' }}>Rapport structuré</span>
        </header>
        <div className="p-3 grid grid-cols-3 gap-2">
          {([
            { key: 'pdf' as const, label: 'PDF', icon: FileText },
            { key: 'docx' as const, label: 'DOCX', icon: FileType },
            { key: 'pptx' as const, label: 'PPTX', icon: PresentationIcon },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleProfessional(key)}
              disabled={!!proLoading}
              className="ui-btn ui-focusable justify-center py-2 text-xs"
            >
              {proLoading === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ui-panel overflow-hidden">
        <header className="ui-panel-header">
          <span style={{ color: 'var(--ui-text)' }}>Exports bruts</span>
        </header>
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {formats.map(fmt => {
            const loading = (fmt.key === 'pdf' && isLoading) || exporting === fmt.key;
            return (
              <button
                key={fmt.key}
                onClick={() => handleExport(fmt.key)}
                disabled={loading || isLoading || !!exporting}
                className="ui-btn ui-focusable justify-center text-xs"
                title={fmt.desc}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : fmt.icon}
                <span>{fmt.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
