import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network, Code2, Download, Loader2, Check, AlertTriangle, FileJson,
} from 'lucide-react';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';
import type { MethodologyResult } from './methodologyTypes';

type Language = 'python' | 'r' | 'notebook';

const LANGUAGES: { key: Language; label: string; extension: string }[] = [
  { key: 'python', label: 'Python', extension: 'py' },
  { key: 'r', label: 'R', extension: 'R' },
  { key: 'notebook', label: 'Notebook', extension: 'ipynb' },
];

interface Props {
  datasetId: string;
  datasetName?: string;
  result: MethodologyResult;
}

/**
 * Prolongements d'une analyse terminee : la convertir en pipeline nodal
 * editable, ou l'exporter en code reproductible.
 */
export default function ResultActions({ datasetId, datasetName, result }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    'X-Client-Id': getAnonymousClientId(),
  });

  const buildGraph = async () => {
    const response = await fetch(`${API_V1_BASE}/datasets/${datasetId}/methodology/canvas`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ result }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);
    return payload as { nodes: unknown[]; edges: unknown[]; summary: Record<string, unknown> };
  };

  const openInCanvas = async () => {
    setBusy('canvas');
    setMessage(null);
    setWarning(null);
    try {
      const graph = await buildGraph();
      // Le graphe transite par sessionStorage : une URL ne peut pas porter un
      // pipeline complet sans risquer la troncature.
      sessionStorage.setItem('openstats_canvas_import', JSON.stringify({
        nodes: graph.nodes, edges: graph.edges, origin: 'methodology',
      }));
      navigate(`/canvas?dataset=${encodeURIComponent(datasetId)}&from=methodology`);
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Conversion impossible');
    } finally {
      setBusy(null);
    }
  };

  const exportCode = async (language: Language) => {
    setBusy(language);
    setMessage(null);
    setWarning(null);
    try {
      const graph = await buildGraph();
      const response = await fetch(`${API_V1_BASE}/canvas/export_code`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          nodes: graph.nodes, edges: graph.edges,
          language, dataset_name: datasetName ?? 'dataset.csv',
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`);

      const spec = LANGUAGES.find(l => l.key === language)!;
      const content = language === 'notebook'
        ? JSON.stringify(payload.notebook_json, null, 2)
        : payload.code;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analyse_${result.target ?? 'exploration'}.${spec.extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const untranslated: string[] = payload.unsupported_nodes ?? [];
      setMessage(`Script ${spec.label} téléchargé.`);
      if (untranslated.length) {
        setWarning(`Nœuds sans traduction ${spec.label} : ${untranslated.join(', ')}. `
          + 'Le script s’arrête explicitement à ces étapes plutôt que de les ignorer.');
      }
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Export impossible');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="ui-panel overflow-hidden">
      <header className="ui-panel-header">
        <span>Prolonger l’analyse</span>
      </header>

      <div style={{ padding: 'var(--ui-gap-3) var(--ui-pad-x)' }}>
        <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-xs)', marginBottom: 10, lineHeight: 1.65 }}>
          Le pipeline exécuté peut devenir un graphe nodal modifiable, ou un script
          reproductible. Seules les corrections retenues par la boucle sont converties —
          les itérations annulées n’y figurent pas.
        </p>

        <div className="flex items-center flex-wrap" style={{ gap: 'var(--ui-gap-2)' }}>
          <button
            onClick={openInCanvas}
            disabled={busy !== null}
            className="ui-btn ui-btn-primary ui-focusable"
          >
            {busy === 'canvas'
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Network className="w-3 h-3" />}
            Ouvrir dans le canvas
          </button>

          <span className="ui-sep" aria-hidden />

          {LANGUAGES.map(language => (
            <button
              key={language.key}
              onClick={() => exportCode(language.key)}
              disabled={busy !== null}
              className="ui-btn ui-focusable"
              title={`Exporter en ${language.label}`}
            >
              {busy === language.key
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : language.key === 'notebook'
                  ? <FileJson className="w-3 h-3" />
                  : <Code2 className="w-3 h-3" />}
              {language.label}
              <Download className="w-2.5 h-2.5" style={{ opacity: 0.6 }} />
            </button>
          ))}
        </div>

        {message && (
          <p className="flex items-center gap-1.5 ui-t-success"
             style={{ fontSize: 'var(--ui-fs-sm)', marginTop: 10 }}>
            <Check className="w-3 h-3" />
            {message}
          </p>
        )}

        {warning && (
          <p className="flex items-start gap-1.5 ui-t-warning"
             style={{ fontSize: 'var(--ui-fs-xs)', marginTop: 8, lineHeight: 1.55 }}>
            <AlertTriangle className="w-3 h-3 shrink-0" style={{ marginTop: 2 }} />
            {warning}
          </p>
        )}
      </div>
    </section>
  );
}
