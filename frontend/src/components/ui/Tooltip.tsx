import { useState, type ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

interface HelpTipProps {
  content: ReactNode;
  label?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const SIDE: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
  left: 'right-full mr-2 top-1/2 -translate-y-1/2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2',
};

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`absolute z-50 w-max max-w-xs whitespace-normal px-2.5 py-1.5 text-left leading-snug rounded-[var(--ui-radius-sm)] pointer-events-none ${SIDE[side]}`}
          style={{
            background: 'var(--ui-bg-overlay)',
            border: '1px solid var(--ui-border-strong)',
            color: 'var(--ui-text)',
            fontSize: 'var(--ui-fs-xs)',
            boxShadow: 'var(--ui-shadow-md)',
          }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export function HelpTip({ content, label = 'Aide statistique', side = 'top' }: HelpTipProps) {
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        aria-label={label}
        className="ui-focusable inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none cursor-help shrink-0"
        style={{
          background: 'var(--ui-bg-raised)',
          border: '1px solid var(--ui-border-strong)',
          color: 'var(--ui-text-muted)',
        }}
      >
        ?
      </button>
    </Tooltip>
  );
}
