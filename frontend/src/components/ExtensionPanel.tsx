import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  useSaveExtensionMutation, 
  useListExtensionsQuery, 
  useListExtensionTemplatesQuery,
  useRunExtensionMutation,
  useRunExtensionCodeMutation
} from '../store/api';
import { 
  Play, 
  Save, 
  Sparkles, 
  Code2, 
  History, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  Loader2,
  Trash2,
  BookOpen,
  Layout as LayoutIcon
} from 'lucide-react';

import Plot from 'react-plotly.js';
import { DARK_TEMPLATE, DEFAULT_CONFIG, SCI_COLORS } from './viz/PlotlyBase';
import type { Data, Layout } from 'plotly.js';
import { useToast } from './ui/Toast';
import { extractErrorMessage } from './ui/errorMessage';

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

  const [code, setCode] = useState('# Écrivez votre script ici\n\ndef analyze_custom(df, params):\n    # Votre logique ici\n    return {\n        "status": "success",\n        "result_summary": {"message": "Hello World"}\n    }');
  const [name, setName] = useState('Nouvelle Analyse');
  const [description, setDescription] = useState('');
  const [output, setOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Placeholder for actual AI generation logic
    setTimeout(() => setIsGenerating(false), 2000);
  };

  const handleSave = async () => {
    try {
      setError(null);
      await saveExtension({ name, code, description }).unwrap();
      refetchExtensions();
      toast.success({ title: 'Extension sauvegardée', description: name });
    } catch (err: any) {
      const msg = err?.data?.error || extractErrorMessage(err, 'Échec de la sauvegarde');
      setError(msg);
      toast.error({ title: 'Sauvegarde échouée', description: msg });
    }
  };

  const handleRun = async (scriptId?: string) => {
    try {
      setError(null);
      setOutput(null);
      
      let res;
      if (scriptId) {
        res = await runExtension({ script_id: scriptId, dataset_id: datasetId }).unwrap();
      } else {
        res = await runExtensionCode({ code, dataset_id: datasetId }).unwrap();
      }
      setOutput(res);
    } catch (err: any) {
      setError(err?.data?.error || "Échec de l'exécution");
    }
  };

  const applyTemplate = (tpl: { name: string; description: string; code: string }) => {
    setName(tpl.name);
    setDescription(tpl.description);
    setCode(tpl.code);
    setOutput(null);
    setError(null);
  };

  const renderChart = (chart: any, index: number) => {
    const xKey = chart.x_key || 'name';
    const yKey = chart.y_key || 'value';
    const data = chart.data || [];
    const seriesKeys = Object.keys(data[0] || {}).filter(k => k !== xKey);
    const traces: Data[] = [];
    let layout: Partial<Layout> = { ...DARK_TEMPLATE, autosize: true, margin: { l: 50, r: 20, t: 10, b: 60 } };

    if (chart.type === 'line') {
      seriesKeys.forEach((key, i) => {
        traces.push({
          x: data.map((d: any) => d[xKey]),
          y: data.map((d: any) => d[key]),
          type: 'scatter', mode: 'lines+markers',
          name: key,
          line: { color: SCI_COLORS[i % SCI_COLORS.length], width: 2 },
          marker: { size: 4 },
          hovertemplate: '<b>%{x}</b><br>' + key + ': %{y}<extra></extra>',
        } as Data);
      });
    } else if (chart.type === 'bar') {
      seriesKeys.forEach((key, i) => {
        traces.push({
          x: data.map((d: any) => d[xKey]),
          y: data.map((d: any) => d[key]),
          type: 'bar',
          name: key,
          marker: { color: SCI_COLORS[i % SCI_COLORS.length] },
          hovertemplate: '<b>%{x}</b><br>' + key + ': %{y}<extra></extra>',
        } as Data);
      });
    } else if (chart.type === 'pie') {
      traces.push({
        labels: data.map((d: any) => d[xKey]),
        values: data.map((d: any) => d[yKey]),
        type: 'pie', hole: 0.3,
        marker: { colors: data.map((_: any, i: number) => SCI_COLORS[i % SCI_COLORS.length]) },
        textinfo: 'label+percent',
        hovertemplate: '<b>%{label}</b><br>%{value} (%{percent})<extra></extra>',
      } as Data);
      layout = { ...DARK_TEMPLATE, autosize: true, margin: { l: 20, r: 20, t: 10, b: 20 } };
    } else if (chart.type === 'scatter') {
      traces.push({
        x: data.map((d: any) => d[xKey]),
        y: data.map((d: any) => d[yKey]),
        type: 'scatter', mode: 'markers',
        name: chart.title || 'points',
        marker: { size: 6, color: SCI_COLORS[0], opacity: 0.7, line: { color: 'rgba(255,255,255,0.15)', width: 0.5 } },
        hovertemplate: `<b>${xKey}: %{x}</b><br>${yKey}: %{y}<extra></extra>`,
      } as Data);
    } else if (chart.type === 'area') {
      seriesKeys.forEach((key, i) => {
        const color = SCI_COLORS[i % SCI_COLORS.length];
        traces.push({
          x: data.map((d: any) => d[xKey]),
          y: data.map((d: any) => d[key]),
          type: 'scatter', mode: 'lines',
          name: key,
          fill: 'tozeroy',
          line: { color, width: 1.5 },
          fillcolor: `${color}40`,
        } as Data);
      });
    }

    if (chart.type !== 'pie') {
      layout.xaxis = { ...DARK_TEMPLATE.xaxis, title: { text: xKey, font: { color: '#dfe3ee' } } };
      layout.yaxis = { ...DARK_TEMPLATE.yaxis };
    }
    layout.legend = { orientation: 'h', y: -0.2, font: { color: '#dfe3ee' } };

    return (
      <div key={index} className="card bg-white/5 border-white/10 p-4 space-y-4">
        <h4 className="text-sm font-bold text-surface-200 flex items-center gap-2">
          <LayoutIcon className="w-4 h-4 text-accent-400" />
          {chart.title || `Graphique ${index + 1}`}
        </h4>
        <Plot data={traces} layout={layout} config={DEFAULT_CONFIG} style={{ width: '100%', height: 300 }} useResizeHandler />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      {/* Sidebar: Templates, AI, Library */}
      <div className="lg:col-span-4 space-y-6 overflow-y-auto max-h-[800px] pr-2 custom-scrollbar">
        
        {/* Template Library */}
        <div className="card border-primary-500/20 bg-primary-500/5">
          <div className="p-4 border-b border-primary-500/10 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-400" />
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Bibliothèque de Modèles</h3>
          </div>
          <div className="p-2 space-y-2">
            {templates?.map((tpl, i) => (
              <button
                key={i}
                onClick={() => applyTemplate(tpl)}
                className="w-full text-left p-3 rounded-xl hover:bg-primary-500/10 border border-transparent hover:border-primary-500/20 transition-all group"
              >
                <p className="text-xs font-bold text-white group-hover:text-primary-300 transition-colors">{tpl.name}</p>
                <p className="text-[10px] text-surface-500 mt-1 line-clamp-2">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* AI Assistant Card */}
        <div className="card overflow-hidden border-accent-500/20 bg-accent-500/5">
          <div className="p-4 border-b border-accent-500/10 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-400" />
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Générateur DeepSeek</h3>
          </div>
          <div className="p-4 space-y-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Décrivez l'analyse souhaitée en français..."
              className="w-full bg-surface-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-surface-600 focus:ring-2 focus:ring-accent-500/50 transition-all"
              rows={4}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className="btn-primary w-full py-3 text-xs"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Générer avec l'IA
            </button>
          </div>
        </div>

        {/* Saved Scripts */}
        <div className="card">
          <div className="p-4 border-b border-white/5 flex items-center gap-2">
            <History className="w-5 h-5 text-surface-400" />
            <h3 className="font-black text-white text-sm uppercase tracking-widest">Mes Sauvegardes</h3>
          </div>
          <div className="p-2 space-y-1">
            {extensions?.map((ext) => (
              <div key={ext.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                <button
                  onClick={() => {
                    setName(ext.name);
                    setCode(ext.code);
                    setDescription(ext.description);
                  }}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-bold text-white truncate">{ext.name}</p>
                  <p className="text-[10px] text-surface-500 truncate">{ext.description || 'Script sauvegardé'}</p>
                </button>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleRun(ext.id)}
                    className="p-1.5 rounded-lg bg-accent-500/10 text-accent-400 hover:bg-accent-500/20"
                    title="Exécuter"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Editor & Output area */}
      <div className="lg:col-span-8 space-y-6">
        <div className="card p-0 flex flex-col min-h-[700px]">
          {/* Editor Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex-1 space-y-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-transparent border-none p-0 text-xl font-black text-white focus:ring-0 placeholder:text-surface-700 w-full"
                placeholder="Nom du script"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              loading={<div className="flex items-center justify-center h-full text-surface-500 font-mono text-sm animate-pulse">Initialisation de l'éditeur de code...</div>}
              height="100%"
              defaultLanguage="python"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
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
                <span className="text-[10px] font-black text-surface-500 uppercase tracking-widest">Résultats de l'exécution</span>
              </div>
              {output && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Succès</span>}
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
                      {output.charts.map((chart: any, i: number) => renderChart(chart, i))}
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
