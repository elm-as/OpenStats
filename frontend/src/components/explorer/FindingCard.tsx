import { useState } from 'react';
import {
  ChevronRight, ShieldCheck, ShieldAlert, Info, TrendingUp, GitBranch,
  Layers, Activity, AlertTriangle, Gauge, Waves, Sigma, Split, Copy, Check,
} from 'lucide-react';
import { factLabel, type Finding } from './explorerTypes';

const KIND_ICONS: Record<string, typeof TrendingUp> = {
  association_lineaire: TrendingUp,
  association_non_lineaire: Waves,
  redondance: Layers,
  difference_groupes: Split,
  lien_categoriel: GitBranch,
  asymetrie: Activity,
  non_normalite: Activity,
  valeurs_extremes: AlertTriangle,
  desequilibre_classes: Gauge,
  interaction: GitBranch,
  relation_conditionnelle: Split,
  non_stationnarite: Waves,
  tendance: TrendingUp,
  causalite_granger: GitBranch,
  pouvoir_predictif: Sigma,
  pouvoir_predictif_nul: Info,
  variable_dominante: Gauge,
  heteroscedasticite: Waves,
  multicolinearite: Layers,
  axes_de_variance: Layers,
  doublons: Copy,
  lacunes: AlertTriangle,
  colonnes_constantes: Info,
};

const EFFECT_TONE: Record<string, { tag: string; bar: string }> = {
  fort: { tag: 'ui-tag-success', bar: 'var(--ui-success)' },
  modéré: { tag: 'ui-tag-accent', bar: 'var(--ui-accent)' },
  faible: { tag: 'ui-tag-warning', bar: 'var(--ui-warning)' },
  négligeable: { tag: 'ui-tag-neutral', bar: 'var(--ui-text-faint)' },
};

function fdrTag(finding: Finding) {
  if (finding.survives_fdr === null) {
    return {
      cls: 'ui-tag-neutral', Icon: Info, text: 'descriptif',
      title: 'Mesure descriptive : pas de test d’hypothèse, donc pas de correction applicable.',
    };
  }
  if (finding.survives_fdr) {
    return {
      cls: 'ui-tag-success', Icon: ShieldCheck, text: 'confirmé',
      title: `Survit à la correction de Benjamini-Hochberg (q = ${finding.q_value})`,
    };
  }
  return {
    cls: 'ui-tag-warning', Icon: ShieldAlert, text: 'non confirmé',
    title: `Ne survit pas à la correction pour tests multiples (q = ${finding.q_value})`,
  };
}

const formatP = (p: number) => (p < 0.001 ? p.toExponential(1) : p.toFixed(3));

export default function FindingCard({ finding, rank }: { finding: Finding; rank: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const tone = EFFECT_TONE[finding.effect_label] ?? EFFECT_TONE['négligeable'];
  const Icon = KIND_ICONS[finding.kind] ?? Sigma;
  const fdr = fdrTag(finding);

  const copySummary = async (event: React.MouseEvent) => {
    event.stopPropagation();
    const lines = [
      finding.headline,
      finding.detail,
      `${finding.effect_metric} = ${finding.effect_size.toFixed(4)} · n = ${finding.n}`
        + (finding.p_value !== null ? ` · p = ${formatP(finding.p_value)}` : '')
        + (finding.q_value !== null ? ` · q = ${finding.q_value}` : ''),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible */
    }
  };

  return (
    <article
      className="ui-panel overflow-hidden"
      style={{ opacity: finding.survives_fdr === false ? 0.72 : 1 }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="ui-focusable w-full flex items-center gap-2 text-left"
        style={{ padding: '6px var(--ui-pad-x)', minHeight: 38 }}
        aria-expanded={open}
      >
        <ChevronRight
          className="w-3 h-3 shrink-0"
          style={{
            color: 'var(--ui-text-faint)',
            transform: open ? 'rotate(90deg)' : undefined,
            transition: 'transform 0.12s',
          }}
        />
        <span className="ui-num shrink-0 ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)', width: 18 }}>
          {rank}
        </span>
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ui-accent)' }} />

        <span
          className="flex-1 min-w-0 truncate"
          style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600, color: 'var(--ui-text)' }}
          title={finding.headline}
        >
          {finding.headline}
        </span>

        <span className="ui-num shrink-0 ui-t-muted hidden md:inline" style={{ fontSize: 'var(--ui-fs-xs)' }}>
          n={finding.n}
          {finding.p_value !== null && <> · p={formatP(finding.p_value)}</>}
        </span>

        <span className={`ui-tag ${tone.tag} shrink-0`}>{finding.effect_label}</span>
        <span className={`ui-tag ${fdr.cls} shrink-0`} title={fdr.title}>
          <fdr.Icon className="w-2.5 h-2.5" />
          <span className="hidden lg:inline">{fdr.text}</span>
        </span>
      </button>

      {/* Barre d'intensité : poids relatif lisible sans lire les chiffres. */}
      <div style={{ height: 2, background: 'var(--ui-bg-raised)' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.round(finding.magnitude * 100)}%`,
            background: tone.bar,
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {open && (
        <div style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x) var(--ui-gap-3) 30px' }}>
          <p className="ui-t-secondary" style={{ fontSize: 'var(--ui-fs-sm)', lineHeight: 1.65 }}>
            {finding.detail}
          </p>

          <dl
            className="grid mt-2.5"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 'var(--ui-gap-2)' }}
          >
            <Metric label={finding.effect_metric} value={finding.effect_size.toFixed(4)} />
            <Metric label="observations" value={finding.n.toLocaleString('fr-FR')} />
            {finding.p_value !== null && <Metric label="p-value" value={formatP(finding.p_value)} />}
            {finding.q_value !== null && <Metric label="q-value (FDR)" value={String(finding.q_value)} />}
          </dl>

          <div className="flex items-center flex-wrap gap-1.5 mt-2.5">
            {finding.variables.map(v => (
              <span key={v} className="ui-tag ui-tag-neutral ui-mono">{v}</span>
            ))}
          </div>

          {finding.establishes.length > 0 && (
            <p className="ui-t-faint mt-2.5" style={{ fontSize: 'var(--ui-fs-xs)' }}>
              Ouvre la piste : <span className="ui-t-muted">{finding.establishes.map(factLabel).join(', ')}</span>
            </p>
          )}

          <button onClick={copySummary} className="ui-btn ui-btn-ghost ui-focusable mt-2.5">
            {copied ? <Check className="w-3 h-3" style={{ color: 'var(--ui-success)' }} /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copié' : 'Copier le résultat'}
          </button>
        </div>
      )}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ui-label" style={{ fontSize: '9.5px' }}>{label}</dt>
      <dd className="ui-num" style={{ fontSize: 'var(--ui-fs-md)', fontWeight: 700, color: 'var(--ui-text)' }}>
        {value}
      </dd>
    </div>
  );
}
