import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition ' +
  'duration-150 ease-out select-none disabled:cursor-not-allowed disabled:opacity-55 ' +
  'active:translate-y-px';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_1px_2px_rgb(16_18_21/0.12)] hover:bg-accent-hover ' +
    'hover:shadow-[0_4px_14px_-4px_rgb(47_95_224/0.45)] disabled:hover:bg-accent',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-surface-muted hover:border-line-strong',
  ghost: 'text-ink-soft hover:bg-surface-muted hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-[0.9375rem]',
  lg: 'h-14 px-6 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

function classes({ variant = 'primary', size = 'md', fullWidth, className = '' }: CommonProps) {
  return [BASE, VARIANTS[variant], SIZES[size], fullWidth ? 'w-full' : '', className]
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<'button'>) {
  return (
    <button className={classes({ variant, size, fullWidth, className, children })} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>) {
  return (
    <Link
      href={href}
      className={classes({ variant, size, fullWidth, className, children })}
      {...rest}
    >
      {children}
    </Link>
  );
}
