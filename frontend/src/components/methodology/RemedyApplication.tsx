import { useState } from 'react';
import { ChevronDown, Loader2, Save } from 'lucide-react';
import type { Remedy } from './methodologyTypes';

interface Props {
  remedies: Remedy[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onApply: () => void;
  applying: boolean;
  result: string | null;
}

export default function RemedyApplication({
  remedies,
  selected,
  onToggle,
  onApply,
  applying,
  result,
}: Props) {
  const [open, setOpen] = useState(false);
  const count = remedies.filter(r => selected.has(`${r.action}::${r.columns.join(',')}`)).length;

  return (
    <section className="ui-panel overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="ui-panel-header ui-focusable w-full"
        style={{ border: 0, borderBottom: open ? '1px solid var(--ui-border)' : 'none', cursor: 'pointer' }}
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          <ChevronDown
            className="w-3 h-3"
            style={{ transform: open ? undefined : 'rotate(-90deg)', transition: 'transform 0.12s' }}
          />
          Appliquer les corrections au dataset
        </span>
        <span className="ui-num">{count}/{remedies.length}</span>
      </button>

      {open && (
        <div style={{ padding: 'var(--ui-gap-2) var(--ui-pad-x)' }}>
          <p className="ui-t-muted" style={{ fontSize: 'var(--ui-fs-xs)', marginBottom: 8 }}>
            Crée une nouvelle version du dataset (l’originale reste intacte).
          </p>

          <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5" style={{ marginBottom: 10 }}>
            {remedies.map(remedy => {
              const key = `${remedy.action}::${remedy.columns.join(',')}`;
              return (
                <li key={key}>
                  <label
                    className="flex items-start gap-2 rounded-[var(--ui-radius-sm)] px-1.5 py-1"
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => onToggle(key)}
                      style={{ marginTop: 2 }}
                    />
                    <span className="min-w-0">
                      <span style={{ fontSize: 'var(--ui-fs-sm)', fontWeight: 600 }}>{remedy.label}</span>
                      {remedy.aggressive && (
                        <span className="ui-tag ui-tag-warning" style={{ marginLeft: 6 }}>échelle modifiée</span>
                      )}
                      <span className="block ui-t-faint" style={{ fontSize: 'var(--ui-fs-xs)' }}>
                        {remedy.rationale}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-3">
            <button
              onClick={onApply}
              disabled={applying || count === 0}
              className="ui-btn ui-btn-primary ui-focusable"
            >
              {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Appliquer {count} correction{count > 1 ? 's' : ''}
            </button>
            {result && (
              <span className="ui-t-success" style={{ fontSize: 'var(--ui-fs-sm)' }}>{result}</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
