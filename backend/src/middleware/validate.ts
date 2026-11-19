import type { ZodError, ZodTypeAny, output } from 'zod';
import { ApiError } from '../utils/api-error.js';

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Parses untrusted input with a shared zod schema, returning typed data or throwing a 400. */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): output<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw ApiError.badRequest('Please correct the highlighted fields', zodFieldErrors(result.error));
  return result.data;
}
