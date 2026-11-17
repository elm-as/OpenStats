import React, { ChangeEvent, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CONTROL_STYLE: React.CSSProperties = {
  background: 'var(--ui-bg-sunken)',
  borderColor: 'var(--ui-border)',
  color: 'var(--ui-text)',
};

export function NodeLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="ui-label block mb-1" style={{ color: 'var(--ui-text-muted)' }}>
      {children}
    </label>
  );
}

export function NodeSelect(props: {
  name: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      name={props.name}
      defaultValue={props.value}
      onChange={props.onChange}
      className="ui-select w-full text-[12px]"
      style={CONTROL_STYLE}
    >
      {props.children}
    </select>
  );
}

export function NodeInput(props: {
  name: string;
  placeholder: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      name={props.name}
      placeholder={props.placeholder}
      defaultValue={props.value}
      onChange={props.onChange}
      className="ui-input w-full text-[12px]"
      style={CONTROL_STYLE}
    />
  );
}

export function NodeColumnSelect(props: {
  name: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  columns: string[];
  columnTypes?: Record<string, string>;
  placeholder?: string;
}) {
  const placeholder = props.placeholder ?? '-- Sélectionner --';
  const formatLabel = (col: string) => {
    const type = props.columnTypes?.[col];
    return type && type !== '?' ? `${col} (${type})` : col;
  };
  if (props.columns.length === 0) {
    return (
      <NodeInput
        name={props.name}
        value={props.value}
        onChange={props.onChange as any}
        placeholder={placeholder}
      />
    );
  }
  return (
    <select
      name={props.name}
      value={props.value || ''}
      onChange={props.onChange}
      className="ui-select w-full text-[12px]"
      style={CONTROL_STYLE}
    >
      <option value="">{placeholder}</option>
      {props.columns.map(c => (
        <option key={c} value={c}>
          {formatLabel(c)}
        </option>
      ))}
    </select>
  );
}

export function NodeMultiColumnInput(props: {
  name: string;
  value?: string | string[];
  onChange: (e: any) => void;
  columns: string[];
  placeholder?: string;
}) {
  const currentValues = Array.isArray(props.value)
    ? props.value
    : typeof props.value === 'string'
      ? props.value.split(',').map(s => s.trim()).filter(Boolean)
      : [];

  const toggleColumn = (col: string) => {
    const next = currentValues.includes(col)
      ? currentValues.filter(c => c !== col)
      : [...currentValues, col];
    props.onChange({ target: { name: props.name, value: next.join(', ') } });
  };

  const displayValue = Array.isArray(props.value) ? props.value.join(', ') : props.value || '';

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        name={props.name}
        placeholder={props.placeholder}
        value={displayValue}
        onChange={props.onChange}
        className="ui-input w-full text-[12px]"
        style={CONTROL_STYLE}
      />
      {props.columns.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto ui-scroll p-0.5">
          {props.columns.map(col => {
            const active = currentValues.includes(col);
            return (
              <button
                key={col}
                type="button"
                onClick={() => toggleColumn(col)}
                className={`ui-tag text-[10px] transition-colors ${active ? 'ui-tag-accent' : ''}`}
                style={active ? undefined : { cursor: 'pointer' }}
              >
                {col}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NodeNumberInput(props: {
  name: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      name={props.name}
      placeholder={props.placeholder}
      defaultValue={props.value}
      onChange={props.onChange}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      className="ui-input ui-num w-full text-[12px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      style={CONTROL_STYLE}
    />
  );
}

export function NodeToggle(props: {
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const isAdvanced = props.value === 'advanced';
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={isAdvanced}
          onChange={e =>
            props.onChange({
              target: { name: 'mode', value: e.target.checked ? 'advanced' : 'auto' },
            } as any)
          }
        />
        <div
          className="w-8 h-4 rounded-full transition-colors"
          style={{ background: isAdvanced ? 'var(--ui-accent)' : 'var(--ui-border-strong)' }}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
              isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ui-text-secondary)' }}>
        {isAdvanced ? 'Avancé' : 'Auto'}
      </span>
    </label>
  );
}

export function NodeCollapsible(props: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--ui-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider py-1 transition-colors"
        style={{ color: 'var(--ui-text-muted)' }}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {props.title}
      </button>
      {open && <div className="space-y-2.5 mt-1.5">{props.children}</div>}
    </div>
  );
}

export function NodeSeedInput(props: {
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <NodeLabel>Seed (reproductibilité)</NodeLabel>
      <div className="flex items-center gap-2">
        <NodeNumberInput
          name="seed"
          placeholder="Aléatoire"
          value={props.value}
          onChange={props.onChange}
          min={0}
          max={99999}
        />
        <span
          className="text-[10px] shrink-0 ui-num"
          style={{ color: props.value ? 'var(--ui-accent-text)' : 'var(--ui-text-faint)' }}
        >
          {props.value ? 'fixe' : 'aléatoire'}
        </span>
      </div>
    </div>
  );
}
