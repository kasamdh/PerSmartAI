import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Minimal React Hook Form resolver for a Zod object schema. Reports the first
 * issue per top-level field. (Avoids adding @hookform/resolvers for now.)
 */
export function zodResolver<TValues extends FieldValues>(
  schema: z.ZodType<TValues, FieldValues>,
): Resolver<TValues> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !errors[field]) {
        errors[field] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors: errors as FieldErrors<TValues> };
  };
}
