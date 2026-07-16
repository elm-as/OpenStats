/** Extract a human-readable message from any thrown/RTKQ error-like value. */
export function extractErrorMessage(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const e = err as {
      message?: string;
      data?: { detail?: string; message?: string; error?: string };
      error?: string;
      status?: number | string;
    };
    return (
      e.data?.detail ||
      e.data?.message ||
      e.data?.error ||
      e.message ||
      e.error ||
      (typeof e.status !== 'undefined' ? `Erreur ${e.status}` : fallback)
    );
  }
  return fallback;
}
