import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Small shared building blocks. Primary actions use the business's brand color.

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:opacity-90',
  secondary: 'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-brand-ink hover:bg-gray-100',
};

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export const inputClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30';

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-800">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-gray-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

export function Card({
  title,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const tones = {
  gray: 'bg-gray-100 text-gray-800',
  blue: 'bg-blue-100 text-blue-900',
  green: 'bg-green-100 text-green-900',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-red-100 text-red-900',
} as const;

export function Badge({
  tone = 'gray',
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

/** Loading / error / empty states for a query. */
export function QueryState({
  isPending,
  error,
  onRetry,
}: {
  isPending: boolean;
  error: Error | null;
  onRetry?: () => void;
}) {
  if (isPending) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error)
    return (
      <div role="alert" className="text-sm text-red-700">
        {error.message || 'Couldn’t load this.'}{' '}
        {onRetry ? (
          <button type="button" className="underline" onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    );
  return null;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-gray-500">{children}</p>;
}
