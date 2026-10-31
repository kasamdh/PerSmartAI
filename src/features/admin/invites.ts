import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import { formatInviteCode } from '@/features/auth/invite-code';
import type { CreateInviteValues } from '@/features/auth/schemas';
import { supabase } from '@/lib/supabase';

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

export type PendingInvite = Awaited<ReturnType<typeof fetchPendingInvites>>[number];

export async function createInvite(values: CreateInviteValues) {
  // organization_id, code, expiry, and created_by are filled in by the database.
  const { data, error } = await supabase
    .from('invites')
    .insert({ role: values.role, email: values.email || null })
    .select('id, code, role, email, expires_at, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId: string) {
  const { error } = await supabase.from('invites').delete().eq('id', inviteId);
  if (error) throw error;
}

/** Deep link that opens Accept invite with the code filled in. */
export function inviteLink(code: string): string {
  return Linking.createURL('accept-invite', { queryParams: { code } });
}

/** Text for the share sheet (SMS, WhatsApp, email...). */
export function inviteShareMessage(input: {
  businessName: string;
  role: 'owner' | 'sitter' | 'admin';
  code: string;
  link: string;
}): string {
  const as = input.role === 'sitter' ? 'as a sitter' : 'to manage your pets’ visits';
  return [
    `You're invited to join ${input.businessName} on Pet Sitter ${as}.`,
    `Open the Pet Sitter app, tap "I have an invite code" and enter: ${formatInviteCode(input.code)}`,
    `Or open this link on your phone: ${input.link}`,
  ].join('\n\n');
}

const invitesKey = ['admin', 'invites'] as const;

export function usePendingInvites() {
  return useQuery({ queryKey: invitesKey, queryFn: fetchPendingInvites });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInvite,
    onSettled: () => queryClient.invalidateQueries({ queryKey: invitesKey }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeInvite,
    onSettled: () => queryClient.invalidateQueries({ queryKey: invitesKey }),
  });
}

export async function fetchOrganizationName(): Promise<string> {
  const { data, error } = await supabase.from('organizations').select('name').single();
  if (error) throw error;
  return data.name;
}

export function useOrganizationName() {
  return useQuery({ queryKey: ['admin', 'org-name'], queryFn: fetchOrganizationName });
}
