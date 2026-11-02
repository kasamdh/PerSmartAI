import { invokeScheduleAction, type ScheduleActions } from '@petsitter/shared/schedule-actions';

import { supabase } from '@/lib/supabase';

// Admin schedule changes go through the schedule-booking Edge Function (client in
// packages/shared, shared with the admin web app).
export {
  SchedulingError,
  schedulingErrorText,
  toSchedulingError,
} from '@petsitter/shared/schedule-actions';

export function scheduleAction<A extends keyof ScheduleActions>(
  action: A,
  args: ScheduleActions[A]['args'],
): Promise<ScheduleActions[A]['result']> {
  return invokeScheduleAction(supabase, action, args);
}
