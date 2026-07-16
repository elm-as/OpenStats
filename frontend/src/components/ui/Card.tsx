import type { ReactNode, HTMLAttributes } from 'react';

type CardVariant = 'default' | 'flat' | 'raised' | 'interactive';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  noPadding?: boolean;
  children?: ReactNode;
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  default: 'card',
  flat: 'card-flat',
  raised: 'card-raised',
  interactive: 'card-interactive',
};

export function Card({ variant = 'default', noPadding = false, className = '', children, ...rest }: CardProps) {
  return (
    <div className={`${VARIANT_CLASS[variant]} ${noPadding ? '!p-0' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-base font-semibold text-strong ${className}`} {...rest}>
      {children}
    </h3>
  );
}

export function CardSubtitle({ className = '', children, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-xs text-muted mt-0.5 ${className}`} {...rest}>
      {children}
    </p>
  );
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-3 ${className}`} {...rest}>{children}</div>;
}

export function CardFooter({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2 ${className}`} {...rest}>
      {children}
    </div>
  );
}
