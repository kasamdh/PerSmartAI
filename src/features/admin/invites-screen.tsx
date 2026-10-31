import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BigButton, MIN_TAP_TARGET } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { formatInviteCode } from '@/features/auth/invite-code';
import { createInviteSchema, type CreateInviteValues } from '@/features/auth/schemas';
import { formatCalendarDate } from '@/features/admin/booking-text';
import { zodResolver } from '@/lib/zod-resolver';

import {
  inviteLink,
  inviteShareMessage,
  useCreateInvite,
  useOrganizationName,
  usePendingInvites,
  useRevokeInvite,
  type PendingInvite,
} from './invites';

const ROLES = [
  { value: 'sitter', label: 'Sitter' },
  { value: 'owner', label: 'Pet owner' },
] as const;

/** Admins create invite codes for sitters and owners and share them. */
export function InvitesScreen() {
  const orgName = useOrganizationName();
  const invites = usePendingInvites();
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const [justCreated, setJustCreated] = useState<PendingInvite | null>(null);

  const { control, handleSubmit, reset } = useForm<CreateInviteValues>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: { role: 'sitter', email: '' },
  });

  const share = (invite: PendingInvite) =>
    Share.share({
      message: inviteShareMessage({
        businessName: orgName.data ?? 'our business',
        role: invite.role,
        code: invite.code,
        link: inviteLink(invite.code),
      }),
    });

  const onCreate = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (invite) => {
        setJustCreated(invite);
        reset({ role: values.role, email: '' });
      },
      onError: () => Alert.alert("Couldn't create the invite", 'Please try again.'),
    }),
  );

  const confirmRevoke = (invite: PendingInvite) =>
    Alert.alert('Revoke this invite?', `Code ${formatInviteCode(invite.code)} will stop working.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          if (justCreated?.id === invite.id) setJustCreated(null);
          revoke.mutate(invite.id);
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>New invite</Text>
          <Controller
            control={control}
            name="role"
            render={({ field: { value, onChange } }) => (
              <View style={styles.segment} accessibilityRole="radiogroup">
                {ROLES.map((r) => {
                  const selected = value === r.value;
                  return (
                    <Pressable
                      key={r.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => onChange(r.value)}
                      style={[styles.segmentItem, selected && styles.segmentSelected]}
                    >
                      <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          <FormField
            control={control}
            name="email"
            label="Their email (optional)"
            placeholder="Only this email can use the code"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <BigButton label="Create invite" onPress={() => onCreate()} loading={create.isPending} />
        </View>

        {justCreated ? (
          <View style={[styles.card, styles.created]}>
            <Text style={styles.createdLabel}>Invite code</Text>
            <Text
              style={styles.code}
              selectable
              accessibilityLabel={`Invite code ${formatInviteCode(justCreated.code).split('').join(' ')}`}
            >
              {formatInviteCode(justCreated.code)}
            </Text>
            <Text style={styles.body} selectable>
              {inviteLink(justCreated.code)}
            </Text>
            <BigButton label="Share invite" onPress={() => void share(justCreated)} />
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>Pending invites</Text>
          {invites.data && invites.data.length > 0 ? (
            invites.data.map((invite) => (
              <View key={invite.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowCode}>{formatInviteCode(invite.code)}</Text>
                  <Text style={styles.body}>
                    {invite.role === 'sitter' ? 'Sitter' : 'Pet owner'}
                    {invite.email ? ` · ${invite.email}` : ''} · until{' '}
                    {formatCalendarDate(invite.expires_at.slice(0, 10))}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Share invite ${formatInviteCode(invite.code)}`}
                    onPress={() => void share(invite)}
                    style={styles.smallButton}
                  >
                    <Text style={styles.smallButtonLabel}>Share</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Revoke invite ${formatInviteCode(invite.code)}`}
                    onPress={() => confirmRevoke(invite)}
                    style={styles.smallButton}
                  >
                    <Text style={[styles.smallButtonLabel, styles.revoke]}>Revoke</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.body}>
              {invites.isPending ? 'Loading…' : 'No pending invites.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  body: { fontSize: 15, color: '#444444' },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    minHeight: MIN_TAP_TARGET,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E3E3E3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: { borderColor: '#208AEF', backgroundColor: '#E3F0FD' },
  segmentLabel: { fontSize: 18, color: '#1A1A1A' },
  segmentLabelSelected: { fontWeight: '700', color: '#0B5CAD' },
  created: { borderColor: '#2E7D32', borderWidth: 2, alignItems: 'stretch' },
  createdLabel: { fontSize: 15, fontWeight: '600', color: '#2E7D32' },
  code: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 4,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDDDDD',
  },
  rowText: { flex: 1, gap: 2 },
  rowCode: { fontSize: 18, fontWeight: '700', letterSpacing: 1, color: '#1A1A1A' },
  rowActions: { flexDirection: 'row', gap: 4 },
  smallButton: { minHeight: 48, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 },
  smallButtonLabel: { fontSize: 16, fontWeight: '600', color: '#0B5CAD' },
  revoke: { color: '#C62828' },
});
