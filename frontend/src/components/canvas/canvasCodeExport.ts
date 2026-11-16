import { apiFetch } from '../../lib/apiBase';

export type CanvasExportLanguage = 'python' | 'r' | 'notebook';

export interface CanvasCodeExportPayload {
  nodes: unknown[];
  edges: unknown[];
  dataset_name: string;
  language: CanvasExportLanguage;
}

export interface CanvasCodeExportResponse {
  code?: string;
  notebook_json?: Record<string, unknown>;
  filename?: string;
  unsupported_nodes?: string[];
  error?: string;
}

/**
 * Exporte un pipeline canvas en script Python, R ou notebook Jupyter via `/canvas/export_code`.
 * Lève une erreur explicite si la réponse HTTP n'est pas OK.
 */
export async function requestCanvasCodeExport(
  payload: CanvasCodeExportPayload
): Promise<CanvasCodeExportResponse> {
  const response = await apiFetch('/canvas/export_code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as CanvasCodeExportResponse;
  if (!response.ok) {
    throw new Error(data.error || `Erreur export code (${response.status})`);
  }
  return data;
}

/**
 * Récupère en parallèle le code Python et le code R générés pour un pipeline canvas.
 */
export async function fetchPythonAndRCode(
  basePayload: Omit<CanvasCodeExportPayload, 'language'>
): Promise<{ pythonCode: string; rCode: string }> {
  const [pyResult, rResult] = await Promise.all([
    requestCanvasCodeExport({ ...basePayload, language: 'python' }),
    requestCanvasCodeExport({ ...basePayload, language: 'r' }),
  ]);
  return {
    pythonCode: pyResult.code || '',
    rCode: rResult.code || '',
  };
}
