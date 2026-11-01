import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyView, ErrorView, LoadingView } from '@/components/query-states';

import { AllergyBanner } from './allergy-banner';
import { usePet } from './hooks';
import { formatTimeOfDay, kgToLb, petAge, telUrl } from './logic';
import { PetAvatar } from './pet-avatar';
import { petEditRoute, type PetEditSection } from './routes';

type PetDetailScreenProps = {
  petId: string;
  /** Owners get edit links; sitters and admins see a read-only view. */
  editable: boolean;
};

function Section({
  title,
  editLabel,
  onEdit,
  children,
}: {
  title: string;
  editLabel?: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {onEdit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editLabel ?? `Edit ${title}`}
            onPress={onEdit}
            hitSlop={8}
            style={styles.editButton}
          >
            <Text style={styles.editLabel}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function CallRow({
  label,
  sub,
  phone,
}: {
  label: string;
  sub?: string | null;
  phone: string | null;
}) {
  const url = telUrl(phone);
  return (
    <Pressable
      accessibilityRole={url ? 'button' : undefined}
      accessibilityLabel={url ? `Call ${label}${phone ? `, ${phone}` : ''}` : label}
      disabled={!url}
      onPress={() => url && void Linking.openURL(url)}
      style={({ pressed }) => [styles.callRow, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <Text style={styles.body}>{label}</Text>
        {sub ? <Text style={styles.muted}>{sub}</Text> : null}
      </View>
      {url ? <Text style={styles.call}>📞 Call</Text> : null}
    </Pressable>
  );
}

const Muted = ({ children }: { children: ReactNode }) => (
  <Text style={styles.muted}>{children}</Text>
);

export function PetDetailScreen({ petId, editable }: PetDetailScreenProps) {
  const router = useRouter();
  const pet = usePet(petId);
  const edit = (section: PetEditSection) =>
    editable ? () => router.push(petEditRoute(petId, section)) : undefined;

  if (pet.isPending) return <LoadingView label="Loading pet" />;
  if (pet.isError)
    return <ErrorView title="Couldn't load this pet" onRetry={() => void pet.refetch()} />;
  if (!pet.data) return <EmptyView title="Pet not found" body="It may have been removed." />;

  const p = pet.data;
  const facts = [
    p.species === 'dog' ? 'Dog' : 'Cat',
    p.breed,
    petAge(p.birth_date),
    p.weight_kg ? `${kgToLb(p.weight_kg)} lb` : null,
    p.sex !== 'unknown' ? p.sex : null,
    p.spayed_neutered === null
      ? null
      : p.spayed_neutered
        ? 'spayed/neutered'
        : 'not spayed/neutered',
  ].filter(Boolean);
  const contacts = [...(p.household?.emergency_contacts ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={pet.isRefetching} onRefresh={() => void pet.refetch()} />
        }
      >
        {/* Always first, never collapsible. */}
        <AllergyBanner allergies={p.pet_allergies} />

        <View style={[styles.card, styles.hero]}>
          <PetAvatar name={p.name} photoPath={p.photo_url} size={88} />
          <View style={styles.flex}>
            <Text style={styles.name} accessibilityRole="header">
              {p.name}
            </Text>
            <Text style={styles.body}>{facts.join(' · ')}</Text>
            {p.microchip ? <Muted>Microchip {p.microchip}</Muted> : null}
          </View>
        </View>
        {editable ? (
          <View style={styles.editRow}>
            <Pressable accessibilityRole="button" onPress={edit('edit')} style={styles.editPill}>
              <Text style={styles.editLabel}>Edit details & photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={edit('allergies')}
              style={styles.editPill}
            >
              <Text style={styles.editLabel}>Allergies</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/pets/[id]/history', params: { id: petId } })}
              style={styles.editPill}
            >
              <Text style={styles.editLabel}>Visit history</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/pets/[id]/gallery', params: { id: petId } })}
              style={styles.editPill}
            >
              <Text style={styles.editLabel}>Photos</Text>
            </Pressable>
          </View>
        ) : null}

        <Section title="Feeding" onEdit={edit('feeding')}>
          {p.feeding_plans.length === 0 ? (
            <Muted>No feeding plan yet.</Muted>
          ) : (
            p.feeding_plans.map((f) => (
              <View key={f.id} style={styles.item}>
                <Text style={styles.bodyStrong}>
                  {[f.amount, f.unit].filter((x) => x !== null && x !== '').join(' ')}{' '}
                  {f.food_brand ?? ''}
                </Text>
                {f.times.length ? (
                  <Text style={styles.body}>At {f.times.map(formatTimeOfDay).join(', ')}</Text>
                ) : null}
                <Text style={styles.body}>{f.treats_allowed ? 'Treats OK' : 'No treats'}</Text>
                {f.notes ? <Muted>{f.notes}</Muted> : null}
              </View>
            ))
          )}
        </Section>

        <Section title="Medications" onEdit={edit('medications')}>
          {p.pet_medications.length === 0 ? (
            <Muted>No medications.</Muted>
          ) : (
            p.pet_medications.map((m) => (
              <View key={m.id} style={styles.item}>
                <Text style={styles.bodyStrong}>
                  {m.name}
                  {m.dose ? ` · ${m.dose}` : ''}
                </Text>
                {m.schedule_times.length ? (
                  <Text style={styles.body}>
                    At {m.schedule_times.map(formatTimeOfDay).join(', ')}
                  </Text>
                ) : (
                  <Text style={styles.body}>As needed</Text>
                )}
                {m.instructions ? <Muted>{m.instructions}</Muted> : null}
              </View>
            ))
          )}
        </Section>

        <Section title="Temperament" onEdit={edit('edit')} editLabel="Edit temperament">
          {p.temperament_notes ? (
            <Text style={styles.body}>{p.temperament_notes}</Text>
          ) : (
            <Muted>No notes yet.</Muted>
          )}
        </Section>

        <Section title="Vet" onEdit={edit('edit')} editLabel="Edit vet">
          {p.vet_name || p.vet_phone ? (
            <CallRow label={p.vet_name ?? 'Vet'} sub={p.vet_address} phone={p.vet_phone} />
          ) : (
            <Muted>No vet added.</Muted>
          )}
        </Section>

        <Section
          title="Emergency contacts"
          onEdit={editable ? () => router.push('/household') : undefined}
          editLabel="Edit emergency contacts"
        >
          {contacts.length === 0 ? (
            <Muted>No emergency contacts.</Muted>
          ) : (
            contacts.map((c) => (
              <CallRow
                key={c.id}
                label={`${c.name}${c.is_primary ? ' (primary)' : ''}`}
                sub={c.relationship}
                phone={c.phone}
              />
            ))
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E3E3',
    padding: 16,
    gap: 8,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flex: { flex: 1 },
  name: { fontSize: 26, fontWeight: '800', color: '#1A1A1A' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  editButton: { minHeight: 44, minWidth: 56, justifyContent: 'center', alignItems: 'flex-end' },
  editLabel: { fontSize: 16, fontWeight: '600', color: '#0B5CAD' },
  editRow: { flexDirection: 'row', gap: 8 },
  editPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#E3F0FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  item: { gap: 2, paddingVertical: 4 },
  body: { fontSize: 17, color: '#333333' },
  bodyStrong: { fontSize: 17, fontWeight: '600', color: '#1A1A1A' },
  muted: { fontSize: 15, color: '#666666' },
  callRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
  },
  pressed: { backgroundColor: '#F0F4F8' },
  call: { fontSize: 16, fontWeight: '700', color: '#2E7D32' },
});
