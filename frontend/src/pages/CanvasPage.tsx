import React, { lazy, Suspense } from 'react';

const CanvasFlow = lazy(() => import('../components/canvas/CanvasFlow'));

function CanvasFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-surface-400 gap-4 animate-fade-in">
      <div className="skeleton h-10 w-48 rounded-lg" />
      <div className="grid-auto-fit w-full max-w-xl">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
      <div className="skeleton h-64 w-full max-w-2xl rounded-xl" />
      <span className="sr-only">Chargement du Canvas…</span>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden w-full m-[-20px] pb-[40px] md:m-[-20px] md:pb-[40px]">
      <Suspense fallback={<CanvasFallback />}>
        <CanvasFlow />
      </Suspense>
    </div>
  );
}
