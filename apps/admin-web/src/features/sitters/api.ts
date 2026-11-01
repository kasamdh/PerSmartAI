import { weekRange } from '@petsitter/shared/week-board';

import { supabase } from '@/lib/supabase/client';

export const sittersPageKeys = {
  invites: ['sitters', 'invites'] as const,
  availability: ['sitters', 'availability'] as const,
  timeOff: ['sitters', 'time-off'] as const,
  payroll: (monday: string) => ['sitters', 'payroll', monday] as const,
};

export async function fetchPendingInvites() {
  const { data, error } = await supabase
    .from('invites')
    .select('id, code, role, email, expires_at, created_at')
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvite(input: { role: 'sitter' | 'owner'; email: string }) {
  // organization_id, code, expiry and created_by are filled in by the database.
  const { data, error } = await supabase
    .from('invites')
    .insert({ role: input.role, email: input.email.trim().toLowerCase() || null })
    .select('id, code, role, email, expires_at, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchAvailability() {
  const { data, error } = await supabase
    .from('sitter_availability')
    .select('id, sitter_id, weekday, start_time, end_time')
    .order('weekday')
    .order('start_time');
  if (error) throw error;
  return data;
}

/** Time off that hasn't ended: requests to decide and approved upcoming days. */
export async function fetchTimeOff(now: Date) {
  const { data, error } = await supabase
    .from('sitter_time_off')
    .select('id, sitter_id, start_at, end_at, reason, status, sitter:profiles ( full_name )')
    .in('status', ['requested', 'approved'])
    .gt('end_at', now.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

export type TimeOff = Awaited<ReturnType<typeof fetchTimeOff>>[number];

export async function decideTimeOff(input: { id: string; approve: boolean }) {
  const { data, error } = await supabase
    .from('sitter_time_off')
    .update({ status: input.approve ? 'approved' : 'declined' })
    .eq('id', input.id)
    .eq('status', 'requested')
    .select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This request was already handled.');
}

/** Visits in the business-local week, with check-in/out times for worked hours. */
export async function fetchPayrollVisits(monday: string, timeZone: string) {
  const { from, to } = weekRange(monday, timeZone);
  const { data, error } = await supabase
    .from('visits')
    .select('sitter_id, status, scheduled_start, scheduled_end, check_in_at, check_out_at')
    .not('sitter_id', 'is', null)
    .gte('scheduled_start', from.toISOString())
    .lt('scheduled_start', to.toISOString());
  if (error) throw error;
  return data;
}
