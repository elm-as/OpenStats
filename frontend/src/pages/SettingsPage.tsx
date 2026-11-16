import { useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, AlertTriangle, Monitor, Sun, Moon,
  Rows3, Rows4, RotateCcw, RefreshCw, Sliders,
} from 'lucide-react';
import { useToast } from '../components/ui/Toast';
import { getApiOrigin, getApiV1Base, getSessionToken } from '../lib/apiBase';

interface HealthPayload {
  status: string;
  version?: string;
  bibliotheques_absentes?: string[];
}

type Theme = 'dark' | 'light';
type Density = 'compact' | 'comfortable';

function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const val = localStorage.getItem(key) as T | null;
    return val && allowed.includes(val) ? val : fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsPage() {
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>(() => readPreference('theme', ['dark', 'light'], 'dark'));
  const [density, setDensity] = useState<Density>(() => readPreference('density', ['compact', 'comfortable'], 'compact'));
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const isElectron = typeof window !== 'undefined' && Boolean((window as unknown as { electronAPI?: { isDesktop?: boolean } }).electronAPI?.isDesktop);

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const origin = getApiOrigin();
      const token = getSessionToken();
      const res = await fetch(`${origin}/health`, {
        headers: token ? { 'X-Session-Token': token } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as HealthPayload;
      setHealth(payload);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Moteur local inaccessible');
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const applyTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* ignoré */ }
    window.dispatchEvent(new CustomEvent('openstats:preferences', { detail: { theme: next } }));
  };

  const applyDensity = (next: Density) => {
    setDensity(next);
    document.documentElement.dataset.density = next;
    try { localStorage.setItem('density', next); } catch { /* ignoré */ }
    window.dispatchEvent(new CustomEvent('openstats:preferences', { detail: { density: next } }));
  };

  const handleResetPreferences = () => {
    try {
      localStorage.removeItem('theme');
      localStorage.removeItem('density');
      localStorage.removeItem('rail');
    } catch { /* ignoré */ }
    applyTheme('dark');
    applyDensity('compact');
    toast.success({ title: 'Préférences réinitialisées', description: 'Thème sombre et densité IDE compacte rétablis.' });
  };

  const missingLibs = health?.bibliotheques_absentes ?? [];

  return (
    <div className="flex flex-col space-y-5 animate-fade-in">
      <header className="ui-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="ui-label">Configuration du Poste</span>
          <h1 className="text-xl md:text-2xl font-bold ui-t mt-0.5">
            Paramètres &amp; Diagnostics Locaux
          </h1>
          <p className="text-xs ui-t-muted mt-0.5">
            Préférences d’affichage de l’espace de travail et état en temps réel du moteur analytique local.
          </p>
        </div>
        <button onClick={fetchHealth} disabled={healthLoading} className="ui-btn ui-focusable shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin' : ''}`} />
          Tester le moteur
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Apparence et ergonomie */}
        <section className="ui-panel p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--ui-border)] pb-2.5">
            <Sliders className="w-4 h-4 ui-t-accent" />
            <h2 className="text-sm font-bold ui-t">Apparence &amp; Densité d’interface</h2>
          </div>

          <div className="space-y-2">
            <span className="ui-label block">Thème visuel</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyTheme('dark')}
                aria-pressed={theme === 'dark'}
                className="ui-btn h-auto py-2.5 px-3 justify-start text-left ui-focusable"
                style={{
                  borderColor: theme === 'dark' ? 'var(--ui-accent)' : 'var(--ui-border)',
                  background: theme === 'dark' ? 'var(--ui-accent-soft)' : 'var(--ui-bg-raised)',
                  color: theme === 'dark' ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                }}
              >
                <Moon className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Sombre Minéral</div>
                  <div className="text-[10.5px] ui-t-muted">Optimal pour longues sessions</div>
                </div>
              </button>

              <button
                onClick={() => applyTheme('light')}
                aria-pressed={theme === 'light'}
                className="ui-btn h-auto py-2.5 px-3 justify-start text-left ui-focusable"
                style={{
                  borderColor: theme === 'light' ? 'var(--ui-accent)' : 'var(--ui-border)',
                  background: theme === 'light' ? 'var(--ui-accent-soft)' : 'var(--ui-bg-raised)',
                  color: theme === 'light' ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                }}
              >
                <Sun className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Clair Papier</div>
                  <div className="text-[10.5px] ui-t-muted">Lecture haute luminosité</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="ui-label block">Densité des tableaux et panneaux</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => applyDensity('compact')}
                aria-pressed={density === 'compact'}
                className="ui-btn h-auto py-2.5 px-3 justify-start text-left ui-focusable"
                style={{
                  borderColor: density === 'compact' ? 'var(--ui-accent)' : 'var(--ui-border)',
                  background: density === 'compact' ? 'var(--ui-accent-soft)' : 'var(--ui-bg-raised)',
                  color: density === 'compact' ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                }}
              >
                <Rows4 className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Compact (Studio IDE)</div>
                  <div className="text-[10.5px] ui-t-muted">Hauteur de ligne 30 px</div>
                </div>
              </button>

              <button
                onClick={() => applyDensity('comfortable')}
                aria-pressed={density === 'comfortable'}
                className="ui-btn h-auto py-2.5 px-3 justify-start text-left ui-focusable"
                style={{
                  borderColor: density === 'comfortable' ? 'var(--ui-accent)' : 'var(--ui-border)',
                  background: density === 'comfortable' ? 'var(--ui-accent-soft)' : 'var(--ui-bg-raised)',
                  color: density === 'comfortable' ? 'var(--ui-accent-text)' : 'var(--ui-text-secondary)',
                }}
              >
                <Rows3 className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold">Confortable</div>
                  <div className="text-[10.5px] ui-t-muted">Hauteur de ligne 36 px</div>
                </div>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--ui-border)] flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold ui-t">Préférences locales</div>
              <div className="text-[11px] ui-t-muted">Stockées localement sans compte utilisateur.</div>
            </div>
            <button onClick={handleResetPreferences} className="ui-btn ui-focusable">
              <RotateCcw className="w-3.5 h-3.5" />
              Réinitialiser
            </button>
          </div>
        </section>

        {/* Diagnostics Moteur Local */}
        <section className="ui-panel p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--ui-border)] pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 ui-t-success" />
              <h2 className="text-sm font-bold ui-t">Moteur Analytique &amp; Environnement</h2>
            </div>
            {health && !healthError ? (
              <span className="ui-tag ui-tag-success">
                <CheckCircle2 className="w-3 h-3" /> Opérationnel
              </span>
            ) : (
              <span className="ui-tag ui-tag-danger">
                <AlertTriangle className="w-3 h-3" /> Hors ligne
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs">
            <DiagRow label="Mode d’exécution" value={isElectron ? 'Desktop Electron (autonome)' : 'Application Web locale'} icon={Monitor} />
            <DiagRow label="API Backend" value={health?.version ? `OpenStats v${health.version}` : healthError ?? 'Vérification…'} mono />
            <DiagRow label="Endpoint actif" value={getApiV1Base()} mono />
          </div>

          <div className="pt-2 border-t border-[var(--ui-border)] space-y-2">
            <span className="ui-label block">Dépendances scientifiques optionnelles</span>
            {healthError ? (
              <p className="text-xs ui-t-danger">Impossible de contacter le backend local : {healthError}</p>
            ) : missingLibs.length === 0 ? (
              <p className="text-xs ui-t-success font-medium">
                Toutes les librairies scientifiques avancées (XGBoost, LightGBM, SHAP, Statsmodels, DuckDB) sont disponibles.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {missingLibs.map((lib) => (
                  <span key={lib} className="ui-tag ui-tag-warning ui-mono">{lib}</span>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function DiagRow({ label, value, mono = false, icon: Icon }: {
  label: string; value: string; mono?: boolean; icon?: typeof Monitor;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-[var(--ui-radius-sm)]"
      style={{ background: 'var(--ui-bg-sunken)', border: '1px solid var(--ui-border)' }}
    >
      <span className="ui-t-muted flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 ui-t-faint" />}
        {label}
      </span>
      <span className={`${mono ? 'ui-mono' : 'font-medium'} ui-t ui-num text-right truncate max-w-[60%]`} title={value}>
        {value}
      </span>
    </div>
  );
}
