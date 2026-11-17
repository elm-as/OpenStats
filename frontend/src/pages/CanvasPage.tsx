import React, { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';

const CanvasFlow = lazy(() => import('../components/canvas/CanvasFlow'));

function CanvasFallback() {
  return (
    <div className="flex items-center justify-center h-full ui-t-muted gap-2 text-xs">
      <Loader2 className="w-4 h-4 animate-spin text-accent-400" />
      <span>Chargement du Canvas…</span>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <div className="flex-1 h-full w-full overflow-hidden flex flex-col">
      <Suspense fallback={<CanvasFallback />}>
        <CanvasFlow />
      </Suspense>
    </div>
  );
}
