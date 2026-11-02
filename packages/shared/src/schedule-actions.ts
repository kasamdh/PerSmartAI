// Client side of the schedule-booking Edge Function, used by the mobile app and the
// admin web app. Admin schedule changes go through it so the shared scheduler and
// conflict checks run (see supabase/functions/schedule-booking).

import type { ProblemSummary } from './scheduling/index.ts';

/** A change the server refused; `problems` lists each affected visit and why. */
export class SchedulingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problems: ProblemSummary[] = [],
  ) {
    super(message);
    this.name = 'SchedulingError';
  }

  get isConflict() {
    return this.status === 409;
  }
}

/** The function's JSON error body → a SchedulingError. */
export function toSchedulingError(status: number, body: unknown): SchedulingError {
  const data = (typeof body === 'object' && body !== null ? body : {}) as {
    error?: unknown;
    problems?: unknown;
  };
  const message = typeof data.error === 'string' ? data.error : 'Something went wrong';
  const problems = Array.isArray(data.problems) ? (data.problems as ProblemSummary[]) : [];
  return new SchedulingError(message, status, problems);
}

/** Alert text for a failed change: the message, then up to `max` visits with reasons. */
export function schedulingErrorText(error: Error, max = 3): string {
  if (!(error instanceof SchedulingError) || error.problems.length === 0) {
    return error.message || 'Please try again.';
  }
  const lines = error.problems
    .filter((p) => p.blocking)
    .slice(0, max)
    .map((p) => `• ${p.reasons.join('; ')}`);
  const more = error.problems.filter((p) => p.blocking).length - lines.length;
  return [`${error.message}:`, ...lines, ...(more > 0 ? [`…and ${more} more`] : [])].join('\n');
}

export type ScheduleActions = {
  check_sitters: {
    args: { booking_id: string; sitter_ids: string[] };
    result: {
      results: { sitter_id: string; ok: boolean; blocking: number; problems: ProblemSummary[] }[];
    };
  };
  confirm: {
    args: { booking_id: string; sitter_id: string; preview?: boolean };
    result: { created?: number; visits?: number; problems: ProblemSummary[] };
  };
  reschedule: {
    args: {
      booking_id: string;
      from_date: string;
      changes: Record<string, string | number | null>;
      preview?: boolean;
    };
    result: { booking_id?: string; visits?: number; problems: ProblemSummary[] };
  };
  update_visit: {
    args: {
      visit_id: string;
      sitter_id?: string;
      /** Business-local date and time (organizations.timezone). */
      date?: string;
      time?: string;
      duration_minutes?: number;
      preview?: boolean;
    };
    result: { ok: true; problems: ProblemSummary[] };
  };
  decide_request: {
    args: { request_id: string; approve: boolean; decline_reason?: string };
    result: { status: 'approved' | 'declined'; problems?: ProblemSummary[] };
  };
};

/** The part of a Supabase client this needs (mobile and web pass their own). */
export type FunctionsClient = {
  functions: {
    invoke(
      name: string,
      options: { method: 'POST'; body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
};

const isResponse = (value: unknown): value is Response =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Response).status === 'number' &&
  typeof (value as Response).json === 'function';

export async function invokeScheduleAction<A extends keyof ScheduleActions>(
  client: FunctionsClient,
  action: A,
  args: ScheduleActions[A]['args'],
): Promise<ScheduleActions[A]['result']> {
  const { data, error } = await client.functions.invoke('schedule-booking', {
    method: 'POST',
    body: { action, ...args },
  });
  if (error) {
    // FunctionsHttpError carries the response; read the function's JSON error.
    const response = (error as { context?: unknown }).context;
    if (isResponse(response)) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // not JSON
      }
      throw toSchedulingError(response.status, body);
    }
    throw error;
  }
  return data as ScheduleActions[A]['result'];
}
