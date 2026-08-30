import { useState, useMemo, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { API_V1_BASE, getAnonymousClientId } from '../../lib/apiBase';
import { saveUserTemplate } from './templates';
import type { NodeResult } from './canvasGraphConfig';

interface UseCanvasExportProps {
  nodes: Node[];
  edges: Edge[];
  pipelineResults: Record<string, NodeResult> | null;
}

export function useCanvasExport({ nodes, edges, pipelineResults }: UseCanvasExportProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showGlobalCodeModal, setShowGlobalCodeModal] = useState(false);
  const [pythonCode, setPythonCode] = useState('');
  const [rCode, setRCode] = useState('');

  const activeDatasetName = useMemo(() => {
    const dsNode = nodes.find(n => n.type === 'dataset');
    const raw = dsNode?.data?.fileName || dsNode?.data?.file || dsNode?.data?.label;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (raw && typeof raw === 'object' && 'name' in raw && typeof raw.name === 'string') {
      return raw.name;
    }
    return 'dataset.csv';
  }, [nodes]);

  const handleShare = async () => {
    if (nodes.length === 0) return;
    setIsSharing(true);
    setShareUrl(null);

    const pipeline = {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        data: Object.fromEntries(
          Object.entries(n.data).filter(([k]) => k !== 'onChange' && k !== 'onDelete')
        ),
        position: n.position,
      })),
      edges: edges.map(e => ({ source: e.source, target: e.target })),
      results: pipelineResults,
    };

    try {
      const response = await fetch(`${API_V1_BASE}/canvas/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': (() => {
            try {
              return getAnonymousClientId();
            } catch {
              return '';
            }
          })(),
        },
        body: JSON.stringify(pipeline),
      });
      const result = await response.json();
      if (result.success) {
        const fullUrl = `${window.location.origin}${result.url}`;
        setShareUrl(fullUrl);
      } else {
        alert('Erreur lors du partage : ' + result.error);
      }
    } catch (e) {
      console.error('Share error:', e);
      alert('Erreur réseau lors du partage');
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      const btn = document.getElementById('copy-btn');
      if (btn) {
        btn.innerHTML =
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="text-emerald-400"><path d="M20 6 9 17l-5-5"/></svg> Copié !';
        setTimeout(() => {
          btn.innerHTML =
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copier le lien';
        }, 2000);
      }
    }
  };

  const handleSaveTemplate = () => {
    if (nodes.length === 0) return;
    const name = window.prompt('Nom du modèle personnalisé :');
    if (!name) return;

    const cleanNodes = nodes.map(n => {
      const cleanData = { ...n.data };
      delete cleanData.runResult;
      delete cleanData.runStatus;
      delete cleanData.runMessage;
      return { ...n, data: cleanData };
    });

    saveUserTemplate(
      name,
      'Modèle personnalisé sauvegardé depuis le Canvas.',
      cleanNodes,
      edges
    );
    alert(
      `Modèle "${name}" sauvegardé avec succès ! Il est disponible dans "Nouveau depuis un Template".`
    );
  };

  const handleOpenGlobalCodeModal = useCallback(async () => {
    setShowGlobalCodeModal(true);
    try {
      const pyRes = await fetch(`${API_V1_BASE}/canvas/export_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
          dataset_name: activeDatasetName,
          language: 'python',
        }),
      });
      const pyData = await pyRes.json();
      if (pyData.code) setPythonCode(pyData.code);

      const rRes = await fetch(`${API_V1_BASE}/canvas/export_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, dataset_name: activeDatasetName, language: 'r' }),
      });
      const rData = await rRes.json();
      if (rData.code) setRCode(rData.code);
    } catch (err) {
      console.error('Erreur lors de la génération de code:', err);
    }
  }, [nodes, edges, activeDatasetName]);

  const handleExportNotebook = useCallback(async () => {
    try {
      const res = await fetch(`${API_V1_BASE}/canvas/export_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          edges,
          dataset_name: activeDatasetName,
          language: 'notebook',
        }),
      });
      const data = await res.json();
      if (data.notebook_json) {
        const blob = new Blob([JSON.stringify(data.notebook_json, null, 2)], {
          type: 'application/x-ipynb+json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || 'pipeline_analyse.ipynb';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Erreur lors de l'export notebook:", err);
    }
  }, [nodes, edges, activeDatasetName]);

  return {
    isSharing,
    shareUrl,
    setShareUrl,
    copyToClipboard,
    handleShare,
    handleSaveTemplate,
    showGlobalCodeModal,
    setShowGlobalCodeModal,
    pythonCode,
    rCode,
    handleOpenGlobalCodeModal,
    handleExportNotebook,
    activeDatasetName,
  };
}
