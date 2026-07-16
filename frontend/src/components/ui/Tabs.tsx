import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultValue, value: controlled, onChange, children, className = '' }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue);
  const value = controlled ?? internal;
  const setValue = (v: string) => {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
  };
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div role="tablist" className={`flex items-center gap-1 border-b border-white/5 ${className}`}>
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export function Tab({ value, icon, children, disabled = false }: TabProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab must be used inside Tabs');
  const active = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors focus-ring ${
        active ? 'text-accent-300' : 'text-muted hover:text-default'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute bottom-[-1px] left-2 right-2 h-0.5 bg-accent-500 rounded-t" />
      )}
    </button>
  );
}

export function TabPanel({ value, children, className = '' }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('TabPanel must be used inside Tabs');
  if (ctx.value !== value) return null;
  return <div role="tabpanel" className={`pt-3 ${className}`}>{children}</div>;
}
