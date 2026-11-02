import { supabase } from '@/lib/supabase';

// RLS ("sitters manage own availability / time off") limits every query to the
// signed-in sitter's rows; guard_time_off_write keeps new time off as a request.

export async function fetchAvailability(sitterId: string) {
  const { data, error } = await supabase
    .from('sitter_availability')
    .select('id, weekday, start_time, end_time')
    .eq('sitter_id', sitterId)
    .order('weekday')
    .order('start_time');
  if (error) throw error;
  return data;
}

export async function addAvailability(input: {
  sitterId: string;
  weekday: number;
  start_time: string;
  end_time: string;
}) {
  const { error } = await supabase.from('sitter_availability').insert({
    sitter_id: input.sitterId,
    weekday: input.weekday,
    start_time: input.start_time,
    end_time: input.end_time,
  });
  if (error) throw error;
}

export async function removeAvailability(id: string) {
  const { error } = await supabase.from('sitter_availability').delete().eq('id', id);
  if (error) throw error;
}

/** Time off that hasn't ended yet, soonest first. */
export async function fetchTimeOff(sitterId: string, now: Date) {
  const { data, error } = await supabase
    .from('sitter_time_off')
    .select('id, start_at, end_at, reason, status')
    .eq('sitter_id', sitterId)
    .gt('end_at', now.toISOString())
    .order('start_at');
  if (error) throw error;
  return data;
}

export type TimeOffRow = Awaited<ReturnType<typeof fetchTimeOff>>[number];

export async function requestTimeOff(input: {
  sitterId: string;
  start_at: string;
  end_at: string;
  reason: string;
}) {
  const { error } = await supabase.from('sitter_time_off').insert({
    sitter_id: input.sitterId,
    start_at: input.start_at,
    end_at: input.end_at,
    reason: input.reason.trim() || null,
  });
  if (error) throw error;
}

export async function withdrawTimeOff(id: string) {
  const { data, error } = await supabase.from('sitter_time_off').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length !== 1) throw new Error('This time off can no longer be withdrawn.');
}
