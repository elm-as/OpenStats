import React, { ChangeEvent, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function NodeLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-surface-400 text-[11px] font-semibold uppercase tracking-wider mb-1">
      {children}
    </label>
  );
}

export function NodeSelect({
  name,
  value,
  onChange,
  children,
}: {
  name: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors appearance-none cursor-pointer"
    >
      {children}
    </select>
  );
}

export function NodeInput({
  name,
  placeholder,
  value,
  onChange,
}: {
  name: string;
  placeholder: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type="text"
      name={name}
      placeholder={placeholder}
      defaultValue={value}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
    />
  );
}

export function NodeColumnSelect({
  name,
  value,
  onChange,
  columns,
  columnTypes,
  placeholder = '-- Sélectionner --',
}: {
  name: string;
  value?: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  columns: string[];
  columnTypes?: Record<string, string>;
  placeholder?: string;
}) {
  const formatLabel = (col: string) => {
    const type = columnTypes?.[col];
    return type && type !== '?' ? `${col} (${type})` : col;
  };
  if (columns.length === 0) {
    return (
      <NodeInput
        name={name}
        value={value}
        onChange={onChange as any}
        placeholder={placeholder}
      />
    );
  }
  return (
    <select
      name={name}
      value={value || ''}
      onChange={onChange}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors appearance-none cursor-pointer"
    >
      <option value="">{placeholder}</option>
      {columns.map(c => (
        <option key={c} value={c}>
          {formatLabel(c)}
        </option>
      ))}
    </select>
  );
}

export function NodeMultiColumnInput({
  name,
  value,
  onChange,
  columns,
  placeholder,
}: {
  name: string;
  value?: string | string[];
  onChange: (e: any) => void;
  columns: string[];
  placeholder?: string;
}) {
  const currentValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const toggleColumn = (col: string) => {
    let newValues;
    if (currentValues.includes(col)) {
      newValues = currentValues.filter(c => c !== col);
    } else {
      newValues = [...currentValues, col];
    }
    onChange({ target: { name, value: newValues.join(', ') } });
  };

  const displayValue = Array.isArray(value) ? value.join(', ') : value || '';

  return (
    <div className="space-y-2">
      <input
        type="text"
        name={name}
        placeholder={placeholder}
        value={displayValue}
        onChange={onChange}
        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors"
      />
      {columns.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-y-auto custom-scrollbar p-1">
          {columns.map(col => (
            <button
              key={col}
              type="button"
              onClick={() => toggleColumn(col)}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                currentValues.includes(col)
                  ? 'bg-accent-500/20 border-accent-500/40 text-accent-300'
                  : 'bg-white/5 border-white/10 text-surface-400 hover:bg-white/10 hover:text-surface-200'
              }`}
            >
              {col}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodeNumberInput({
  name,
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 1,
}: {
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
      name={name}
      placeholder={placeholder}
      defaultValue={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/[0.08] text-surface-100 text-[12px] font-medium placeholder:text-surface-600 focus:outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

export function NodeToggle({
  value,
  onChange,
}: {
  value?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const isAdvanced = value === 'advanced';
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={isAdvanced}
          onChange={e =>
            onChange({
              target: { name: 'mode', value: e.target.checked ? 'advanced' : 'auto' },
            } as any)
          }
        />
        <div
          className={`w-8 h-4 rounded-full transition-colors ${
            isAdvanced ? 'bg-accent-500/60' : 'bg-white/10'
          }`}
        >
          <div
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
              isAdvanced ? 'translate-x-[18px]' : 'translate-x-0.5'
            }`}
          />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
        {isAdvanced ? 'Avancé' : 'Auto'}
      </span>
    </label>
  );
}

export function NodeCollapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/[0.06] pt-2 mt-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 text-[10px] font-semibold text-surface-500 uppercase tracking-wider hover:text-surface-300 transition-colors py-1"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  );
}

export function NodeSeedInput({
  value,
  onChange,
}: {
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
          value={value}
          onChange={onChange}
          min={0}
          max={99999}
        />
        {!value && <span className="text-[9px] text-surface-600 shrink-0">aléatoire</span>}
        {value && <span className="text-[9px] text-accent-400 shrink-0">fixe</span>}
      </div>
    </div>
  );
}
