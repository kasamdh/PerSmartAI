import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { BigButton } from '@/components/big-button';
import { FormField } from '@/components/form-field';
import { FormScreen, TextButton } from '@/components/form-screen';
import { ErrorView, LoadingView } from '@/components/query-states';
import { zodResolver } from '@/lib/zod-resolver';

import {
  useDeleteContact,
  useOwnHousehold,
  useSaveContact,
  useSaveHousehold,
  useSetPrimaryContact,
} from './hooks';
import { EditableRow, EditorCard } from './list-editor';
import {
  contactSchema,
  householdDetailsSchema,
  type ContactFormValues,
  type HouseholdDetailsValues,
} from './schemas';

const EMPTY_CONTACT: ContactFormValues = {
  name: '',
  relationship: '',
  phone: '',
  isPrimary: false,
};

/** Owner's home: address, private access notes, and emergency contacts (one primary). */
export function HouseholdScreen() {
  const household = useOwnHousehold();
  const saveDetails = useSaveHousehold();
  const saveContact = useSaveContact(household.data?.id ?? '');
  const setPrimary = useSetPrimaryContact();
  const removeContact = useDeleteContact();
  const [message, setMessage] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const h = household.data;
  const access = h?.household_access[0];
  const details = useForm<HouseholdDetailsValues>({
    resolver: zodResolver(householdDetailsSchema),
    values: {
      addressLine1: h?.address_line1 ?? '',
      addressLine2: h?.address_line2 ?? '',
      city: h?.city ?? '',
      region: h?.region ?? '',
      postalCode: h?.postal_code ?? '',
      entryInstructions: access?.entry_instructions ?? '',
      alarmNotes: access?.alarm_notes ?? '',
      wifiName: access?.wifi_name ?? '',
      wifiPassword: access?.wifi_password ?? '',
    },
  });
  const contactForm = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY_CONTACT,
  });

  if (household.isPending) return <LoadingView />;
  if (household.isError || !h) return <ErrorView onRetry={() => void household.refetch()} />;

  const contacts = [...h.emergency_contacts].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );

  const onSaveDetails = details.handleSubmit((values) => {
    setMessage(null);
    saveDetails.mutate(
      { household: h, values },
      {
        onSuccess: () => setMessage('Saved.'),
        onError: () => setMessage("Couldn't save. Check your connection and try again."),
      },
    );
  });

  const cancelContact = () => {
    setEditingContactId(null);
    contactForm.reset(EMPTY_CONTACT);
  };

  const onSaveContact = contactForm.handleSubmit((values) =>
    saveContact.mutate(
      // The first contact becomes primary automatically.
      {
        values: { ...values, isPrimary: values.isPrimary || contacts.length === 0 },
        id: editingContactId ?? undefined,
      },
      {
        onSuccess: cancelContact,
        onError: () => Alert.alert("Couldn't save the contact", 'Please try again.'),
      },
    ),
  );

  return (
    <FormScreen title="Your home" error={message && message !== 'Saved.' ? message : null}>
      <EditorCard title="Address">
        <FormField control={details.control} name="addressLine1" label="Street address" />
        <FormField
          control={details.control}
          name="addressLine2"
          label="Apartment, unit (optional)"
        />
        <FormField control={details.control} name="city" label="City" autoCapitalize="words" />
        <FormField control={details.control} name="region" label="State / region (optional)" />
        <FormField
          control={details.control}
          name="postalCode"
          label="ZIP / postal code (optional)"
        />
      </EditorCard>

      <EditorCard title="Getting in">
        <Text style={styles.privacy}>
          🔒 Only shown to the sitter assigned to a visit, from 24 hours before until 24 hours after
          it.
        </Text>
        <FormField
          control={details.control}
          name="entryInstructions"
          label="Entry instructions"
          placeholder="e.g. Lockbox on the back gate, code 4821"
          multiline
        />
        <FormField
          control={details.control}
          name="alarmNotes"
          label="Alarm notes"
          placeholder="e.g. Panel by the side door, code 1357"
          multiline
        />
        <FormField
          control={details.control}
          name="wifiName"
          label="Wi-Fi name (optional)"
          autoCapitalize="none"
        />
        <FormField
          control={details.control}
          name="wifiPassword"
          label="Wi-Fi password (optional)"
          autoCapitalize="none"
        />
      </EditorCard>

      {message === 'Saved.' ? <Text style={styles.saved}>Saved.</Text> : null}
      <BigButton
        label="Save home details"
        onPress={() => onSaveDetails()}
        loading={saveDetails.isPending}
      />

      <EditorCard title="Emergency contacts">
        {contacts.length === 0 ? (
          <Text style={styles.muted}>Add at least one person we can call.</Text>
        ) : null}
        {contacts.map((c) => (
          <EditableRow
            key={c.id}
            title={`${c.name}${c.is_primary ? ' · Primary' : ''}`}
            subtitle={[c.relationship, c.phone].filter(Boolean).join(' · ')}
            onEdit={() => {
              setEditingContactId(c.id);
              contactForm.reset({
                name: c.name,
                relationship: c.relationship ?? '',
                phone: c.phone,
                isPrimary: c.is_primary,
              });
            }}
            onRemove={() =>
              Alert.alert(`Remove ${c.name}?`, undefined, [
                { text: 'Keep', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeContact.mutate(c.id) },
              ])
            }
            extra={
              c.is_primary ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Make ${c.name} the primary contact`}
                  onPress={() => setPrimary.mutate(c.id)}
                  style={styles.primaryButton}
                >
                  <Text style={styles.primaryLabel}>Make primary</Text>
                </Pressable>
              )
            }
          />
        ))}
      </EditorCard>

      <EditorCard title={editingContactId ? 'Edit contact' : 'Add a contact'}>
        <FormField control={contactForm.control} name="name" label="Name" autoCapitalize="words" />
        <FormField
          control={contactForm.control}
          name="relationship"
          label="Relationship (optional)"
          placeholder="e.g. Neighbor, sister"
        />
        <FormField
          control={contactForm.control}
          name="phone"
          label="Phone"
          keyboardType="phone-pad"
        />
        <Controller
          control={contactForm.control}
          name="isPrimary"
          render={({ field }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: field.value }}
              onPress={() => field.onChange(!field.value)}
              style={styles.checkbox}
            >
              <Text style={styles.checkboxBox}>{field.value ? '☑' : '☐'}</Text>
              <Text style={styles.checkboxLabel}>Primary contact (called first)</Text>
            </Pressable>
          )}
        />
        <BigButton
          label={editingContactId ? 'Save contact' : 'Add contact'}
          onPress={() => onSaveContact()}
          loading={saveContact.isPending}
        />
        {editingContactId ? <TextButton label="Cancel editing" onPress={cancelContact} /> : null}
      </EditorCard>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  privacy: {
    fontSize: 15,
    color: '#0B5CAD',
    backgroundColor: '#E3F0FD',
    borderRadius: 10,
    padding: 10,
  },
  saved: { fontSize: 16, color: '#2E7D32', fontWeight: '600' },
  muted: { fontSize: 15, color: '#666666' },
  primaryButton: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  primaryLabel: { fontSize: 15, fontWeight: '600', color: '#0B5CAD' },
  checkbox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkboxBox: { fontSize: 28, color: '#208AEF' },
  checkboxLabel: { fontSize: 17, color: '#1A1A1A' },
});
