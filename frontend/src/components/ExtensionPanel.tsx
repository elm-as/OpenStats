import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  useSaveExtensionMutation,
  useListExtensionsQuery,
  useListExtensionTemplatesQuery,
  useRunExtensionMutation,
  useRunExtensionCodeMutation,
} from '../store/api';
import {
  Play,
  Save,
  AlertCircle,
  CheckCircle2,
  Terminal,
  Loader2,
} from 'lucide-react';
import { useToast } from './ui/Toast';
import { extractErrorMessage } from './ui/errorMessage';
import { ExtensionSidebar } from './extension/ExtensionSidebar';
import { ExtensionChartRenderer } from './extension/ExtensionChartRenderer';

interface Props {
  datasetId: string;
}

export default function ExtensionPanel({ datasetId }: Props) {
  const { data: extensions, refetch: refetchExtensions } = useListExtensionsQuery();
  const { data: templates } = useListExtensionTemplatesQuery();
  const [saveExtension, { isLoading: isSaving }] = useSaveExtensionMutation();
  const [runExtension, { isLoading: isRunningStored }] = useRunExtensionMutation();
  const [runExtensionCode, { isLoading: isRunningRaw }] = useRunExtensionCodeMutation();

  const isRunning = isRunningStored || isRunningRaw;
  const toast = useToast();

  const [code, setCode] = useState(
    '# Écrivez votre script ici\n\ndef analyze_custom(df, params):\n    # Votre logique ici\n    return {\n        "status": "success",\n        "result_summary": {"message": "Hello World"}\n    }'
  );
  const [name, setName] = useState('Nouvelle Analyse');
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 2000);
  };

  const handleSave = async () => {
    try {
      await saveExtension({ name, description, code }).unwrap();
      toast.success('Extension sauvegardée avec succès !');
      refetchExtensions();
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const handleRun = async (extensionId?: string) => {
    setError(null);
    setOutput(null);
    try {
      let res;
      if (extensionId) {
        res = await runExtension({ script_id: extensionId, dataset_id: datasetId }).unwrap();
      } else {
        res = await runExtensionCode({ code, dataset_id: datasetId }).unwrap();
      }
      setOutput(res);
      toast.success('Exécution terminée avec succès !');
    } catch (err: any) {
      const msg = extractErrorMessage(err, "Erreur lors de l'exécution");
      setError(msg);
      toast.error(msg);
    }
  };


  const applyTemplate = (tpl: { name: string; description: string; code: string }) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setCode(tpl.code);
    setOutput(null);
    setError(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      <ExtensionSidebar
        templates={templates}
        extensions={extensions}
        prompt={prompt}
        setPrompt={setPrompt}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onApplyTemplate={applyTemplate}
        onSelectExtension={ext => {
          setName(ext.name);
          setCode(ext.code);
          setDescription(ext.description);
        }}
        onRunExtension={handleRun}
      />

      {/* Main Editor & Output area */}
      <div className="lg:col-span-8 space-y-6">
        <div className="card p-0 flex flex-col min-h-[700px]">
          {/* Editor Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex-1 space-y-1">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="bg-transparent border-none p-0 text-xl font-black text-white focus:ring-0 placeholder:text-surface-700 w-full"
                placeholder="Nom du script"
              />
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="bg-transparent border-none p-0 text-xs text-surface-500 focus:ring-0 placeholder:text-surface-800 w-full"
                placeholder="Description optionnelle..."
              />
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-secondary px-4 py-2 text-xs bg-white/5"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Sauvegarder
              </button>
              <button
                onClick={() => handleRun()}
                disabled={isRunning}
                className="btn-primary px-4 py-2 text-xs"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Exécuter
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="h-[500px] relative border-b border-white/5 bg-black/20">
            <Editor
              loading={
                <div className="flex items-center justify-center h-full text-surface-500 font-mono text-sm animate-pulse">
                  Initialisation de l'éditeur de code...
                </div>
              }
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={val => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1.6,
                padding: { top: 20 },
                roundedSelection: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
              }}
            />
          </div>

          {/* Output / Console */}
          <div className="border-t border-white/5 bg-black/40">
            <div className="p-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-surface-500" />
                <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest">
                  Résultats de l'exécution
                </span>
              </div>
              {output && (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Succès
                </span>
              )}
            </div>
            <div className="p-4 max-h-[500px] overflow-y-auto font-mono text-xs">
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
              )}
              {output && (
                <div className="space-y-6">
                  {/* Summary Data */}
                  <pre className="p-4 rounded-xl bg-surface-900 border border-white/5 text-emerald-300 overflow-x-auto">
                    {JSON.stringify(output.result_summary || output, null, 2)}
                  </pre>

                  {/* Rendered Charts */}
                  {output.charts && Array.isArray(output.charts) && output.charts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {output.charts.map((chart: any, i: number) => (
                        <ExtensionChartRenderer key={i} chart={chart} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!error && !output && (
                <p className="text-surface-600 italic">En attente d'exécution...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
