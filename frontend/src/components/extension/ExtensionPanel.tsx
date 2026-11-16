import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  useGenerateExtensionMutation,
  useSaveExtensionMutation,
  useListExtensionsQuery,
  useListExtensionTemplatesQuery,
  useRunExtensionMutation,
  useRunExtensionCodeMutation,
} from '../../store/api';
import {
  Play, Save, AlertCircle, CheckCircle2, Terminal, Loader2, Code2, WifiOff,
} from 'lucide-react';
import { useToast } from '../ui/Toast';
import { extractErrorMessage } from '../ui/errorMessage';
import { ExtensionSidebar } from './ExtensionSidebar';
import { ExtensionChartRenderer } from './ExtensionChartRenderer';

interface Props {
  datasetId: string;
}

const DEFAULT_SCRIPT =
  '# Script Python exécuté dans le bac à sable OpenStats\n\ndef analyze_custom(df, params):\n    return {\n        "status": "success",\n        "result_summary": {"rows": len(df), "columns": len(df.columns)}\n    }';

function useDocumentTheme(): 'dark' | 'light' {
  const read = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const [theme, setTheme] = useState<'dark' | 'light'>(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

export default function ExtensionPanel({ datasetId }: Props) {
  const theme = useDocumentTheme();
  const { data: extensions, refetch: refetchExtensions } = useListExtensionsQuery();
  const { data: templates } = useListExtensionTemplatesQuery();
  const [generateExtension, { isLoading: isGenerating }] = useGenerateExtensionMutation();
  const [saveExtension, { isLoading: isSaving }] = useSaveExtensionMutation();
  const [runExtension, { isLoading: isRunningStored }] = useRunExtensionMutation();
  const [runExtensionCode, { isLoading: isRunningRaw }] = useRunExtensionCodeMutation();

  const isRunning = isRunningStored || isRunningRaw;
  const toast = useToast();

  const [code, setCode] = useState(DEFAULT_SCRIPT);
  const [name, setName] = useState('Nouvelle Analyse');
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');

  // Résilience hors-ligne : Monaco charge ses workers CDN ; bascule proprement vers l'éditeur brut si indisponible.
  const [monacoMounted, setMonacoMounted] = useState(false);
  const [usePlainEditor, setUsePlainEditor] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );

  useEffect(() => {
    if (usePlainEditor || monacoMounted) return;
    const timer = window.setTimeout(() => {
      if (!monacoMounted) setUsePlainEditor(true);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [usePlainEditor, monacoMounted]);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('Décrivez le script à générer avant de lancer la génération.');
      return;
    }
    setError(null);
    try {
      const res = await generateExtension({ prompt: trimmed, dataset_id: datasetId }).unwrap();
      if (res.name) setName(res.name);
      if (res.description) setDescription(res.description);
      if (res.code) setCode(res.code);
      toast.success('Script généré.');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erreur lors de la génération');
      setError(msg);
      toast.error(msg);
    }
  };

  const handleSave = async () => {
    try {
      await saveExtension({ name, description, code }).unwrap();
      toast.success('Extension sauvegardée.');
      refetchExtensions();
    } catch (err: unknown) {
      toast.error(extractErrorMessage(err, 'Erreur lors de la sauvegarde'));
    }
  };

  const handleRun = async (extensionId?: string) => {
    setError(null);
    setOutput(null);
    try {
      const res = extensionId
        ? await runExtension({ script_id: extensionId, dataset_id: datasetId }).unwrap()
        : await runExtensionCode({ code, dataset_id: datasetId }).unwrap();
      setOutput(res);
      toast.success('Exécution terminée.');
    } catch (err: unknown) {
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

  const handlePlainKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const target = e.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    setCode(`${code.slice(0, start)}    ${code.slice(end)}`);
    requestAnimationFrame(() => {
      target.selectionStart = target.selectionEnd = start + 4;
    });
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-fade-in">
      <ExtensionSidebar
        templates={templates}
        extensions={extensions}
        prompt={prompt}
        setPrompt={setPrompt}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onApplyTemplate={applyTemplate}
        onSelectExtension={(ext) => {
          setName(ext.name);
          setCode(ext.code);
          setDescription(ext.description);
        }}
        onRunExtension={handleRun}
      />

      <div className="lg:col-span-8 space-y-4">
        <div className="ui-panel overflow-hidden flex flex-col min-h-[660px]">
          <div
            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: 'var(--ui-bg-raised)', borderBottom: '1px solid var(--ui-border)' }}
          >
            <div className="flex-1 min-w-0 space-y-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-transparent border-none p-0 text-base font-bold ui-t focus:ring-0 w-full"
                placeholder="Nom du script"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-transparent border-none p-0 text-xs ui-t-muted focus:ring-0 w-full"
                placeholder="Description optionnelle…"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <span className="ui-tag ui-tag-neutral ui-num">{lineCount} lignes</span>
              <button
                type="button"
                onClick={() => {
                  setMonacoMounted(false);
                  setUsePlainEditor((prev) => !prev);
                }}
                className="ui-btn ui-btn-ghost ui-focusable"
                title={usePlainEditor ? 'Basculer vers Monaco IDE' : 'Basculer vers éditeur brut hors-ligne'}
              >
                {usePlainEditor ? <Code2 className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {usePlainEditor ? 'Monaco' : 'Brut'}
              </button>
              <button onClick={handleSave} disabled={isSaving} className="ui-btn ui-focusable">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Sauvegarder
              </button>
              <button onClick={() => handleRun()} disabled={isRunning} className="ui-btn ui-btn-primary ui-focusable">
                {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Exécuter
              </button>
            </div>
          </div>

          <div className="h-[440px] relative" style={{ background: 'var(--ui-bg-sunken)', borderBottom: '1px solid var(--ui-border)' }}>
            {usePlainEditor ? (
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handlePlainKeyDown}
                spellCheck={false}
                aria-label="Éditeur de script Python hors-ligne"
                className="w-full h-full p-4 ui-mono resize-none outline-none border-none rounded-none leading-relaxed"
                style={{ background: 'var(--ui-bg-sunken)', color: 'var(--ui-text)', fontSize: '12.5px' }}
              />
            ) : (
              <Editor
                loading={
                  <div className="flex items-center justify-center h-full ui-t-muted ui-mono text-xs">
                    Initialisation de l’éditeur de code…
                  </div>
                }
                height="100%"
                defaultLanguage="python"
                theme={theme === 'light' ? 'light' : 'vs-dark'}
                value={code}
                onMount={() => setMonacoMounted(true)}
                onChange={(val) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: 'JetBrains Mono, monospace',
                  lineHeight: 1.55,
                  padding: { top: 14 },
                  scrollBeyondLastLine: false,
                }}
              />
            )}
          </div>

          <div style={{ background: 'var(--ui-bg-panel)' }}>
            <div
              className="px-3.5 py-2 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--ui-border)', background: 'var(--ui-bg-raised)' }}
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 ui-t-muted" />
                <span className="ui-label">Sortie d’exécution</span>
              </div>
              {output && (
                <span className="ui-tag ui-tag-success">
                  <CheckCircle2 className="w-3 h-3" /> Succès
                </span>
              )}
            </div>
            <div className="p-3.5 max-h-[340px] overflow-y-auto ui-scroll ui-mono text-xs">
              {error && (
                <div
                  className="p-3 rounded-[var(--ui-radius)] ui-t-danger flex items-start gap-2.5"
                  style={{ background: 'var(--ui-danger-soft)', border: '1px solid var(--ui-danger-soft)' }}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <pre className="whitespace-pre-wrap">{error}</pre>
                </div>
              )}
              {output && (
                <div className="space-y-4">
                  <pre
                    className="p-3 rounded-[var(--ui-radius)] ui-t overflow-x-auto"
                    style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
                  >
                    {JSON.stringify(output.result_summary || output, null, 2)}
                  </pre>
                  {output.charts && Array.isArray(output.charts) && output.charts.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {output.charts.map((chart: unknown, i: number) => (
                        <ExtensionChartRenderer key={i} chart={chart} index={i} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!error && !output && (
                <p className="ui-t-faint italic">En attente d’exécution…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
