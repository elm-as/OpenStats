import { useState, useMemo, useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { apiFetch } from '../../lib/apiBase';
import { useToast } from '../ui/Toast';
import { fetchPythonAndRCode, requestCanvasCodeExport } from './canvasCodeExport';
import { saveUserTemplate } from './templates';
import type { NodeResult } from './canvasGraphConfig';

interface UseCanvasExportProps {
  nodes: Node[];
  edges: Edge[];
  pipelineResults: Record<string, NodeResult> | null;
}

export function useCanvasExport(props: UseCanvasExportProps) {
  const { nodes, edges, pipelineResults } = props;
  const toast = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
      const response = await apiFetch('/canvas/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      });
      const result = await response.json();
      if (result.success) {
        setShareUrl(`${window.location.origin}${result.url}`);
      } else {
        toast.error({ title: 'Partage impossible', description: String(result.error || 'Erreur') });
      }
    } catch (e) {
      console.error('Share error:', e);
      toast.error({ title: 'Erreur réseau', description: 'Échec lors du partage du canvas.' });
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveTemplate = (customName?: string) => {
    if (nodes.length === 0) return;
    const name = customName?.trim() || `Modèle (${nodes.length} blocs — ${new Date().toLocaleTimeString('fr-FR')})`;
    const cleanNodes = nodes.map(n => {
      const cleanData = { ...n.data };
      delete cleanData.runResult;
      delete cleanData.runStatus;
      delete cleanData.runMessage;
      return { ...n, data: cleanData };
    });

    saveUserTemplate({
      name,
      description: 'Modèle personnalisé sauvegardé depuis le Canvas.',
      nodes: cleanNodes,
      edges,
    });
    toast.success({ title: 'Modèle enregistré', description: `"${name}" ajouté aux modèles.` });
  };

  const handleOpenGlobalCodeModal = useCallback(async () => {
    setShowGlobalCodeModal(true);
    try {
      const { pythonCode: generatedPy, rCode: generatedR } = await fetchPythonAndRCode({
        nodes,
        edges,
        dataset_name: activeDatasetName,
      });
      if (generatedPy) setPythonCode(generatedPy);
      if (generatedR) setRCode(generatedR);
    } catch (err) {
      console.error('Erreur lors de la génération de code:', err);
    }
  }, [nodes, edges, activeDatasetName]);

  const handleExportNotebook = useCallback(async () => {
    try {
      const data = await requestCanvasCodeExport({
        nodes,
        edges,
        dataset_name: activeDatasetName,
        language: 'notebook',
      });
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
    copied,
    copyToClipboard,
    handleShare,
    handleSaveTemplate,
    showGlobalCodeModal,
    setShowGlobalCodeModal,
    pythonCode,
    rCode,
    handleOpenGlobalCodeModal,
    handleExportNotebook,
  };
}
