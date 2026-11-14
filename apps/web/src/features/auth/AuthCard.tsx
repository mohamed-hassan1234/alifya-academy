import type { ReactNode } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { normalizeError, type NormalizedError } from '@/lib/api';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="bg-ivory">
      <div className="container flex min-h-[calc(100dvh-4.5rem)] items-start justify-center py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-md">
          <div className="rounded-lg border border-border bg-background p-6 shadow-card sm:p-9">
            <h1 className="text-[2rem]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </section>
  );
}

/** Maps API field errors onto react-hook-form fields; returns the normalized error for a banner. */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
): NormalizedError {
  const e = normalizeError(err);
  for (const [field, message] of Object.entries(e.fields))
    setError(field as Path<T>, { type: 'server', message });
  return e;
}
