import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import type { ProblemSummary } from './index';

// Admin schedule changes go through the schedule-booking Edge Function, which runs
// the shared scheduler and conflict checks (see supabase/functions/schedule-booking).

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

type Actions = {
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

export async function scheduleAction<A extends keyof Actions>(
  action: A,
  args: Actions[A]['args'],
): Promise<Actions[A]['result']> {
  const { data, error } = await supabase.functions.invoke('schedule-booking', {
    method: 'POST',
    body: { action, ...args },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
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
  return data as Actions[A]['result'];
}
